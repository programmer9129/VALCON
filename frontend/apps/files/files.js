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
      throw new Error("A name is required");
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

    return date.toLocaleDateString(undefined, {
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

    parts.forEach((parts, index) => {
      accumulated = joinPath(accumulated, path);
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
    }
  }
}
