---
name: setup
description: Install the context bar as your Claude Code status line, backing up the current statusLine.
disable-model-invocation: true
allowed-tools: Bash(node:*)
---
!`node "${CLAUDE_PLUGIN_ROOT}/scripts/setup.js" install "${CLAUDE_PLUGIN_DATA}"`

Reply with only the line above, verbatim, and nothing else.
