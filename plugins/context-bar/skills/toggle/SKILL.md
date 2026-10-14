---
name: toggle
description: Turn the context bar in the status line on or off.
disable-model-invocation: true
allowed-tools: Bash(node:*)
---
!`node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.js" toggle "${CLAUDE_PLUGIN_DATA}"`

Reply with only the line above, verbatim, and nothing else.
