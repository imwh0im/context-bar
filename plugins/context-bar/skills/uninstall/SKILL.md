---
name: uninstall
description: Remove the context bar from your status line and restore the statusLine you had before setup.
disable-model-invocation: true
allowed-tools: Bash(node:*)
---
!`node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.js" uninstall "${CLAUDE_PLUGIN_DATA}"`

Reply with only the line above, verbatim, and nothing else.
