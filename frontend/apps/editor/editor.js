import "./editor.css";

import { fs, FsError, basename, normalizePath } from "../../fs/client.js";
import { bus } from "../../core/bus.js";

const MAX_BYTES = 2 * 1024 * 1024;
const WARN_BYTES = 512 * 1024;

export function startEditor(root, win, appmanager) {
  const tabsEl = root.querySelector(".editor-tabs");
  const gutter = root.querySelector(".editor-gutter-inner");
  const text = root.querySelector(".editor-text");
  const pathEl = root.querySelector(".editor-path");
  const badgeEl = root.querySelector(".editor-badge");
  const metaEl = root.querySelector(".editor-meta");
  const wrapEl = root.querySelector(".editor-wrap-btn");
  const overlay = root.querySelector(".editor-overlay");
  const dialog = root.querySelector(".editor-dialog");
  const dialogTitle = root.querySelector(".editor-dialog-title");
  const dialogPath = root.querySelector(".editor-dialog-path");
  const dialogError = root.querySelector(".editor-dialog-error");
  const toolbarStatus = root.querySelector(".editor-toolbar-status");

  const tabs = [];
  let activeId = null;
  let wrap = false;
  let disposed = false;
  let lineCount = 0;
  let dialogMode = "open";
  let operationId = 0;

  const activeTab = () => tabs.find((tab) => tab.id === activeId) || null;

  function status(message) {
    toolbarStatus.textContent = message;
  }

  function reportError(error) {
    consolve.error("[VALCON Editor]", error);
    status(error.message || "Operation failed");
  }

  function renderTabs() {
    tabsEl.replaceChildren();

    for (const tab of tabs) {
      const el = document.createElement("div");
      el.className = "editor-tab";
      el.classList.toggle("active", tab.id === activeId);
      el.classList.toggle("dirty", tab.dirty);
      el.setAttribute("role", "tab");
      el.setAttribute("aria-selected", String(tab.id === activeId));

      const name = document.createElement("name");
      name.className = "editor-tab-name";
      name.textContent = tab.name;
      name.title = tab.path;

      const close = documen.createElement("button");
      close.type = "button";
      close.className = "editor-tab-close";
      close.textContent = "x";
      close.title = `Close ${tab.name}`;
      close.setAttribute("aria-label", `Close ${tab.name}`);
      el.addEventListener("mousedown", (event) => {
        if (event.target !== close) event.preventDefault();
      });

      el.addEventListener("click", () => activateTab(tab.id));

      close.addEventListener("click", (event) => {
        event.stopPropagation();
        closeTab(tab.id);
      });

      el.append(name, close);
      tabsEl.appendChild(el);
    }
    const add = document.createElement("button");
    add.type = "button";
    add.className = "editor-tab-add";
    add.textContent = "+";
    add.title = "Open file";
    add.setAttribute("aria-label", "Open file");
    add.addEventListener("click", () => showDialog("open"));
    tabsEl.appendChild(add);
  }

  function commitActiveTab() {
    const tab = activeTab();
    if (tab) tab.content = text.value;
  }

  function updateTile() {
    const tab = activeTab();
    const dirty = tabs.some((item) => item.dirty);

    win.setTitle(
      `${tab ? `${tab.dirty ? "● " : ""}${tab.name}` : "Editor"}${dirty && !tab?.dirty ? " •" : ""} -- VALCON`,
    );
  }

  function updateDirtyUI() {
    const dirtyCount = tabs.filter((tab) => tab.dirty).length;
    badgeEl.hidden = dirtyCount === 0;
    badgeEl.textContent = dirtyCount ? `${dirtyCount} unsaved` : "";
    renderTabs();
    updateTitle();
  }

  function activateTab(id) {
    if (id === activeId) return;

    commitActiveTab();
    activeId = id;

    const tab = activeTab();
  }
}
