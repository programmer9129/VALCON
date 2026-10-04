import "@awesome.me/webawesome/dist/styles/webawesome.css";
import "@awesome.me/webawesome/dist/components/page/page.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/tooltip/tooltip.js";

import { startMusic } from "./apps/music/music.js";
import { AppManager } from "./app-manager.js";
import { bootAuth } from "./auth.js";
import { startTerminal } from "./apps/terminal/terminal.js";
import { startSettings } from "./apps/settings/settings.js";

import "./apps/terminal/terminal.css";
import "./apps/settings/settings.css";

async function boot() {
  await bootAuth();

  const app = document.getElementById("app");

  app.style.display = "";

  const terminalApp = document.getElementById("terminalApp");
  const settingsApp = document.getElementById("settingsApp");
  const musicApp = document.getElementById("musicApp");
  const dock = document.getElementById("dock");
  const apps = new AppManager();

  const savedWallpaper = localStorage.getItem("wallpaper");

  if (savedWallpaper) {
    document.getElementById("wallpaper").style.backgroundImage =
      `linear-gradient(rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.25)), url("${savedWallpaper}")`;
  }

  let dockHidden = false;

  apps.register({
    id: "terminal",
    title: "Terminal",
    html: "./apps/terminal/terminal.html",
    width: "700px",
    height: "450px",
    single: true,
    start: startTerminal,
  });

  apps.register({
    id: "settings",
    title: "Settings",
    html: "./apps/settings/settings.html",
    width: "650px",
    height: "500px",
    single: true,
    start: startSettings,
  });

  apps.register({
    id: "music",
    title: "Music",
    html: "./apps/music/music.html",
    width: "520px",
    height: "620px",
    single: true,
    start: startMusic,
  });

  terminalApp.addEventListener("click", () => {
    apps.open("terminal");
  });

  settingsApp.addEventListener("click", () => {
    apps.open("settings");
  });

  musicApp.addEventListener("click", () => {
    apps.open("music");
  });

  function toggleDock() {
    dockHidden = !dockHidden;
    dock.classList.toggle("hidden", dockHidden);
  }
  function getShortcut(event) {
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
  function matchesShortcut(event) {
    const saved = localStorage.getItem("dock-shortcut") || "Super + D";
    return getShortcut(event) === saved;
  }

  window.addEventListener("keydown", (event) => {
    if (matchesShortcut(event)) {
      event.preventDefault();
      toggleDock();
    }
  });

  window.addEventListener("dock-shortcut-change", () => {
    dockHidden = false;
    dock.classList.remove("hidden");
  });
}

boot();
