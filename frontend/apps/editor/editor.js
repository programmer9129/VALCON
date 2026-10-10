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

    text.value = tab?.content ?? "";
    text.disabled = !tab;
    text.scrollTop = 0;
    text.scrollLeft = 0;

    syncGutter();
    syncStatus();
    updateDirtyUI();
  }

  function countLines(value) {
    let count = 1;

    for (let i = 0; i < value.length; i++) {
      if (value.charCodeAt(i) === 10) count++;
    }
    return count;
  }

  function syncGutter() {
    const lines = countLines(text.value);

    if (lines !== lineCount) {
      lineCount = lines;
      gutter.textContent = Array.from(
        { length: lines },
        (_, index) => index + 1,
      ).join("\n");
    }
    gutter.style.transform = `translateY(${-text.scrollTop}px)`;
  }

  function syncStatus() {
    const tab = activeTab();

    if (!tab) {
      pathEl.textContent = "No file open";
      metaEl.textContent = "";
      return;
    }

    const before = text.value.slice(0, text.selectionStart);
    const row = countLines(before);
    const lastNewLine = before.lastIndexOf("\n");
    const col = before.length - lastNewLine;

    pathEl.textContent = tab.path;
    metaEl.textContent = `Ln ${row}, col ${col} · ${(text.value.length / 1024).toFixed(1)} KB`;
  }

  function markDirty() {
    const tab = activeTab();

    if (!tab) return;
    tab.content = text.value;
    tab.dirty = tab.content !== tab.savedContent;

    updateDirtyUI();
    syncGutter();
    syncStatus();
  }

  function showDialog(mode) {
    dialogMode = mode;
    dialogTitle.textContent = mode === "open" ? "Open file" : "Save file as";
    dialog.querySelector('[type="submit"]').textContent =
      mode === "open" ? "Open" : "Save";

    dialogPath.value = mode === "saveas" ? (activeTab()?.path ?? "") : "";

    dialogError.textContent = "";
    overlay.hidden = false;
    dialogPath.focus();
  }

  function hideDialog() {
    overlay.hidden = true;
    text.focus();
  }

  function validatePath(value) {
    const path = normalizePath(value.trim());

    if (!path) {
      throw new Error("Enter a file path.");
    }

    if (path.split("/").some((part) => part.length > 255)) {
      throw new Error("A path component is too long.");
    }

    return path;
  }

  async function openPath(rawPath) {
    const path = validatePath(rawPath);
    const existing = tabs.find((tab) => tab.path === path);

    if (existing) {
      activateTab(existing.id);
      return;
    }

    status("Opening...");

    const requestId = ++operationId;

    const response = await fs("read", { path });

    const result = response.result;

    if (requestId !== operationId || disposed) return;

    if (typeof result.content !== "string") {
      throw new FsError(
        "BAD_RESPONSE",
        "The server did not return text content bruh.",
        response.cwd,
      );
    }

    const byteLength = new TextEncoder().encode(result.content).byteLength;

    if (byteLength > MAX_BYTES) {
      throw new FsError(
        "TOO_LARGE",
        "This editor limits files to 2 MB. Use a larger-file editor for this file",
        response.cwd,
      );
    }

    const tab = {
      id: crypto.randomUUID(),
      path,
      name: basename(path),
      content: result.content,
      savedContent: result.content,
      etag: result.etag ?? null,
      dirty: false,
      warning: byteLength > WARN_BYTES,
    };

    tabs.push(tab);
    activateTab(tab.id);
    status(tab.warning ? "Large text file" : "File opened");
  }

  function confirmDiscard(message, onConfirm) {
    if (window.confirm(message)) onConfirm();
  }

  function closeTab(id) {
    const index = tabs.findIndex((tab) => tab.id === id);
    if (index === -1) return;

    const tab = tabs[index];

    const remove = () => {
      const wasActive = activeId === id;
      tabs.splice(index, 1);

      if (wasActive) {
        activeId = null;
        const next = tabs[Math.min(index, tabs.length - 1)];

        if (next) {
          activateTab(next.id);
        } else {
          text.value = "";
          text.disabled = true;
          syncGutter();
          syncStatus();
        }
      }
      renderTabs();
      updateDirtyUI();
      status("Tab closed");
    };

    if (tab.dirty) {
      confirmDiscard(`${tab.name} has unsaved changes. Wanna discard?`, remove);
    } else {
      remove();
    }
  }

  async function save(tab = activeTab(), asPath = null, overwrite = false) {
    if (!tab) {
      status("No file open");
      return;
    }
    const target = validatePath(asPath ?? tab.path);

    if (!tab.dirty && target === tab.path) {
      status("No changes to save");
      return;
    }

    const content = tab.content;
    status("Saving...");

    try {
      const { result }
    }
  }
}
