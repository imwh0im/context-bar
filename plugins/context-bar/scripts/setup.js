"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const SOURCE = path.join(__dirname, "context-bar.js");
const SCRIPT_NAME = "context-bar.js";
const FLAG_NAME = "context-bar.on";
const BACKUP_NAME = "orig-statusline.json";
const REFRESH_INTERVAL = 30;
function settingsPath() {
    const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
    return path.join(configDir, "settings.json");
}
function readJson(file) {
    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return undefined;
        }
        throw error;
    }
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error(`${file} is not a JSON object`);
    }
    return parsed;
}
function writeAtomic(file, content) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
    try {
        fs.writeFileSync(tmp, content);
        if (fs.existsSync(file)) {
            fs.chmodSync(tmp, fs.statSync(file).mode);
        }
        fs.renameSync(tmp, file);
    }
    catch (error) {
        fs.rmSync(tmp, { force: true });
        throw error;
    }
}
function writeJson(file, value) {
    writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}
function installedScript(dataDir) {
    return path.join(dataDir, SCRIPT_NAME);
}
function statusLineFor(dataDir) {
    return {
        type: "command",
        command: `node "${installedScript(dataDir)}"`,
        refreshInterval: REFRESH_INTERVAL,
    };
}
function isOurs(statusLine, dataDir) {
    if (!statusLine || typeof statusLine !== "object" || Array.isArray(statusLine)) {
        return false;
    }
    return String(statusLine.command ?? "").includes(installedScript(dataDir));
}
function sync(dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });
    const target = installedScript(dataDir);
    const source = fs.readFileSync(SOURCE);
    if (fs.existsSync(target) && fs.readFileSync(target).equals(source)) {
        return;
    }
    writeAtomic(target, source);
}
function install(dataDir) {
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
function uninstall(dataDir) {
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
    }
    else {
        settings.statusLine = previous;
    }
    writeJson(file, settings);
    fs.rmSync(backupPath, { force: true });
    console.log(previous === null
        ? "context-bar: uninstalled, statusLine removed"
        : "context-bar: uninstalled, previous statusLine restored");
}
function toggle(dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });
    const flag = path.join(dataDir, FLAG_NAME);
    let state;
    if (fs.existsSync(flag)) {
        fs.rmSync(flag);
        state = "off";
    }
    else {
        fs.writeFileSync(flag, "");
        state = "on";
    }
    const settings = readJson(settingsPath()) ?? {};
    if (isOurs(settings.statusLine, dataDir)) {
        console.log(`context-bar: ${state}`);
    }
    else {
        console.log(`context-bar: ${state} (status line not installed, run /context-bar:setup)`);
    }
}
const COMMANDS = { sync, install, uninstall, toggle };
function main() {
    const [command, dataDir] = process.argv.slice(2);
    const run = command ? COMMANDS[command] : undefined;
    if (!run || !dataDir?.trim() || process.argv.length !== 4) {
        console.error(`usage: setup.js {${Object.keys(COMMANDS).join("|")}} <plugin-data-dir>`);
        process.exit(2);
    }
    run(path.resolve(dataDir));
}
main();
