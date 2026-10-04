const PREFIX = "valcon.settings.";
const VERSION_KEY = "valcon.settings.version";
const VERSION = 1;

const memoryStore = new Map();

const SCHEMA = {
  "appearance.theme": {
    type: "enum",
    default: "system",
    options: ["dark", "light", "system"],
    group: "appearance",
    label: "Theme",
  },

  "appearance.accent": {
    type: "color",
    default: "#1793d1",
    group: "appearance",
    label: "Accent",
  },

  "appearance.wallpaper": {
    type: "image",
    default: "",
    group: "appearance",
    label: "Wallpaper",
  },

  "appearance.wallpaperFit": {
    type: "enum",
    default: "cover",
    options: ["cover", "contain", "tile", "stretch", "center"],
    group: "appearance",
    label: "Wallpaper fit",
  },

  "appearance.wallpaperDim": {
    type: "number",
    default: 25,
    min: 0,
    max: 100,
    group: "appearance",
    label: "Wallpaper dim",
  },

  "appearance.wallpaperBlur": {
    type: "number",
    default: 0,
    min: 0,
    max: 30,
    group: "appearance",
    label: "Wallpaper blur",
  },

  "appearance.windowOpacity": {
    type: "number",
    default: 94,
    min: 50,
    max: 100,
    group: "appearance",
    label: "Window opacity",
  },

  "appearance.windowRadius": {
    type: "number",
    default: 12,
    min: 0,
    max: 32,
    group: "appearance",
    label: "Window radius",
  },

  "appearance.fontScale": {
    type: "number",
    default: 100,
    min: 85,
    max: 130,
    group: "appearance",
    label: "Font scale",
  },

  "appearance.reduceMotion": {
    type: "boolean",
    default: false,
    group: "accessibility",
    label: "Reduce motion",
  },

  "appearance.reduceTransparency": {
    type: "boolean",
    default: false,
    group: "accessibility",
    label: "Reduce transparency",
  },

  "appearance.highContrast": {
    type: "boolean",
    default: false,
    group: "accessibility",
    label: "High contrast",
  },

  "appearance.monospace": {
    type: "boolean",
    default: false,
    group: "appearance",
    label: "Monospace UI",
  },

  "desktop.dockPosition": {
    type: "enum",
    default: "bottom",
    options: ["bottom", "left", "right", "top"],
    group: "dock",
    label: "Dock position",
  },

  "desktop.dockSize": {
    type: "number",
    default: 56,
    min: 40,
    max: 100,
    group: "dock",
    label: "Dock size",
  },

  "desktop.dockGap": {
    type: "number",
    default: 8,
    min: 0,
    max: 30,
    group: "dock",
    label: "Dock gap",
  },

  "desktop.dockOpacity": {
    type: "number",
    default: 82,
    min: 20,
    max: 100,
    group: "dock",
    label: "Dock opacity",
  },

  "desktop.dockAutoHide": {
    type: "boolean",
    default: false,
    group: "dock",
    label: "Auto hide dock",
  },

  "desktop.dockShortcut": {
    type: "shortcut",
    default: "Super + D",
    group: "shortcuts",
    label: "Dock shortcut",
  },

  "windows.defaultWidth": {
    type: "number",
    default: 700,
    min: 300,
    max: 2000,
    group: "windows",
    label: "Default width",
  },

  "windows.defaultHeight": {
    type: "number",
    default: 450,
    min: 200,
    max: 1500,
    group: "windows",
    label: "Default height",
  },

  "windows.rememberGeometry": {
    type: "boolean",
    default: true,
    group: "windows",
    label: "Remember geometry",
  },

  "windows.alwaysOnTop": {
    type: "boolean",
    default: false,
    group: "windows",
    label: "Always on top",
  },

  "windows.minimizeOnClose": {
    type: "boolean",
    default: false,
    group: "windows",
    label: "Minimize on close",
  },

  "terminal.theme": {
    type: "enum",
    default: "dark",
    options: ["dark", "light"],
    group: "terminal",
    label: "Terminal theme",
  },

  "terminal.fontSize": {
    type: "number",
    default: 14,
    min: 9,
    max: 30,
    group: "terminal",
    label: "Terminal font size",
  },

  "terminal.lineHeight": {
    type: "number",
    default: 1.45,
    min: 1,
    max: 2.5,
    group: "terminal",
    label: "Terminal line height",
  },

  "terminal.fontWeight": {
    type: "number",
    default: 400,
    min: 300,
    max: 800,
    group: "terminal",
    label: "Terminal font weight",
  },

  "terminal.cursor": {
    type: "enum",
    default: "block",
    options: ["block", "line", "underline"],
    group: "terminal",
    label: "Cursor",
  },

  "terminal.cursorBlink": {
    type: "boolean",
    default: true,
    group: "terminal",
    label: "Cursor blink",
  },

  "terminal.scrollback": {
    type: "number",
    default: 1000,
    min: 100,
    max: 10000,
    group: "terminal",
    label: "Scrollback",
  },

  "terminal.copyOnSelect": {
    type: "boolean",
    default: false,
    group: "terminal",
    label: "Copy on select",
  },

  "music.volume": {
    type: "number",
    default: 1,
    min: 0,
    max: 1,
    group: "music",
    label: "Volume",
  },

  "music.shuffle": {
    type: "boolean",
    default: false,
    group: "music",
    label: "Shuffle",
  },

  "music.repeat": {
    type: "enum",
    default: "off",
    options: ["off", "one", "all"],
    group: "music",
    label: "Repeat",
  },

  "music.autoplay": {
    type: "boolean",
    default: true,
    group: "music",
    label: "Autoplay",
  },

  "music.resume": {
    type: "boolean",
    default: true,
    group: "music",
    label: "Resume playback",
  },

  "music.crossfade": {
    type: "boolean",
    default: false,
    group: "music",
    label: "Crossfade",
  },

  "music.normalize": {
    type: "boolean",
    default: false,
    group: "music",
    label: "Normalize volume",
  },

  "network.apiUrl": {
    type: "string",
    default: "",
    group: "network",
    label: "API URL",
  },

  "network.bridgeUrl": {
    type: "string",
    default: "",
    group: "network",
    label: "Bridge URL",
  },

  "network.musicUploadUrl": {
    type: "string",
    default: "",
    group: "network",
    label: "Music upload URL",
  },

  "network.musicPlayUrl": {
    type: "string",
    default: "",
    group: "network",
    label: "Music play URL",
  },
};

const listeners = new Map();
const anyListeners = new Set();

function storageGet(key) {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return memoryStore.has(key) ? memoryStore.get(key) : null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, value);
    memoryStore.delete(key);
    return true;
  } catch (error) {
    memoryStore.set(key, value);
    window.dispatchEvent(
      new CustomEvent("settings:storage-full", {
        detail: { key, error },
      }),
    );
    return false;
  }
}

function storageDelete(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}

  memoryStore.delete(key);
}

function parseValue(raw, schema) {
  if (raw === null || raw === undefined) {
    return schema.default;
  }

  try {
    let value = JSON.parse(raw);

    if (schema.type === "boolean") {
      return Boolean(value);
    }

    if (schema.type === "number") {
      value = Number(value);

      if (!Number.isFinite(value)) {
        return schema.default;
      }

      if (schema.min !== undefined) {
        value = Math.max(schema.min, value);
      }

      if (schema.max !== undefined) {
        value = Math.min(schema.max, value);
      }

      return value;
    }

    if (schema.type === "enum") {
      return schema.options.includes(value) ? value : schema.default;
    }

    if (schema.type === "string" || schema.type === "shortcut") {
      return typeof value === "string" ? value : schema.default;
    }

    if (schema.type === "color") {
      return typeof value === "string" ? value : schema.default;
    }

    if (schema.type === "image") {
      return typeof value === "string" ? value : schema.default;
    }

    return value;
  } catch {
    return schema.default;
  }
}

function emit(key, value, oldValue) {
  const detail = {
    key,
    value,
    oldValue,
  };

  const set = listeners.get(key);

  if (set) {
    for (const callback of set) {
      try {
        callback(value, oldValue, detail);
      } catch (error) {
        console.error("Settings listener error:", error);
      }
    }
  }

  for (const callback of anyListeners) {
    try {
      callback(detail);
    } catch (error) {
      console.error("Settings listener error:", error);
    }
  }

  window.dispatchEvent(
    new CustomEvent("settings:change", {
      detail,
    }),
  );
}

function migrateLegacy() {
  const migrations = [
    ["wallpaper", "appearance.wallpaper"],
    ["terminal-theme", "terminal.theme"],
    ["dock-shortcut", "desktop.dockShortcut"],
  ];

  for (const [legacy, modern] of migrations) {
    try {
      const value = localStorage.getItem(legacy);

      if (value !== null && storageGet(modern) === null) {
        const schema = SCHEMA[modern];

        let parsed = value;

        if (
          schema.type !== "image" &&
          schema.type !== "string" &&
          schema.type !== "shortcut"
        ) {
          try {
            parsed = JSON.parse(value);
          } catch {}
        }

        storageSet(modern, JSON.stringify(parsed));
      }

      localStorage.removeItem(legacy);
    } catch {}
  }

  try {
    const oldMusic = localStorage.getItem("valcon.music.prefs");

    if (oldMusic) {
      const prefs = JSON.parse(oldMusic);

      if (prefs.volume !== undefined) {
        storageSet("music.volume", JSON.stringify(Number(prefs.volume)));
      }

      if (prefs.shuffle !== undefined) {
        storageSet("music.shuffle", JSON.stringify(Boolean(prefs.shuffle)));
      }

      if (prefs.repeat !== undefined) {
        storageSet("music.repeat", JSON.stringify(prefs.repeat));
      }
    }
  } catch {}

  try {
    localStorage.setItem(VERSION_KEY, String(VERSION));
  } catch {}
}

migrateLegacy();

export const settingsSchema = SCHEMA;

export function get(key) {
  const schema = SCHEMA[key];

  if (!schema) {
    return undefined;
  }

  return parseValue(storageGet(key), schema);
}

export function set(key, value, options = {}) {
  const schema = SCHEMA[key];

  if (!schema) {
    throw new Error(`Unknown setting: ${key}`);
  }

  const oldValue = get(key);

  let next = value;

  if (schema.type === "boolean") {
    next = Boolean(value);
  }

  if (schema.type === "number") {
    next = Number(value);

    if (!Number.isFinite(next)) {
      next = schema.default;
    }

    if (schema.min !== undefined) {
      next = Math.max(schema.min, next);
    }

    if (schema.max !== undefined) {
      next = Math.min(schema.max, next);
    }
  }

  if (schema.type === "enum") {
    if (!schema.options.includes(next)) {
      next = schema.default;
    }
  }

  if (
    schema.type === "string" ||
    schema.type === "shortcut" ||
    schema.type === "color" ||
    schema.type === "image"
  ) {
    next = String(next ?? "");
  }

  storageSet(key, JSON.stringify(next));

  if (!options.silent) {
    emit(key, next, oldValue);
  }

  return next;
}

export function getAll() {
  const output = {};

  for (const key of Object.keys(SCHEMA)) {
    output[key] = get(key);
  }

  return output;
}

export function reset(key) {
  if (!SCHEMA[key]) return;

  const oldValue = get(key);

  storageDelete(key);

  const next = SCHEMA[key].default;

  emit(key, next, oldValue);
}

export function resetGroup(group) {
  for (const [key, schema] of Object.entries(SCHEMA)) {
    if (schema.group === group) {
      reset(key);
    }
  }
}

export function resetAll() {
  for (const key of Object.keys(SCHEMA)) {
    storageDelete(key);
  }

  for (const key of Object.keys(SCHEMA)) {
    emit(key, SCHEMA[key].default, undefined);
  }
}

export function exportJSON() {
  return JSON.stringify(
    {
      version: VERSION,
      settings: getAll(),
    },
    null,
    2,
  );
}

export function importJSON(text) {
  const data = JSON.parse(text);

  if (!data || typeof data !== "object") {
    throw new Error("Invalid settings file");
  }

  const values = data.settings || data;

  for (const key of Object.keys(SCHEMA)) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      set(key, values[key]);
    }
  }

  return getAll();
}

export function on(key, callback) {
  if (!listeners.has(key)) {
    listeners.set(key, new Set());
  }

  listeners.get(key).add(callback);

  return () => {
    listeners.get(key)?.delete(callback);
  };
}

export function onAny(callback) {
  anyListeners.add(callback);

  return () => {
    anyListeners.delete(callback);
  };
}

export function storageInfo() {
  let used = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key?.startsWith(PREFIX)) {
        used += key.length + String(localStorage.getItem(key)).length;
      }
    }
  } catch {}

  return {
    bytes: used,
    kilobytes: Math.round(used / 1024),
    megabytes: Number((used / 1024 / 1024).toFixed(2)),
  };
}
