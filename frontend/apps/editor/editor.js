// frontend/apps/editor/editor.js

import "./editor.css";

import {
  fs,
  FsError,
  basename,
  dirname,
  normalizePath,
} from "../../fs/client.js";

import { bus } from "../../core/bus.js";

const MAX_BYTES = 2 * 1024 * 1024;
const WARN_BYTES = 512 * 1024;

export function startEditor(root, win, appmanager) {
  const tabsEl = root.querySelector(".editor-tabs");
  const text = root.querySelector(".editor-text");
  const pathEl = root.querySelector(".editor-path");
  const badgeEl = root.querySelector(".editor-badge");
  const metaEl = root.querySelector(".editor-meta");
  const wrapBtn = root.querySelector(".editor-wrap-btn");
  const overlay = root.querySelector(".editor-overlay");
  const dialog = root.querySelector(".editor-dialog");
  const dialogTitle = root.querySelector(".editor-dialog-title");
  const dialogPath = root.querySelector(".editor-dialog-path");
  const dialogError = root.querySelector(".editor-dialog-error");
  const toolbarStatus = root.querySelector(".editor-toolbar-status");
  const picker = root.querySelector(".editor-picker");
  const pickerList = root.querySelector(".editor-picker-list");
  const pickerPathEl = root.querySelector(".editor-picker-path");
  const pickerUp = root.querySelector(".editor-picker-up");

  const tabs = [];
  let activeId = null;
  let wrap = false;
  let disposed = false;
  let dialogMode = "open";
  let operationId = 0;
  let pickerPath = "";
  let pickerRequest = 0;

  const activeTab = () => tabs.find((tab) => tab.id === activeId) || null;

  function status(message) {
    toolbarStatus.textContent = message;
  }

  function reportError(error) {
    console.error("[VALCON Editor]", error);
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

      const name = document.createElement("span");
      name.className = "editor-tab-name";
      name.textContent = tab.name;
      name.title = tab.path;

      const close = document.createElement("button");
      close.type = "button";
      close.className = "editor-tab-close";
      close.textContent = "×";
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

    syncTabStates();

    const add = document.createElement("button");
    add.type = "button";
    add.className = "editor-tab-add";
    add.textContent = "+";
    add.title = "Open file";
    add.setAttribute("aria-label", "Open file");
    add.addEventListener("click", () => showDialog("open"));

    tabsEl.appendChild(add);
  }

  function syncTabStates() {
    const nodes = tabsEl.querySelectorAll(".editor-tab");

    tabs.forEach((tab, index) => {
      const node = nodes[index];

      if (!node) return;

      const active = tab.id === activeId;

      node.classList.toggle("active", active);
      node.classList.toggle("dirty", tab.dirty);
      node.setAttribute("aria-selected", String(active));
    });
  }

  function commitActiveTab() {
    const tab = activeTab();

    if (tab) {
      tab.content = text.value;
      tab.dirty = tab.content !== tab.savedContent;
    }
  }

  function updateTitle() {
    const tab = activeTab();
    const dirty = tabs.some((item) => item.dirty);

    win.setTitle(
        `${tab ? `${tab.dirty ? "● " : ""}${tab.name}` : "Editor"}${
            dirty && !tab?.dirty ? " •" : ""
        } — VALCON`,
    );
  }

  function refreshDirtyIndicators() {
    const dirtyCount = tabs.filter((tab) => tab.dirty).length;

    badgeEl.hidden = dirtyCount === 0;
    badgeEl.textContent = dirtyCount ? `${dirtyCount} unsaved` : "";

    syncTabStates();
    updateTitle();
  }

  function updateDirtyUI() {
    renderTabs();
    refreshDirtyIndicators();
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

    syncStatus();
    updateDirtyUI();
  }

  function countLines(value) {
    let count = 1;

    for (let i = 0; i < value.length; i++) {
      if (value.charCodeAt(i) === 10) {
        count++;
      }
    }

    return count;
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
    const lastNewline = before.lastIndexOf("\n");
    const col = before.length - lastNewline;

    pathEl.textContent = tab.path;
    metaEl.textContent =
        `Ln ${row}, Col ${col} · ${(text.value.length / 1024).toFixed(1)} KB`;
  }

  function markDirty() {
    const tab = activeTab();

    if (!tab) return;

    tab.content = text.value;
    tab.dirty = tab.content !== tab.savedContent;

    refreshDirtyIndicators();
    syncStatus();
  }

  function pickerParent(path) {
    const clean = String(path || "").replace(/\/+$/, "");
    const index = clean.lastIndexOf("/");

    return index < 0 ? "" : clean.slice(0, index);
  }

  async function loadPicker(path) {
    const normalized = normalizePath(path);
    const requestId = ++pickerRequest;

    const loading = document.createElement("div");
    loading.className = "editor-picker-empty";
    loading.textContent = "Loading…";
    pickerList.replaceChildren(loading);

    try {
      const response = await fs("ls", { cwd: normalized });

      if (requestId !== pickerRequest || disposed) return;

      const result = response.result || {};
      const entries = Array.isArray(result.entries) ? result.entries : [];

      pickerPath = normalized;
      pickerPathEl.textContent = normalized ? `/${normalized}` : "/";
      pickerUp.disabled = !normalized;
      pickerList.replaceChildren();

      const dirs = entries.filter(
          (entry) => entry.kind === "dir" || entry.kind === "directory",
      );
      const files = entries.filter((entry) => entry.kind === "file");
      const items = [...dirs, ...files];

      if (items.length === 0) {
        const empty = document.createElement("div");

        empty.className = "editor-picker-empty";
        empty.textContent = "(empty directory)";
        pickerList.appendChild(empty);
        return;
      }

      for (const entry of items) {
        const isDir =
            entry.kind === "dir" || entry.kind === "directory";
        const item = document.createElement("button");

        item.type = "button";
        item.className = "editor-picker-item";
        item.dataset.dir = isDir ? "1" : "0";
        item.dataset.name = entry.name;
        item.textContent = `${isDir ? "📁" : "📄"} ${entry.name}`;

        item.addEventListener("click", () => {
          if (isDir) {
            const next = pickerPath
                ? `${pickerPath}/${entry.name}`
                : entry.name;

            loadPicker(next).catch(reportError);
            return;
          }

          dialogPath.value = pickerPath
              ? `${pickerPath}/${entry.name}`
              : entry.name;

          pickerList
              .querySelectorAll(".editor-picker-item.selected")
              .forEach((el) => el.classList.remove("selected"));

          item.classList.add("selected");
          dialogError.textContent = "";
        });

        pickerList.appendChild(item);
      }
    } catch (error) {
      if (requestId !== pickerRequest || disposed) return;

      pickerList.replaceChildren();

      const failed = document.createElement("div");

      failed.className = "editor-picker-empty";
      failed.textContent = error.message || "Could not list files.";
      pickerList.appendChild(failed);
    }
  }

  function showDialog(mode) {
    dialogMode = mode;

    const isOpen = mode === "open";

    dialogTitle.textContent =
        isOpen ? "Open file" : "Save file as";

    dialog.querySelector('[type="submit"]').textContent =
        isOpen ? "Open" : "Save";

    dialogPath.value =
        mode === "saveas" ? activeTab()?.path ?? "" : "";

    dialogError.textContent = "";
    picker.hidden = !isOpen;

    if (isOpen) {
      const tab = activeTab();
      const start = tab ? dirname(tab.path) : "";

      loadPicker(start).catch(reportError);
    }

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

    status("Opening…");

    const requestId = ++operationId;

    const response = await fs("read", { path });
    const result = response.result;

    if (requestId !== operationId || disposed) return;

    if (typeof result.content !== "string") {
      throw new FsError(
          "BAD_RESPONSE",
          "The server did not return text content.",
          response.cwd,
      );
    }

    const byteLength = new TextEncoder()
        .encode(result.content)
        .byteLength;

    if (byteLength > MAX_BYTES) {
      throw new FsError(
          "TOO_LARGE",
          "This editor limits files to 2 MB. Use a larger-file editor for this file.",
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
    if (window.confirm(message)) {
      onConfirm();
    }
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

          syncStatus();
        }
      }

      updateDirtyUI();
      status("Tab closed");
    };

    if (tab.dirty) {
      confirmDiscard(
          `${tab.name} has unsaved changes. Discard them?`,
          remove,
      );
    } else {
      remove();
    }
  }

  async function save(
      tab = activeTab(),
      asPath = null,
      overwrite = false,
  ) {
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

    status("Saving…");

    try {
      const { result } = await fs("write", {
        cwd: dirname(target),
        name: basename(target),
        content,
        etag: overwrite || target !== tab.path ? null : tab.etag,
        createOnly: target !== tab.path && !overwrite,
      });

      tab.path = target;
      tab.name = basename(target);
      tab.etag = result?.etag ?? null;
      tab.savedContent = content;
      tab.dirty = tab.content !== tab.savedContent;

      renderTabs();
      updateDirtyUI();
      syncStatus();

      status(
          tab.dirty
              ? "Saved snapshot; newer edits remain"
              : "Saved",
      );
    } catch (error) {
      if (error instanceof FsError && error.code === "CONFLICT") {
        confirmDiscard(
            `${target} changed on the server. Overwrite the server version?`,
            () => {
              save(tab, target, true).catch(reportError);
            },
        );

        return;
      }

      throw error;
    }
  }

  function insertText(value) {
    const start = text.selectionStart;
    const end = text.selectionEnd;

    text.setRangeText(value, start, end, "end");
    text.dispatchEvent(new Event("input", { bubbles: true }));
  }

  root
      .querySelector('[data-action="open"]')
      .addEventListener("click", () => showDialog("open"));

  root
      .querySelector('[data-action="save"]')
      .addEventListener("click", () => save().catch(reportError));

  root
      .querySelector('[data-action="save-as"]')
      .addEventListener("click", () => showDialog("saveas"));

  dialog.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const path = validatePath(dialogPath.value);

      if (dialogMode === "open") {
        await openPath(path);
      } else {
        const tab = activeTab();

        if (!tab) {
          throw new Error("Open a file before using Save As.");
        }

        await save(tab, path);
      }

      hideDialog();
    } catch (error) {
      dialogError.textContent = error.message;
    }
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      hideDialog();
    }
  });

  overlay
      .querySelector("[data-dismiss]")
      .addEventListener("click", hideDialog);

  pickerUp.addEventListener("click", () => {
    loadPicker(pickerParent(pickerPath)).catch(reportError);
  });

  text.addEventListener("input", markDirty);
  text.addEventListener("keyup", syncStatus);
  text.addEventListener("click", syncStatus);
  text.addEventListener("select", syncStatus);

  text.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      insertText("  ");
      return;
    }

    if (!(event.ctrlKey || event.metaKey)) return;

    const key = event.key.toLowerCase();

    if (key === "s" && event.shiftKey) {
      event.preventDefault();
      showDialog("saveas");
    } else if (key === "s") {
      event.preventDefault();
      save().catch(reportError);
    } else if (key === "w") {
      event.preventDefault();

      if (event.shiftKey) {
        requestClose();
      } else if (activeTab()) {
        closeTab(activeId);
      }
    }
  });

  wrapBtn.addEventListener("click", () => {
    wrap = !wrap;

    text.classList.toggle("wrap", wrap);
    wrapBtn.classList.toggle("active", wrap);
    wrapBtn.setAttribute("aria-pressed", String(wrap));
  });

  const offOpen = bus.on("editor:open", async ({ path } = {}) => {
    if (!path) return;

    try {
      await openPath(path);
    } catch (error) {
      reportError(error);
    }
  });

  function hasDirtyTabs() {
    commitActiveTab();

    return tabs.some((tab) => tab.dirty);
  }

  const baseOnClose = win.onclose;

  function release() {
    offOpen();
    disposed = true;
    win.onclose = baseOnClose;
  }

  function confirmClose() {
    return (
        !hasDirtyTabs() ||
        window.confirm("The editor has unsaved changes. Close it anyway?")
    );
  }

  function requestClose() {
    if (!confirmClose()) return;

    release();
    win.close();
  }

  win.onclose = (force) => {
    if (!confirmClose()) {
      return true;
    }

    release();

    return baseOnClose ? baseOnClose.call(win, force) : false;
  };

  text.disabled = true;

  renderTabs();
  syncStatus();
  updateTitle();

  return {
    openPath,
    save,
    requestClose,
    dispose: release,
  };
}