#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd -P)"
readonly PROJECT_NAME="secret-faeries"
readonly CONTEXT_FILE="${REPO_ROOT}/plugins/serena/codex-context.yml"
readonly HOST="127.0.0.1"
readonly PORT="9127"
readonly STATE_DIR="${REPO_ROOT}/.serena/logs"
readonly PID_FILE="${STATE_DIR}/codex-serena-mcp.pid"
readonly LOG_FILE="${STATE_DIR}/codex-serena-mcp.log"
readonly LOCK_DIR="${STATE_DIR}/codex-serena-mcp.lock"

listener_pid() {
  lsof -nP -t -iTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true
}

is_repo_serena_pid() {
  local pid="$1"
  local command_line

  [[ -n "${pid}" ]] || return 1
  command_line="$(ps -p "${pid}" -ww -o command= 2>/dev/null || true)"

  [[ "${command_line}" == *"serena start-mcp-server"* ]] &&
    [[ "${command_line}" == *"--transport streamable-http"* ]] &&
    [[ "${command_line}" == *"--port ${PORT}"* ]] &&
    [[ "${command_line}" == *"--project ${REPO_ROOT}"* ]]
}

wait_for_repo_serena() {
  local pid

  for _ in {1..40}; do
    pid="$(listener_pid)"
    if is_repo_serena_pid "${pid}"; then
      return 0
    fi
    sleep 0.25
  done

  return 1
}

mcp_health_check() {
  python3 - "${HOST}" "${PORT}" "${REPO_ROOT}" "${PROJECT_NAME}" <<'PY'
import json
import sys
import urllib.error
import urllib.request

host, port, repo_root, project_name = sys.argv[1:5]
request = urllib.request.Request(
    f"http://{host}:{port}/mcp",
    data=json.dumps(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {
                    "name": "secret-faeries-serena-health-check",
                    "version": "1",
                },
            },
        }
    ).encode("utf-8"),
    headers={
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    },
    method="POST",
)

try:
    with urllib.request.urlopen(request, timeout=5) as response:
        body_parts: list[str] = []
        for _ in range(200):
            line = response.readline()
            if not line:
                break
            body_parts.append(line.decode("utf-8", errors="replace"))
            body = "".join(body_parts)
            if (
                f"The project with name '{project_name}' at {repo_root} is activated"
                in body
            ):
                sys.exit(0)
            if '"error"' in body and '"result"' not in body:
                break
except (OSError, urllib.error.URLError) as exc:
    print(f"Serena MCP health check failed: {exc}", file=sys.stderr)
    sys.exit(1)

print(
    "Serena MCP health check did not confirm the active Secret Faeries project.",
    file=sys.stderr,
)
sys.exit(1)
PY
}

wait_for_repo_serena_health() {
  local pid

  for _ in {1..40}; do
    pid="$(listener_pid)"
    if is_repo_serena_pid "${pid}" && mcp_health_check; then
      return 0
    fi
    sleep 0.25
  done

  return 1
}

stop_repo_serena_pid() {
  local pid="$1"

  if ! is_repo_serena_pid "${pid}"; then
    return 1
  fi

  kill "${pid}" 2>/dev/null || true
  for _ in {1..40}; do
    if [[ "$(listener_pid)" != "${pid}" ]]; then
      rm -f "${PID_FILE}"
      return 0
    fi
    sleep 0.25
  done

  return 1
}

repo_serena_config_newer_than_pid() {
  local pid="$1"

  python3 - \
    "${pid}" \
    "${CONTEXT_FILE}" \
    "${REPO_ROOT}/.serena/project.yml" \
    "${REPO_ROOT}/plugins/serena/scripts/ensure-project-mcp.sh" <<'PY'
import datetime
import pathlib
import subprocess
import sys

pid = sys.argv[1]
paths = [pathlib.Path(path) for path in sys.argv[2:]]

try:
    started_text = subprocess.check_output(
        ["ps", "-p", pid, "-o", "lstart="],
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
    started_at = datetime.datetime.strptime(
        started_text,
        "%a %b %d %H:%M:%S %Y",
    ).timestamp()
except Exception:
    sys.exit(1)

latest_config_mtime = max(
    (path.stat().st_mtime for path in paths if path.exists()),
    default=0,
)

sys.exit(0 if latest_config_mtime > started_at + 1 else 1)
PY
}

emit_warning() {
  local message="$1"
  python3 -c 'import json, sys; print(json.dumps({"systemMessage": sys.argv[1]}))' "${message}"
}

mkdir -p "${STATE_DIR}"

existing_pid="$(listener_pid)"
if is_repo_serena_pid "${existing_pid}"; then
  if ! repo_serena_config_newer_than_pid "${existing_pid}" && mcp_health_check; then
    exit 0
  fi

  emit_warning "Existing Secret Faeries Serena MCP is stale or did not confirm an active project; restarting the repo-owned singleton."
  if ! stop_repo_serena_pid "${existing_pid}"; then
    emit_warning "Could not stop stale Secret Faeries Serena MCP process ${existing_pid}; leaving it running."
    exit 0
  fi
fi

existing_pid="$(listener_pid)"
if [[ -n "${existing_pid}" ]]; then
  emit_warning "Serena MCP port ${PORT} is already in use by PID ${existing_pid}; not starting the Secret Faeries Serena singleton."
  exit 0
fi

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  if wait_for_repo_serena_health; then
    exit 0
  fi

  emit_warning "Timed out waiting for another Codex session to start the Secret Faeries Serena singleton."
  exit 0
fi

cleanup() {
  rmdir "${LOCK_DIR}" 2>/dev/null || true
}
trap cleanup EXIT

existing_pid="$(listener_pid)"
if is_repo_serena_pid "${existing_pid}"; then
  if ! repo_serena_config_newer_than_pid "${existing_pid}" && mcp_health_check; then
    exit 0
  fi

  emit_warning "Existing Secret Faeries Serena MCP is stale or did not confirm an active project after lock acquisition; restarting it."
  if ! stop_repo_serena_pid "${existing_pid}"; then
    emit_warning "Could not stop stale Secret Faeries Serena MCP process ${existing_pid}; leaving it running."
    exit 0
  fi
fi

python3 - "${LOG_FILE}" "${PID_FILE}" "${HOST}" "${PORT}" "${REPO_ROOT}" "${CONTEXT_FILE}" <<'PY'
import datetime
import pathlib
import subprocess
import sys

log_path = pathlib.Path(sys.argv[1])
pid_path = pathlib.Path(sys.argv[2])
host = sys.argv[3]
port = sys.argv[4]
repo_root = sys.argv[5]
context_file = sys.argv[6]

command = [
    "serena",
    "start-mcp-server",
    "--transport",
    "streamable-http",
    "--host",
    host,
    "--port",
    port,
    "--project",
    repo_root,
    "--context",
    context_file,
    "--enable-web-dashboard",
    "true",
    "--open-web-dashboard",
    "false",
]

timestamp = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
with log_path.open("ab", buffering=0) as log_file:
    log_file.write(f"\n[{timestamp}] Starting Secret Faeries Serena MCP on {host}:{port}\n".encode())
    process = subprocess.Popen(
        command,
        stdin=subprocess.DEVNULL,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        start_new_session=True,
        close_fds=True,
    )

pid_path.write_text(f"{process.pid}\n", encoding="utf-8")
PY

if ! wait_for_repo_serena_health; then
  emit_warning "Started Serena for Secret Faeries, but it did not begin listening on ${HOST}:${PORT} within 10 seconds. See ${LOG_FILE}."
fi
