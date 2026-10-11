import WinBox from "winbox/src/js/winbox.js";
import "winbox/dist/css/winbox.min.css";

import { get } from "./core/settings-store.js";

function toPixels(value, relativeTo) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return NaN;
  }

  const trimmed = value.trim();

  const numeric = Number.parseFloat(trimmed);

  if (!Number.isFinite(numeric)) {
    return NaN;
  }

  if (trimmed.endsWith("%")) {
    return (numeric / 100) * relativeTo;
  }

  return numeric;
}

export class AppManager {
  constructor() {
    this.apps = new Map();
    this.windows = new Map();
    this.geometry = this.loadGeometry();
    this.zCounter = 100;
  }

  register(app) {
    if (!app?.id) {
      throw new Error("App registration requires an id");
    }

    this.apps.set(app.id, app);
  }

  loadGeometry() {
    try {
      return JSON.parse(localStorage.getItem("valcon.window.geometry") || "{}");
    } catch {
      return {};
    }
  }

  saveGeometry() {
    try {
      localStorage.setItem(
        "valcon.window.geometry",
        JSON.stringify(this.geometry),
      );
    } catch {}
  }

  async open(id) {
    const app = this.apps.get(id);

    if (!app) {
      throw new Error(`App not found: ${id}`);
    }

    if (app.single && this.windows.has(id)) {
      const existing = this.windows.get(id);

      if (existing.min) {
        existing.restore();
      }

      existing.focus();

      return existing;
    }

    if (typeof app.html !== "string" || !app.html.trim()) {
      throw new Error(`${id} has no markup`);
    }

    const doc = new DOMParser().parseFromString(app.html, "text/html");

    const content = doc.body.firstElementChild;

    if (!content) {
      throw new Error(`${id} markup has no root element`);
    }

    const remembered = get("windows.rememberGeometry")
      ? this.geometry[id]
      : null;

    const minwidth = app.minwidth || "300px";

    const minheight = app.minheight || "200px";

    const size = this.clampToViewport(
      {
        width:
          remembered?.width ?? app.width ?? `${get("windows.defaultWidth")}px`,
        height:
          remembered?.height ??
          app.height ??
          `${get("windows.defaultHeight")}px`,
      },
      { minwidth, minheight },
    );

    const position = this.clampToViewport(
      {
        x: remembered?.x,
        y: remembered?.y,
        width: size.width,
        height: size.height,
      },
      { minwidth, minheight },
    );

    let win = null;
    let ready = false;

    const lifecycle = (hook) => (payload) => {
      if (!ready) {
        return undefined;
      }

      return hook?.(content, win, payload);
    };

    win = new WinBox({
      title: app.title,

      width: size.width,
      height: size.height,

      minwidth,
      minheight,

      x: position.x ?? "center",

      y: position.y ?? "center",

      root: document.body,

      class: ["valcon-window", `valcon-window-${id}`],

      mount: content,

      onfocus: () => {
        content.dispatchEvent(new CustomEvent("windowfocus"));

        lifecycle(app.onFocus)?.();
      },

      onminimize: () => {
        content.dispatchEvent(new CustomEvent("windowminimize"));

        lifecycle(app.onMinimize)?.();
      },

      onmaximize: () => {
        content.dispatchEvent(new CustomEvent("windowmaximize"));

        lifecycle(app.onMaximize)?.();
      },

      onresize: () => {
        this.rememberWindow(id, win);

        lifecycle(app.onResize)?.();
      },

      onmove: () => {
        this.rememberWindow(id, win);
      },

      onclose: () => {
        const result = lifecycle(app.onClose)?.({ force: false });

        if (result === true) {
          return true;
        }

        this.rememberWindow(id, win);
        this.windows.delete(id);

        content.dispatchEvent(new CustomEvent("windowclose"));
        ready = false;

        return false;
      },
    });

    ready = true;
    this.windows.set(id, win);

    try {
      if (app.start) {
        await app.start(content, win, this);
      }
    } catch (error) {
      console.error(`Failed to start app ${id}:`, error);
      ready = false;
      this.windows.delete(id);
      win.close();

      throw error;
    }

    return win;
  }

  clampToViewport(size, limits = {}) {
    const rootWidth = document.documentElement.clientWidth;
    const rootHeight = document.documentElement.clientHeight;

    const output = { ...size };

    for (const axis of ["width", "height"]) {
      const viewport = axis === "width" ? rootWidth : rootHeight;
      const limit = limits[axis === "width" ? "minwidth" : "minheight"];

      const requested = toPixels(output[axis], viewport);
      const minimum = toPixels(limit, viewport);

      if (!Number.isFinite(requested)) continue;

      // A window cannot physically satisfy its minimum size when the
      // viewport itself is smaller than that minimum.
      const min = Number.isFinite(minimum)
        ? Math.min(minimum, viewport * 0.98)
        : 100;

      output[axis] =
        `${Math.round(Math.max(min, Math.min(requested, viewport * 0.98)))}px`;
    }

    if (Number.isFinite(output.x) && Number.isFinite(output.y)) {
      output.x = Math.max(
        0,
        Math.min(
          output.x,
          Math.max(0, rootWidth - toPixels(output.width, rootWidth)),
        ),
      );

      output.y = Math.max(
        0,
        Math.min(
          output.y,
          Math.max(0, rootHeight - toPixels(output.height, rootHeight)),
        ),
      );
    } else {
      output.x = null;
      output.y = null;
    }

    return output;
  }

  rememberWindow(id, win) {
    if (!get("windows.rememberGeometry")) {
      return;
    }

    try {
      this.geometry[id] = {
        width: win.width,
        height: win.height,
        x: win.x,
        y: win.y,
      };

      this.saveGeometry();
    } catch {}
  }

  forgetGeometry() {
    this.geometry = {};

    this.saveGeometry();
  }

  close(id) {
    this.windows.get(id)?.close();
  }

  focus(id) {
    this.windows.get(id)?.focus();
  }

  minimize(id) {
    this.windows.get(id)?.minimize();
  }

  maximize(id) {
    this.windows.get(id)?.maximize();
  }

  restore(id) {
    const win = this.windows.get(id);

    if (!win) return;

    win.restore?.();
    win.focus();
  }

  isOpen(id) {
    return this.windows.has(id);
  }

  list() {
    return Array.from(this.windows.keys());
  }

  closeAll() {
    for (const win of [...this.windows.values()]) {
      win.close();
    }
  }
}

export const appmanager = new AppManager();
