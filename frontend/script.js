import "@awesome.me/webawesome/dist/styles/webawesome.css";

import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/button/button.js";

import terminalMarkup from "./apps/terminal/terminal.html?raw";
import settingsMarkup from "./apps/settings/settings.html?raw";
import musicMarkup from "./apps/music/music.html?raw";
import editorMarkup from "./apps/editor/editor.html?raw";
import filesMarkup from "./apps/files/files.html?raw";

import "./apps/files/files.css";

import { startMusic } from "./apps/music/music.js";
import { startTerminal } from "./apps/terminal/terminal.js";
import { startSettings } from "./apps/settings/settings.js";
import { startEditor } from "./apps/editor/editor.js";
import { startFiles } from "./apps/files/files.js";

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
}

function setupDockAutoHide(dock) {
  if (!dock) return;

  const EDGE = 12;
  let revealed = false;
  let manualHidden = false;

  const autoHide = () => Boolean(get("desktop.dockAutoHide"));

  const nearEdge = (x, y) => {
    const rect = dock.getBoundingClientRect();
    const position = dock.dataset.position || "bottom";

    if (position === "top") {
      return y <= rect.bottom + EDGE;
    }

    if (position === "left") {
      return x <= rect.right + EDGE;
    }

    if (position === "right") {
      return x >= rect.left - EDGE;
    }

    return y >= rect.top - EDGE;
  };

  function render() {
    const hidden = manualHidden || (autoHide() && !revealed);

    dock.classList.toggle("hidden", hidden);
    dock.classList.toggle("revealed", revealed && autoHide() && !manualHidden);
  }

  function setRevealed(next) {
    if (next === revealed) return;

    revealed = next;
    render();
  }

  window.addEventListener(
    "mousemove",
    (event) => {
      if (!autoHide() || manualHidden) {
        setRevealed(false);
        return;
      }

      setRevealed(
        nearEdge(event.clientX, event.clientY) ||
          dock.contains(event.target),
      );
    },
    { passive: true },
  );

  dock.addEventListener("mouseleave", () => {
    if (autoHide()) setRevealed(false);
  });

  render();

  return {
    toggle() {
      manualHidden = !manualHidden;
      revealed = !manualHidden;

      render();
    },

    reset() {
      manualHidden = false;
      revealed = false;
      render();
    },

    update: render,
  };
}

async function boot() {
  initTheme();

  await bootAuth();

  const app = document.getElementById("app");

  if (!app) {
    throw new Error("#app not found");
  }

  app.hidden = false;

  const dock = document.getElementById("dock");

  applyDockSettings(dock);

  const dockController = setupDockAutoHide(dock);

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

  appmanager.register({
    id: "editor",
    title: "Editor",
    html: editorMarkup,
    width: "820px",
    height: "560px",
    minwidth: "420px",
    minheight: "240px",
    single: true,
    start: startEditor,
  });
  appmanager.register({
    id: "files",
    title: "Files",
    html: filesMarkup,
    width: "850px",
    height: "560px",
    minwidth: "500px",
    minheight: "300px",
    single: true,
    start: startFiles,
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
  launch("editor");
  launch("files");

  window.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) {
      return;
    }

    if (sameShortcut(shortcutFromEvent(event), get("desktop.dockShortcut"))) {
      event.preventDefault();

      dockController?.toggle();
    }
  });

  const applyAndRender = () => {
    applyDockSettings(dock);
    dockController?.update();
  };

  on("desktop.dockPosition", applyAndRender);
  on("desktop.dockSize", applyAndRender);
  on("desktop.dockGap", applyAndRender);
  on("desktop.dockOpacity", applyAndRender);
  on("desktop.dockAutoHide", applyAndRender);
  on("desktop.dockShortcut", () => dockController?.reset());
}

boot().catch((error) => {
  console.error("VALCON boot failed:", error);
});
