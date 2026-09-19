import WinBox from "winbox/src/js/winbox.js";
import "winbox/dist/css/winbox.min.css";

export class AppManager {
  constructor() {
    this.apps = new Map();
    this.windows = new Map();
  }

  register(app) {
    this.apps.set(app.id, app);
  }

  async open(id) {
    const app = this.apps.get(id);

    if (!app) {
      throw new Error(`App not found: ${id}`);
    }

    if (app.single && this.windows.has(id)) {
      this.windows.get(id).focus();
      return this.windows.get(id);
    }

    const response = await fetch(app.html);

    if (!response.ok) {
      throw new Error(`Failed to load ${app.html}`);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const content = doc.body.firstElementChild;

    const win = new WinBox({
      title: app.title,
      width: app.width ?? "700px",
      height: app.height ?? "450px",
      x: "center",
      y: "center",
      root: document.body,
      class: ["valcon-window"],
      mount: content,
      onclose: () => {
        this.windows.delete(id);
      },
    });

    if (app.start) {
      app.start(content);
    }

    this.windows.set(id, win);

    return win;
  }

  close(id) {
    this.windows.get(id)?.close();
  }

  focus(id) {
    this.windows.get(id)?.focus();
  }
}
