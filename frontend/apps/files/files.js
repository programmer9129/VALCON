import { fs } from "../../fs/client.js";
import { bus } from "../../core/bus.js";

export function startFiles(content, win, manager) {
  const root = content.querySelector(".files-app");

  if (!root) {
    throw new Error("Files app markup was not mounted correctly.");
  }

  const $ = (selector) => root.querySelector(selector);

  const list = $(".files-list");
  const breadcrumbs = $(".files-breadcrumbs");
  const search = $(".files-search");
  const empty = $(".files-empty");
  const errorBox = $(".files-error");
  const loading = $(".files-loading");
  const itemCount = $(".files-item-count");
  const currentPathLabel = $(".files-current-path");
  const renameButton = $('[data-action="rename"]');
  const deleteButton = $('[data-action="delete"]');
  const backButton = $('[data-action="back"]');
  const upButton = $('[data-action="up"]');

  let currentPath = "";
  let entries = [];
  let selectedName = null;
  let history = [];
  let historyIndex = -1;
  let requestId = 0;

  function normalizePath(path) {
    return String(path || "")
      .replaceAll("\\", "/")
      .split("/")
      .filter((part) => part && part !== ".")
      .join("/");
  }

  function joinPath(parent, child) {
    return [normalizePath(parent), normalizePath(child)]
      .filter(Boolean)
      .join("/");
  }

  function parentPath(path) {
    const parts = normalizePath(path).split("/").filter(Boolean);
    parts.pop();
    return parts.join("/");
  }

  function pathParts(path) {
    return normalizePath(path).split("/").filter(Boolean);
  }

  function displayPath(path) {
    return `/${normalizePath(path)}`;
  }

  function isDirectory(entry) {
    return entry.kind === "dir" || entry.kind === "directory";
  }

  function safeName(name) {
    const value = String(name || "").trim();

    if (!value) {
      throw new Error("A name is required.");
    }

    if (
      value === "." ||
      value === ".." ||
      value.includes("/") ||
      value.includes("\\") ||
      /[\u0000-\u001f]/.test(value)
    ) {
      throw new Error(
        "Use a single file or folder name. Slashes and special path names are not allowed.",
      );
    }

    return value;
  }

  function formatSize(bytes) {
    if (!Number.isFinite(Number(bytes)) || Number(bytes) < 0) {
      return "-";
    }

    const size = Number(bytes);

    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.hidden = true;
  }

  function updateControls() {
    const hasSelection = selectedName !== null;

    renameButton.disabled = !hasSelection;
    deleteButton.disabled = !hasSelection;

    backButton.disabled = historyIndex <= 0;
    upButton.disabled = !currentPath;
  }

  function updateBreadcrumbs() {
    breadcrumbs.replaceChildren();

    const parts = pathParts(currentPath);

    function addCrumb(label, path, last = false) {
      if (breadcrumbs.childElementCount > 0) {
        const separator = document.createElement("span");
        separator.className = "files-crumb-separator";
        separator.textContent = "/";
        breadcrumbs.append(separator);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "files-crumb";
      button.textContent = label;
      button.dataset.path = path;
      button.disabled = last;

      breadcrumbs.append(button);
    }

    addCrumb("Home", "", parts.length === 0);

    let accumulated = "";

    parts.forEach((part, index) => {
      accumulated = joinPath(accumulated, part);
      addCrumb(part, accumulated, index === parts.length - 1);
    });

    currentPathLabel.textContent = displayPath(currentPath);
    updateControls();
  }

  function visibleEntries() {
    const query = search.value.trim().toLocaleLowerCase();

    return entries
      .filter((entry) => entry.name.toLocaleLowerCase().includes(query))
      .sort((a, b) => {
        const aDir = isDirectory(a);
        const bDir = isDirectory(b);

        if (aDir !== bDir) return aDir ? -1 : 1;

        return a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }

  function renderEntries() {
    list.replaceChildren();

    const visible = visibleEntries();

    for (const entry of visible) {
      const directory = isDirectory(entry);
      const row = document.createElement("div");

      row.className = "files-entry";
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(entry.name === selectedName));
      row.tabIndex = 0;
      row.dataset.name = entry.name;

      if (entry.name === selectedName) {
        row.classList.add("selected");
      }

      const nameCell = document.createElement("span");
      nameCell.className = "files-entry-name";

      const icon = document.createElement("span");
      icon.className = "files-entry-icon";
      icon.textContent = directory ? "DIR" : "FILE";
      icon.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.className = "files-entry-label";
      label.textContent = entry.name;
      label.title = entry.name;

      nameCell.append(icon, label);

      const typeCell = document.createElement("span");
      typeCell.className = "files-entry-type";
      typeCell.textContent = directory ? "Folder" : "File";

      const sizeCell = document.createElement("span");
      sizeCell.className = "files-entry-size";
      sizeCell.textContent = directory ? "-" : formatSize(entry.size);

      const dateCell = document.createElement("span");
      dateCell.className = "files-entry-date";
      dateCell.textContent = formatDate(entry.updatedAt);

      row.append(nameCell, typeCell, sizeCell, dateCell);
      list.append(row);
    }

    empty.hidden = visible.length > 0;
    itemCount.textContent = `${visible.length} item${visible.length === 1 ? "" : "s"}`;

    updateControls();
  }

  async function loadDirectory(path = currentPath, options = {}) {
    const normalized = normalizePath(path);
    const thisRequest = ++requestId;

    clearError();
    loading.hidden = false;

    try {
      const response = await fs("list", {
        cwd: normalized,
      });

      if (thisRequest !== requestId) return;

      const result = response.result;

      if (!result || !Array.isArray(result.entries)) {
        throw new Error(
          "The filesystem API returned an unexpected directory listing.",
        );
      }

      currentPath = normalized;
      entries = result.entries.filter(
        (entry) =>
          entry &&
          typeof entry.name === "string" &&
          (entry.kind === "dir" ||
            entry.kind === "directory" ||
            entry.kind === "file"),
      );

      selectedName = null;

      if (options.pushHistory) {
        history = history.slice(0, historyIndex + 1);
        history.push(currentPath);
        historyIndex = history.length - 1;
      }

      updateBreadcrumbs();
      renderEntries();
    } catch (error) {
      if (thisRequest !== requestId) return;

      showError(error.message || "Could not load this folder.");
      list.replaceChildren();
      entries = [];
      selectedName = null;
      empty.hidden = true;
      itemCount.textContent = "Could not load folder";
      updateControls();
    } finally {
      if (thisRequest === requestId) {
        loading.hidden = true;
      }
    }
  }

  async function navigate(path) {
    await loadDirectory(path, { pushHistory: true });
  }

  async function goBack() {
    if (historyIndex <= 0) return;

    historyIndex -= 1;
    await loadDirectory(history[historyIndex]);
  }

  async function goUp() {
    if (!currentPath) return;

    await navigate(parentPath(currentPath));
  }

  async function refresh() {
    await loadDirectory(currentPath);
  }

  function selectEntry(name) {
    selectedName = name;
    renderEntries();
  }

  function selectedEntry() {
    return entries.find((entry) => entry.name === selectedName) || null;
  }

  async function createFile() {
    const rawName = prompt("New file name:");

    if (rawName === null) return;

    try {
      const name = safeName(rawName);

      if (entries.some((entry) => entry.name === name)) {
        throw new Error("An item with that name already exists.");
      }

      await fs("write", {
        cwd: currentPath,
        path: name,
        content: "",
      });

      await refresh();
      selectEntry(name);
    } catch (error) {
      showError(error.message || "Could not create the file.");
    }
  }

  async function createFolder() {
    const rawName = prompt("New folder name:");

    if (rawName === null) return;

    try {
      const name = safeName(rawName);

      if (entries.some((entry) => entry.name === name)) {
        throw new Error("An item with that name already exists.");
      }

      await fs("mkdir", {
        cwd: currentPath,
        path: name,
      });

      await refresh();
      selectEntry(name);
    } catch (error) {
      showError(error.message || "Could not create the folder.");
    }
  }

  async function renameSelected() {
    const entry = selectedEntry();

    if (!entry) return;

    const rawName = prompt("Rename to:", entry.name);

    if (rawName === null) return;

    try {
      const newName = safeName(rawName);

      if (newName === entry.name) return;

      if (entries.some((item) => item.name === newName)) {
        throw new Error("An item with that name already exists.");
      }

      await fs("mv", {
        cwd: currentPath,
        path: entry.name,
        target: newName,
      });

      selectedName = null;
      await refresh();
      selectEntry(newName);
    } catch (error) {
      showError(error.message || "Could not rename the item.");
    }
  }

  async function deleteSelected() {
    const entry = selectedEntry();

    if (!entry) return;

    const kind = isDirectory(entry) ? "folder" : "file";

    const confirmed = confirm(
      `Delete ${kind} "${entry.name}"?\n\nThis action may not be reversible.`,
    );

    if (!confirmed) return;

    try {
      await fs("rm", {
        cwd: currentPath,
        path: entry.name,
      });

      selectedName = null;
      await refresh();
    } catch (error) {
      showError(error.message || "Could not delete the item.");
    }
  }

  async function openFile(entry) {
    const path = joinPath(currentPath, entry.name);

    try {
      if (!manager?.apps?.has("editor")) {
        throw new Error(
          "The Editor app is not registered. Register it before opening files.",
        );
      }
      await manager.open("editor");

      bus.emit("editor:open", { path });
    } catch (error) {
      showError(error.message || "Could not open this file.");
    }
  }

  async function activateEntry(name) {
    const entry = entries.find((item) => item.name === name);

    if (!entry) return;

    if (isDirectory(entry)) {
      await navigate(joinPath(currentPath, entry.name));
      return;
    }

    await openFile(entry);
  }

  root.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-action]");

    if (actionButton && root.contains(actionButton)) {
      switch (actionButton.dataset.action) {
        case "back":
          await goBack();
          break;
        case "up":
          await goUp();
          break;
        case "refresh":
          await refresh();
          break;
        case "new-file":
          await createFile();
          break;
        case "new-folder":
          await createFolder();
          break;
        case "rename":
          await renameSelected();
          break;
        case "delete":
          await deleteSelected();
          break;
      }

      return;
    }

    const location = event.target.closest("[data-location]");

    if (location && root.contains(location)) {
      await navigate(location.dataset.location);
      return;
    }

    const crumb = event.target.closest("[data-path]");

    if (crumb && root.contains(crumb)) {
      await navigate(crumb.dataset.path);
      return;
    }

    const row = event.target.closest(".files-entry");

    if (row && root.contains(row)) {
      selectEntry(row.dataset.name);
    }
  });
  root.addEventListener("dblclick", async (event) => {
    const row = event.target.closest(".files-entry");

    if (!row || !root.contains(row)) return;

    await activateEntry(row.dataset.name);
  });

  root.addEventListener("keydown", async (event) => {
    const row = event.target.closest(".files-entry");

    if (!row || !root.contains(row)) return;

    if (event.key === "Enter") {
      event.preventDefault();
      await activateEntry(row.dataset.name);
    }
  });

  search.addEventListener("input", () => {
    renderEntries();
  });

  history = [""];
  historyIndex = 0;

  updateBreadcrumbs();
  updateControls();
  loadDirectory("");
}
