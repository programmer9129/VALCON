import "@awesome.me/webawesome/dist/styles/webawesome.css";

import "@awesome.me/webawesome/dist/components/page/page.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/tooltip/tooltip.js";

import { startmusic } from "./apps/music/music.js";
import { startterminal } from "./apps/terminal/terminal.js";
import { startSettings } from "./apps/settings/settings.js";

import { bootAuth } from "./auth.js";

import { appmanager } from "./app-manager.js";

import { get, set } from "./core/settings-store.js";

import { initTheme } from "./core/theme.js";

import "./apps/terminal/terminal.css";
import "./apps/settings/settings.css";
import "./apps/music/music.css";
import "./style.css";

async function boot() {
  initTheme();

  await bootAuth();

  const app = document.getElementById("app");

  if (!app) {
    throw new Error("#app not found");
  }

  app.style.display = "";

  const terminalApp = document.getElementById("terminalapp");

  const settingsApp = document.getElementById("settingsapp");

  const musicApp = document.getElementById("musicapp");

  const dock = document.getElementById("dock");

  appmanager.register({
    id: "terminal",
    title: "Terminal",
    html: "./apps/terminal/terminal.html",
    width: "700px",
    height: "450px",
    single: true,
    start: startterminal,
  });

  appmanager.register({
    id: "settings",
    title: "Settings",
    html: "./apps/settings/settings.html",
    width: "760px",
    height: "600px",
    single: true,
    start: startSettings,
  });

  appmanager.register({
    id: "music",
    title: "Music",
    html: "./apps/music/music.html",
    width: "560px",
    height: "650px",
    single: true,
    start: startmusic,
  });

  terminalApp?.addEventListener("click", () => {
    appmanager.open("terminal");
  });

  settingsApp?.addEventListener("click", () => {
    appmanager.open("settings");
  });

  musicApp?.addEventListener("click", () => {
    appmanager.open("music");
  });

  let dockHidden = false;

  function toggleDock() {
    dockHidden = !dockHidden;

    dock?.classList.toggle("hidden", dockHidden);
  }

  function normalizeKey(key) {
    return key.trim().toLowerCase();
  }

  function getShortcut(event) {
    const keys = [];

    if (event.metaKey) {
      keys.push("Super");
    }

    if (event.ctrlKey) {
      keys.push("Ctrl");
    }

    if (event.altKey) {
      keys.push("Alt");
    }

    if (event.shiftKey) {
      keys.push("Shift");
    }

    if (!["Meta", "Control", "Alt", "Shift"].includes(event.key)) {
      keys.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
    }

    return keys.join(" + ");
  }

  function matchesShortcut(event) {
    const saved = get("desktop.dockShortcut") || "Super + D";

    return normalizeKey(getShortcut(event)) === normalizeKey(saved);
  }

  window.addEventListener("keydown", (event) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target?.isContentEditable
    ) {
      return;
    }

    if (matchesShortcut(event)) {
      event.preventDefault();

      toggleDock();
    }
  });

  window.addEventListener("dock-shortcut-change", () => {
    dockHidden = false;

    dock?.classList.remove("hidden");
  });

  window.addEventListener("settings:change", (event) => {
    if (event.detail?.key === "desktop.dockPosition") {
      dock?.setAttribute("data-position", event.detail.value);
    }
  });

  if (dock) {
    dock.dataset.position = get("desktop.dockPosition");
  }
}

boot().catch((error) => {
  console.error("VALCON boot failed:", error);
});
