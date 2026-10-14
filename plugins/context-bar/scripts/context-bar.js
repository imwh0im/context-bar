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
const HOME = os.homedir();
const FLAG = path.join(__dirname, "context-bar.on");
const WIDTH = Number.parseInt(process.env.CONTEXT_BAR_WIDTH ?? "40", 10) || 40;
const BUFFER_RATIO = Number.parseFloat(process.env.CONTEXT_BAR_BUFFER_RATIO ?? "0.033") || 0.033;
const TAIL_BYTES = 1_048_576;
const RESET = "\x1b[0m";
const rgb = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;
const DIM = rgb(153, 153, 153);
const SEGMENTS = [
    { key: "cached", color: rgb(130, 125, 189), char: "█" },
    { key: "cacheWrite", color: rgb(215, 119, 87), char: "█" },
    { key: "input", color: rgb(255, 193, 7), char: "█" },
    { key: "free", color: DIM, char: "░" },
    { key: "buffer", color: DIM, char: "▒" },
];
const STRINGS = {
    en: {
        cached: "cached",
        cacheWrite: "cache write",
        input: "input",
        free: "free",
        buffer: "autocompact buffer",
        waiting: "ctx — shown after first response",
        cacheExpired: "cache expired",
        cacheLeft: (time) => `cache ${time} left`,
        minutes: (n) => `${n}m`,
        underMinute: "<1m",
    },
    ko: {
        cached: "캐시된 앞부분",
        cacheWrite: "새 캐시",
        input: "입력",
        free: "남음",
        buffer: "압축 여유",
        waiting: "ctx — 첫 응답 뒤에 표시",
        cacheExpired: "캐시 만료",
        cacheLeft: (time) => `캐시 ${time} 남음`,
        minutes: (n) => `${n}분`,
        underMinute: "<1분",
    },
};
const LANGUAGE_ALIASES = {
    en: ["en", "eng", "english", "영어"],
    ko: ["ko", "kor", "korean", "한국어", "한국말"],
};
function isLanguage(value) {
    return Object.hasOwn(STRINGS, value);
}
function normalizeLanguage(value) {
    const v = value.trim().toLowerCase();
    for (const [code, aliases] of Object.entries(LANGUAGE_ALIASES)) {
        if (aliases.includes(v) && isLanguage(code)) {
            return code;
        }
    }
    const base = v.replaceAll("-", "_").split(".")[0]?.split("@")[0]?.split("_")[0] ?? "";
    return isLanguage(base) ? base : "en";
}
function readLanguageSetting(file) {
    try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
        if (parsed && typeof parsed === "object" && "language" in parsed) {
            const value = parsed.language;
            if (typeof value === "string" && value.trim()) {
                return value;
            }
        }
    }
    catch {
        return undefined;
    }
    return undefined;
}
function settingsLanguage(data) {
    const project = data.workspace?.project_dir || data.workspace?.current_dir || data.cwd;
    const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, ".claude");
    const files = [];
    if (project) {
        files.push(path.join(project, ".claude", "settings.local.json"));
        files.push(path.join(project, ".claude", "settings.json"));
    }
    files.push(path.join(configDir, "settings.json"));
    for (const file of files) {
        const value = readLanguageSetting(file);
        if (value) {
            return value;
        }
    }
    return undefined;
}
function resolveLanguage(data) {
    const candidates = [
        process.env.CONTEXT_BAR_LANG,
        settingsLanguage(data),
        process.env.LC_ALL,
        process.env.LC_MESSAGES,
        process.env.LANG,
    ];
    for (const value of candidates) {
        if (value && value.trim()) {
            return normalizeLanguage(value);
        }
    }
    return "en";
}
function fmt(n) {
    if (n >= 1_000_000) {
        const v = n / 1_000_000;
        return Number.isInteger(v) ? `${v}m` : `${v.toFixed(1)}m`;
    }
    if (n >= 10_000) {
        return `${Math.round(n / 1000)}k`;
    }
    if (n >= 1000) {
        return `${(n / 1000).toFixed(1)}k`;
    }
    return String(n);
}
function cells(values, total, width) {
    const raw = values.map((v) => (total ? (v / total) * width : 0));
    const out = values.map((v, i) => (v > 0 ? Math.max(1, Math.round(raw[i] ?? 0)) : 0));
    let diff = width - out.reduce((a, b) => a + b, 0);
    const remainder = (i) => (raw[i] ?? 0) - (out[i] ?? 0);
    const order = out
        .map((_, i) => i)
        .sort((a, b) => (diff > 0 ? remainder(b) - remainder(a) : remainder(a) - remainder(b)));
    let i = 0;
    while (diff !== 0 && order.length > 0) {
        const k = order[i % order.length] ?? 0;
        const current = out[k] ?? 0;
        if (diff > 0) {
            out[k] = current + 1;
            diff -= 1;
        }
        else if (current > 1) {
            out[k] = current - 1;
            diff += 1;
        }
        i += 1;
        if (i > width * 4) {
            break;
        }
    }
    return out;
}
function readTail(file) {
    let fd;
    try {
        fd = fs.openSync(file, "r");
        const size = fs.fstatSync(fd).size;
        const start = Math.max(size - TAIL_BYTES, 0);
        const buffer = Buffer.alloc(size - start);
        fs.readSync(fd, buffer, 0, buffer.length, start);
        return buffer.toString("utf8").split(/\r?\n/);
    }
    catch {
        return undefined;
    }
    finally {
        if (fd !== undefined) {
            fs.closeSync(fd);
        }
    }
}
function cacheTtlLeft(data) {
    const file = data.transcript_path;
    if (!file || !fs.existsSync(file)) {
        return undefined;
    }
    const lines = readTail(file);
    if (!lines) {
        return undefined;
    }
    let lastTs;
    let ttl;
    for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i] ?? "";
        if (!line.includes('"assistant"') || !line.includes('"usage"')) {
            continue;
        }
        let entry;
        try {
            entry = JSON.parse(line);
        }
        catch {
            continue;
        }
        if (entry.type !== "assistant" || entry.isSidechain) {
            continue;
        }
        if (lastTs === undefined) {
            const parsed = entry.timestamp ? Date.parse(entry.timestamp) : Number.NaN;
            if (Number.isNaN(parsed)) {
                continue;
            }
            lastTs = parsed / 1000;
        }
        const creation = entry.message?.usage?.cache_creation;
        if ((creation?.ephemeral_1h_input_tokens ?? 0) > 0) {
            ttl = 3600;
        }
        else if ((creation?.ephemeral_5m_input_tokens ?? 0) > 0) {
            ttl = 300;
        }
        if (ttl) {
            break;
        }
    }
    if (lastTs === undefined) {
        return undefined;
    }
    const effectiveTtl = ttl ?? 300;
    return { ttl: effectiveTtl, left: effectiveTtl - (Date.now() / 1000 - lastTs) };
}
function cacheLabel(data, t) {
    const info = cacheTtlLeft(data);
    if (!info) {
        return "";
    }
    const { ttl, left } = info;
    const tag = ttl === 3600 ? "1h" : "5m";
    const separator = `  ${DIM}·${RESET}  `;
    if (left <= 0) {
        return `${separator}${rgb(229, 115, 115)}${t.cacheExpired}${RESET} ${DIM}(${tag})${RESET}`;
    }
    const mins = Math.floor(left / 60);
    const text = mins >= 1 ? t.minutes(mins) : t.underMinute;
    const color = left < Math.min(300, ttl / 5) ? rgb(255, 193, 7) : rgb(130, 125, 189);
    return `${separator}${color}${t.cacheLeft(text)}${RESET} ${DIM}(${tag})${RESET}`;
}
function render(data) {
    const t = STRINGS[resolveLanguage(data)];
    const size = data.context_window?.context_window_size || 200_000;
    const usage = data.context_window?.current_usage ?? {};
    const cached = usage.cache_read_input_tokens ?? 0;
    const created = usage.cache_creation_input_tokens ?? 0;
    const fresh = usage.input_tokens ?? 0;
    const used = cached + created + fresh;
    if (used === 0) {
        return [`${DIM}${t.waiting}${RESET}`];
    }
    const buffer = Math.floor(size * BUFFER_RATIO);
    const free = Math.max(size - used - buffer, 0);
    const values = [cached, created, fresh, free, Math.min(buffer, size - used)];
    const widths = cells(values, size, WIDTH);
    const bar = SEGMENTS.map((segment, i) => `${segment.color}${segment.char.repeat(widths[i] ?? 0)}`).join("") +
        RESET;
    const pct = Math.round((used / size) * 100);
    const legend = SEGMENTS.map((segment, i) => ({ segment, value: values[i] ?? 0 }))
        .filter(({ value }) => value > 0)
        .map(({ segment, value }) => `${segment.color}${segment.char === "█" ? "■" : segment.char}${RESET} ${t[segment.key]} ${fmt(value)}`)
        .join("  ");
    return [`ctx ${fmt(used)}/${fmt(size)}  ${pct}%${cacheLabel(data, t)}`, bar, legend];
}
function parseInput(raw) {
    if (!raw.trim()) {
        return {};
    }
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
function main() {
    let raw = "";
    try {
        raw = fs.readFileSync(0, "utf8");
    }
    catch {
        raw = "";
    }
    if (!fs.existsSync(FLAG)) {
        return;
    }
    process.stdout.write(`${render(parseInput(raw)).join("\n")}\n`);
}
main();
