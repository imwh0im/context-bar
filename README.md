# context-bar

A Claude Code status line that shows how the current session's context window is used, and how long the prompt cache has left.

```
ctx 53k/200k  27%  ·  cache 57m left (1h)
███████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░▒
■ cached 50k  ■ cache write 3.0k  ■ input 200  ░ free 140k  ▒ autocompact buffer 6.6k
```

| Segment | Meaning |
| --- | --- |
| cached | Tokens read from the prompt cache |
| cache write | Tokens written to the prompt cache on the last request |
| input | Uncached input tokens |
| free | Room left before the autocompact buffer |
| autocompact buffer | Space reserved before Claude Code compacts the conversation |

The first line also shows the time left on the prompt cache (5m or 1h TTL), based on the last assistant response in the transcript. It turns yellow when the cache is about to expire.

## Requirements

- Claude Code with plugin support
- Node.js 18 or later, with `node` on `PATH`
- macOS or Linux, in a terminal with 24-bit color

## Install

```
/plugin marketplace add imwh0im/context-bar
/plugin install context-bar@context-bar
/context-bar:setup
```

Restart Claude Code or start a new session to see the bar.

### What `/context-bar:setup` changes

Plugins cannot register a status line on their own, so setup edits your user settings (`~/.claude/settings.json`, or `$CLAUDE_CONFIG_DIR/settings.json`):

- Your current `statusLine` is backed up to the plugin's data directory.
- `statusLine` is replaced with a command that runs the bar from the plugin's data directory, refreshing every 30 seconds.

The bar script is copied into the plugin's data directory at the start of every session, so plugin updates apply without running setup again.

## Usage

| Command | Effect |
| --- | --- |
| `/context-bar:toggle` | Show or hide the bar |
| `/context-bar:setup` | Install the bar as your status line |
| `/context-bar:uninstall` | Restore the status line you had before setup |

## Uninstall

Run `/context-bar:uninstall` **before** removing the plugin. Removing the plugin deletes its data directory, including the backup of your previous status line, and leaves `statusLine` pointing at a script that no longer exists.

```
/context-bar:uninstall
/plugin uninstall context-bar@context-bar
```

If you already removed the plugin, delete or replace the `statusLine` entry in `~/.claude/settings.json` by hand.

## Configuration

| Environment variable | Default | Description |
| --- | --- | --- |
| `CONTEXT_BAR_LANG` | auto | Label language (`en`, `ko`) |
| `CONTEXT_BAR_WIDTH` | `40` | Bar width in cells |
| `CONTEXT_BAR_BUFFER_RATIO` | `0.033` | Share of the context window shown as the autocompact buffer |

### Language

Labels follow the first value found in:

1. `CONTEXT_BAR_LANG`
2. Claude Code's `language` setting: project `.claude/settings.local.json`, project `.claude/settings.json`, then user settings
3. `LC_ALL`, `LC_MESSAGES`, `LANG`

Supported languages are English and Korean. Anything else falls back to English. To add a language, add an entry to `STRINGS` and `LANGUAGE_ALIASES` in `src/context-bar.ts`.

## Updates

Auto-update is off by default for third-party marketplaces. Turn it on in `/plugin` → Marketplaces → `context-bar` → Enable auto-update, or update manually with `/plugin marketplace update context-bar`.

## Local development

The scripts are written in TypeScript under `src/` and compiled into `plugins/context-bar/scripts/`. The compiled JavaScript is committed so the plugin runs without a build step.

```
pnpm install
pnpm build
claude --plugin-dir ./plugins/context-bar
```

Run `pnpm build` and commit the output whenever `src/` changes.

## License

MIT
