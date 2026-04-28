#!/usr/bin/env bash
set -euo pipefail

readonly REPO_ROOT="<repo-path>"
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

emit_warning() {
  local message="$1"
  python3 -c 'import json, sys; print(json.dumps({"systemMessage": sys.argv[1]}))' "${message}"
}

mkdir -p "${STATE_DIR}"

existing_pid="$(listener_pid)"
if is_repo_serena_pid "${existing_pid}"; then
  exit 0
fi

if [[ -n "${existing_pid}" ]]; then
  emit_warning "Serena MCP port ${PORT} is already in use by PID ${existing_pid}; not starting the Secret Faeries Serena singleton."
  exit 0
fi

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  if wait_for_repo_serena; then
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
  exit 0
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

if ! wait_for_repo_serena; then
  emit_warning "Started Serena for Secret Faeries, but it did not begin listening on ${HOST}:${PORT} within 10 seconds. See ${LOG_FILE}."
fi
