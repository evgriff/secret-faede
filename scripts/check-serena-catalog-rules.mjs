export const staleBranchPatterns = [
  /use a codex\/ branch/i,
  /codex\/ branch/i,
  /do not perform substantial edits directly on main/i,
];

export const policyScanPaths = [
  'AGENTS.md',
  'codex.md',
  '.serena/project.yml',
  'plugins/serena/.codex-plugin/plugin.json',
  'plugins/serena/codex-context.yml',
  'plugins/serena/scripts/ensure-project-mcp.sh',
];

export const memoryChangeRules = [
  {
    label: 'Plan route and plot editor changes',
    patterns: [/^src\/features\/plan\//],
    required: ['stories/plan-real-plot-editor'],
  },
  {
    label: 'Today and task workflow changes',
    patterns: [/^src\/features\/today\//, /^src\/features\/tasks\//],
    required: ['stories/today-field-work'],
  },
  {
    label: 'Feed, journal, log, and media changes',
    patterns: [
      /^src\/features\/log\//,
      /^src\/features\/journal\//,
      /^src\/domain\/media\//,
      /^src\/infrastructure\/firebase\/media\//,
      /^src\/infrastructure\/media\//,
    ],
    required: ['stories/feed-operational-memory'],
  },
  {
    label: 'Settings, auth, profile, and notification changes',
    patterns: [
      /^src\/features\/settings\//,
      /^src\/features\/auth\//,
      /^src\/domain\/users\//,
      /^src\/domain\/notifications\//,
      /^src\/infrastructure\/firebase\/auth\//,
      /^src\/infrastructure\/firebase\/users\//,
      /^src\/infrastructure\/firebase\/notifications\//,
      /^src\/infrastructure\/notifications\//,
      /^src\/infrastructure\/mobile\//,
    ],
    requiredAny: [
      'stories/settings-alert-trust',
      'architecture/auth-profile-notifications',
    ],
  },
  {
    label: 'Garden workspace, Firebase, runtime, and Functions changes',
    patterns: [
      /^src\/domain\/gardens\//,
      /^src\/features\/garden\//,
      /^src\/infrastructure\/firebase\//,
      /^src\/infrastructure\/runtime\//,
      /^functions\//,
      /^firestore\.(rules|indexes\.json)$/,
      /^storage\.rules$/,
      /^firebase\.json$/,
    ],
    requiredAny: [
      'architecture/garden-workspace-persistence',
      'architecture/auth-profile-notifications',
    ],
  },
  {
    label: 'Product guardrail documentation changes',
    patterns: [
      /^AGENTS\.md$/,
      /^codex\.md$/,
      /^README\.md$/,
      /^docs\/architecture\.md$/,
      /^docs\/architecture\.md$/,
      /^docs\/public-release-simplification-backlog\.md$/,
    ],
    required: ['scope/product-guardrails'],
  },
  {
    label: 'Serena, workflow, package, and quality gate changes',
    patterns: [
      /^plugins\/serena\//,
      /^\.serena\/project\.yml$/,
      /^\.serena\/memories\/serena\//,
      /^\.serena\/memories\/workflow\//,
      /^scripts\/check-serena-catalog(?:-rules)?\.mjs$/,
      /^package\.json$/,
      /^docs\/testing-ci\.md$/,
      /^AGENTS\.md$/,
      /^codex\.md$/,
    ],
    requiredAny: [
      'serena/setup-and-health',
      'serena/memory-catalog',
      'workflow/source-control-and-verification',
    ],
  },
];

export function hasRequiredMemoryChange(rule, changedMemorySet) {
  if (rule.required) {
    return rule.required.every((memory) => changedMemorySet.has(memory));
  }

  if (rule.requiredAny) {
    return rule.requiredAny.some((memory) => changedMemorySet.has(memory));
  }

  return true;
}

export function formatRequiredMemories(rule) {
  if (rule.required) {
    return rule.required.map((memory) => `\`${memory}\``).join(', ');
  }

  return `one of ${rule.requiredAny
    .map((memory) => `\`${memory}\``)
    .join(', ')}`;
}
