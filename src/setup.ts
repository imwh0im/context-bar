import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const SOURCE = path.join(__dirname, "context-bar.js");
const SCRIPT_NAME = "context-bar.js";
const FLAG_NAME = "context-bar.on";
const BACKUP_NAME = "orig-statusline.json";
const REFRESH_INTERVAL = 30;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Settings = { [key: string]: Json };

function settingsPath(): string {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  return path.join(configDir, "settings.json");
}

function readJson(file: string): Settings | undefined {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${file} is not a JSON object`);
  }
  return parsed as Settings;
}

function writeAtomic(file: string, content: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, content);
    if (fs.existsSync(file)) {
      fs.chmodSync(tmp, fs.statSync(file).mode);
    }
    fs.renameSync(tmp, file);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

function writeJson(file: string, value: Json): void {
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

function installedScript(dataDir: string): string {
  return path.join(dataDir, SCRIPT_NAME);
}

function statusLineFor(dataDir: string): Json {
  return {
    type: "command",
    command: `node "${installedScript(dataDir)}"`,
    refreshInterval: REFRESH_INTERVAL,
  };
}

function isOurs(statusLine: Json | undefined, dataDir: string): boolean {
  if (!statusLine || typeof statusLine !== "object" || Array.isArray(statusLine)) {
    return false;
  }
  return String(statusLine.command ?? "").includes(installedScript(dataDir));
}

function sync(dataDir: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const target = installedScript(dataDir);
  const source = fs.readFileSync(SOURCE);
  if (fs.existsSync(target) && fs.readFileSync(target).equals(source)) {
    return;
  }
  writeAtomic(target, source);
}

function install(dataDir: string): void {
  sync(dataDir);
  const file = settingsPath();
  const settings = readJson(file) ?? {};
  const current = settings.statusLine;
  if (isOurs(current, dataDir)) {
    console.log("context-bar: already installed");
    return;
  }
  writeJson(path.join(dataDir, BACKUP_NAME), { statusLine: current ?? null });
  settings.statusLine = statusLineFor(dataDir);
  writeJson(file, settings);
  fs.writeFileSync(path.join(dataDir, FLAG_NAME), "");
  const note = current === undefined ? "" : " (previous statusLine backed up)";
  console.log(`context-bar: installed into ${file}${note}`);
}

function uninstall(dataDir: string): void {
  const file = settingsPath();
  const settings = readJson(file) ?? {};
  if (!isOurs(settings.statusLine, dataDir)) {
    console.log("context-bar: statusLine is not managed by context-bar, left unchanged");
    return;
  }
  const backupPath = path.join(dataDir, BACKUP_NAME);
  const previous = readJson(backupPath)?.statusLine ?? null;
  if (previous === null) {
    delete settings.statusLine;
  } else {
    settings.statusLine = previous;
  }
  writeJson(file, settings);
  fs.rmSync(backupPath, { force: true });
  console.log(
    previous === null
      ? "context-bar: uninstalled, statusLine removed"
      : "context-bar: uninstalled, previous statusLine restored",
  );
}

function toggle(dataDir: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const flag = path.join(dataDir, FLAG_NAME);
  let state: "on" | "off";
  if (fs.existsSync(flag)) {
    fs.rmSync(flag);
    state = "off";
  } else {
    fs.writeFileSync(flag, "");
    state = "on";
  }
  const settings = readJson(settingsPath()) ?? {};
  if (isOurs(settings.statusLine, dataDir)) {
    console.log(`context-bar: ${state}`);
  } else {
    console.log(`context-bar: ${state} (status line not installed, run /context-bar:setup)`);
  }
}

const COMMANDS: Record<string, (dataDir: string) => void> = { sync, install, uninstall, toggle };

function main(): void {
  const [command, dataDir] = process.argv.slice(2);
  const run = command ? COMMANDS[command] : undefined;
  if (!run || !dataDir?.trim() || process.argv.length !== 4) {
    console.error(`usage: setup.js {${Object.keys(COMMANDS).join("|")}} <plugin-data-dir>`);
    process.exit(2);
  }
  run(path.resolve(dataDir));
}

main();
