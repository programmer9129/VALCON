import "@awesome.me/webawesome/dist/styles/webawesome.css";
import "@awesome.me/webawesome/dist/components/page/page.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/tooltip/tooltip.js";

import { AppManager } from "./app-manager.js";
import { startTerminal } from "./apps/terminal/terminal.js";
import { startSettings } from "./apps/settings/settings.js";

import "./apps/terminal/terminal.css";
import "./apps/settings/settings.css";

const terminalApp = document.getElementById("terminalApp");
const settingsApp = document.getElementById("settingsApp");

const apps = new AppManager();

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

terminalApp.addEventListener("click", () => {
  apps.open("terminal");
});

settingsApp.addEventListener("click", () => {
  apps.open("settings");
});
