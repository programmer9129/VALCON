import "@awesome.me/webawesome/dist/styles/webawesome.css";

import "@awesome.me/webawesome/dist/components/page/page.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/tooltip/tooltip.js";

import terminalMarkup from "./apps/terminal/terminal.html?raw";
import settingsMarkup from "./apps/settings/settings.html?raw";
import musicMarkup from "./apps/music/music.html?raw";

import { startMusic } from "./apps/music/music.js";
import { startTerminal } from "./apps/terminal/terminal.js";
import { startSettings } from "./apps/settings/settings.js";

import { bootAuth } from "./auth.js";

import { appmanager } from "./app-manager.js";

import { get, on } from "./core/settings-store.js";

import { initTheme } from "./core/theme.js";

function shortcutFromEvent(event) {
  const keys = [];

  if (event.metaKey) keys.push("Super");
  if (event.ctrlKey) keys.push("Ctrl");
  if (event.altKey) keys.push("Alt");
  if (event.shiftKey) keys.push("Shift");

  if (!["Meta", "Control", "Alt", "Shift"].includes(event.key)) {
    keys.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
  }

  return keys.join(" + ");
}

function sameShortcut(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function isTypingTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable
  );
}

function applyDockSettings(dock) {
  if (!dock) return;

  const position = get("desktop.dockPosition");

  dock.dataset.position = position;
  dock.style.setProperty("--dock-size", `${get("desktop.dockSize")}px`);
  dock.style.setProperty("--dock-gap", `${get("desktop.dockGap")}px`);
  dock.style.setProperty(
    "--dock-opacity",
    `${get("desktop.dockOpacity") / 100}`,
  );
  dock.classList.toggle("auto-hidden", get("desktop.dockAutoHide"));
}

async function boot() {
  initTheme();

  await bootAuth();

  const app = document.getElementById("app");

  if (!app) {
    throw new Error("#app not found");
  }

  app.style.display = "";

  const dock = document.getElementById("dock");

  appmanager.register({
    id: "terminal",
    title: "Terminal",
    html: terminalMarkup,
    width: "700px",
    height: "450px",
    minwidth: "420px",
    minheight: "220px",
    single: true,
    start: startTerminal,
  });

  appmanager.register({
    id: "settings",
    title: "Settings",
    html: settingsMarkup,
    width: "760px",
    height: "600px",
    minwidth: "520px",
    minheight: "380px",
    single: true,
    start: startSettings,
  });

  appmanager.register({
    id: "music",
    title: "Music",
    html: musicMarkup,
    width: "560px",
    height: "650px",
    minwidth: "320px",
    minheight: "420px",
    single: true,
    start: startMusic,
  });

  const launch = (id) => {
    const win = document.getElementById(`${id}App`);

    win?.addEventListener("click", () => {
      appmanager.open(id).catch((error) => {
        console.error(`Could not open ${id}:`, error);
      });
    });
  };

  launch("terminal");
  launch("settings");
  launch("music");

  applyDockSettings(dock);

  let dockHidden = false;

  function toggleDock() {
    dockHidden = !dockHidden;

    dock?.classList.toggle("hidden", dockHidden);
  }

  window.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) {
      return;
    }

    if (sameShortcut(shortcutFromEvent(event), get("desktop.dockShortcut"))) {
      event.preventDefault();

      toggleDock();
    }
  });

  on("desktop.dockPosition", () => applyDockSettings(dock));
  on("desktop.dockSize", () => applyDockSettings(dock));
  on("desktop.dockGap", () => applyDockSettings(dock));
  on("desktop.dockOpacity", () => applyDockSettings(dock));
  on("desktop.dockAutoHide", () => applyDockSettings(dock));
  on("desktop.dockShortcut", () => {
    dockHidden = false;

    dock?.classList.remove("hidden");
  });
}

boot().catch((error) => {
  console.error("VALCON boot failed:", error);
});