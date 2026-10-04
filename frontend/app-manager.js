import WinBox from "winbox/src/js/winbox.js";
import "winbox/dist/css/winbox.min.css";

import { get, set } from "./core/settings-store.js";

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

      existing.focus();

      return existing;
    }

    const response = await fetch(app.html);

    if (!response.ok) {
      throw new Error(`Failed to load ${app.html}`);
    }

    const html = await response.text();

    const parser = new DOMParser();

    const doc = parser.parseFromString(html, "text/html");

    const content = doc.body.firstElementChild;

    if (!content) {
      throw new Error(`${app.html} has no root element`);
    }

    const remembered = get("windows.rememberGeometry")
      ? this.geometry[id]
      : null;

    const width =
      remembered?.width || app.width || `${get("windows.defaultWidth")}px`;

    const height =
      remembered?.height || app.height || `${get("windows.defaultHeight")}px`;

    const win = new WinBox({
      title: app.title,

      width,
      height,

      x: remembered?.x ?? "center",

      y: remembered?.y ?? "center",

      root: document.body,

      class: ["valcon-window", `valcon-window-${id}`],

      mount: content,

      onfocus: () => {
        content.dispatchEvent(new CustomEvent("windowfocus"));

        app.onFocus?.(content, win);
      },

      onminimize: () => {
        content.dispatchEvent(new CustomEvent("windowminimize"));

        app.onMinimize?.(content, win);
      },

      onmaximize: () => {
        content.dispatchEvent(new CustomEvent("windowmaximize"));

        app.onMaximize?.(content, win);
      },

      onresize: () => {
        this.rememberWindow(id, win);

        app.onResize?.(content, win);
      },

      onmove: () => {
        this.rememberWindow(id, win);
      },

      onclose: () => {
        this.windows.delete(id);

        this.rememberWindow(id, win);

        app.onClose?.(content, win);
      },
    });

    try {
      if (app.start) {
        await app.start(content, win, this);
      }
    } catch (error) {
      console.error(`Failed to start app ${id}:`, error);

      win.close();

      throw error;
    }

    this.windows.set(id, win);

    return win;
  }

  rememberWindow(id, win) {
    if (!get("windows.rememberGeometry")) {
      return;
    }

    try {
      this.geometry[id] = {
        width: win.width || undefined,

        height: win.height || undefined,

        x: win.x || undefined,

        y: win.y || undefined,
      };

      this.saveGeometry();
    } catch {}
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
    for (const win of this.windows.values()) {
      win.close();
    }

    this.windows.clear();
  }
}

export const appmanager = new AppManager();
