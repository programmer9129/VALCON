import "@awesome.me/webawesome/dist/styles/webawesome.css";

import "@awesome.me/webawesome/dist/components/button/button.js";

import "./settings.css";

import {
  get,
  set,
  resetAll,
  exportJSON,
  importJSON,
  storageInfo,
} from "../../core/settings-store.js";

import { apiUrl } from "../../api.js";

import { appmanager } from "../../app-manager.js";

import {
  getAuth,
  getProfile,
  updateProfile,
  logout,
  resizeAvatar,
} from "../../auth.js";

function $(root, selector) {
  return root.querySelector(selector);
}

function $$(root, selector) {
  return [...root.querySelectorAll(selector)];
}

function bindValue(root, selector, key, event = "change") {
  const element = $(root, selector);

  if (!element) {
    return;
  }

  const update = () => {
    let value = element.value;

    if (element.type === "checkbox") {
      value = element.checked;
    }

    if (element.type === "number") {
      value = Number(value);
    }

    if (element.type === "range") {
      value = Number(value);
    }

    set(key, value);
  };

  element.addEventListener(event, update);

  const current = get(key);

  if (element.type === "checkbox") {
    element.checked = Boolean(current);
  } else {
    element.value = current;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function resizeWallpaper(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Please choose an image."));

      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Cannot read image."));
    };

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxWidth = 1920;

        const ratio = Math.min(1, maxWidth / image.width);

        const width = Math.round(image.width * ratio);

        const height = Math.round(image.height * ratio);

        const canvas = document.createElement("canvas");

        canvas.width = width;

        canvas.height = height;

        const ctx = canvas.getContext("2d");

        ctx.drawImage(image, 0, 0, width, height);

        resolve(canvas.toDataURL("image/webp", 0.8));
      };

      image.onerror = () => {
        reject(new Error("Invalid image."));
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

function setWallpaperPreview(root) {
  const preview = $(root, "#wallPreview");

  const wallpaper = get("appearance.wallpaper");

  if (!preview) return;

  if (!wallpaper) {
    preview.style.backgroundImage = "none";

    return;
  }

  preview.style.backgroundImage = `url("${wallpaper}")`;
}

function setupTabs(root) {
  const tabs = $$(root, ".settings-tab");

  const sections = $$(root, ".settings-section");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.section;

      tabs.forEach((item) => {
        item.classList.toggle("active", item === tab);
      });

      sections.forEach((section) => {
        section.classList.toggle("active", section.id === target);
      });
    });
  });
}

function setupAppearance(root) {
  bindValue(root, "#themeSelect", "appearance.theme");

  bindValue(root, "#accentInput", "appearance.accent");

  bindValue(root, "#wallFit", "appearance.wallpaperFit");

  bindValue(root, "#wallDim", "appearance.wallpaperDim", "input");

  bindValue(root, "#wallBlur", "appearance.wallpaperBlur", "input");

  bindValue(root, "#windowOpacity", "appearance.windowOpacity", "input");

  bindValue(root, "#windowRadius", "appearance.windowRadius", "input");

  bindValue(root, "#fontScale", "appearance.fontScale", "input");

  $$(root, "[data-accent]").forEach((button) => {
    button.addEventListener("click", () => {
      set("appearance.accent", button.dataset.accent);

      const input = $(root, "#accentInput");

      if (input) {
        input.value = button.dataset.accent;
      }
    });
  });

  const wallInput = $(root, "#wallInput");

  const wallButton = $(root, "#wallButton");

  const wallRemove = $(root, "#wallRemove");

  const wallStatus = $(root, "#wallStatus");

  wallButton?.addEventListener("click", () => wallInput?.click());

  wallInput?.addEventListener("change", async () => {
    const file = wallInput.files?.[0];

    if (!file) return;

    wallStatus.textContent = "Processing image...";

    try {
      const wallpaper = await resizeWallpaper(file);

      set("appearance.wallpaper", wallpaper);

      wallStatus.textContent = "Wallpaper updated.";

      setWallpaperPreview(root);
    } catch (error) {
      wallStatus.textContent = error.message;
    }

    wallInput.value = "";
  });

  wallRemove?.addEventListener("click", () => {
    set("appearance.wallpaper", "");

    wallStatus.textContent = "Wallpaper removed.";

    setWallpaperPreview(root);
  });

  setWallpaperPreview(root);
}

function setupDesktop(root) {
  bindValue(root, "#dockPosition", "desktop.dockPosition");

  bindValue(root, "#dockSize", "desktop.dockSize", "input");

  bindValue(root, "#dockGap", "desktop.dockGap", "input");

  bindValue(root, "#dockOpacity", "desktop.dockOpacity", "input");

  bindValue(root, "#dockAutoHide", "desktop.dockAutoHide");
}

function setupWindows(root) {
  bindValue(root, "#defaultWidth", "windows.defaultWidth");

  bindValue(root, "#defaultHeight", "windows.defaultHeight");

  bindValue(root, "#rememberGeometry", "windows.rememberGeometry");

  $(root, "#resetGeometry")?.addEventListener("click", () => {
    appmanager.forgetGeometry();
  });
}

function setupShortcut(root) {
  const button = $(root, "#dockShortcut");

  if (!button) return;

  const show = () => {
    button.textContent = get("desktop.dockShortcut");
  };

  show();

  button.addEventListener("click", () => {
    button.textContent = "Press keys...";

    const handler = (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        window.removeEventListener("keydown", handler, true);

        show();

        return;
      }

      const keys = [];

      if (event.metaKey) keys.push("Super");
      if (event.ctrlKey) keys.push("Ctrl");
      if (event.altKey) keys.push("Alt");
      if (event.shiftKey) keys.push("Shift");

      if (!["Meta", "Control", "Alt", "Shift"].includes(event.key)) {
        keys.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
      }

      if (keys.length < 2) {
        return;
      }

      set("desktop.dockShortcut", keys.join(" + "));

      window.removeEventListener("keydown", handler, true);

      show();
    };

    window.addEventListener("keydown", handler, true);
  });
}

function setupTerminal(root) {
  bindValue(root, "#terminalTheme", "terminal.theme");

  bindValue(root, "#terminalFontSize", "terminal.fontSize");

  bindValue(root, "#terminalLineHeight", "terminal.lineHeight");

  bindValue(root, "#terminalCursorBlink", "terminal.cursorBlink");

  bindValue(root, "#terminalCopySelect", "terminal.copyOnSelect");
}

function setupMusic(root) {
  bindValue(root, "#musicVolume", "music.volume", "input");

  bindValue(root, "#musicShuffle", "music.shuffle");

  bindValue(root, "#musicRepeat", "music.repeat");

  bindValue(root, "#musicAutoplay", "music.autoplay");

  bindValue(root, "#musicResume", "music.resume");

  $(root, "#clearMusicLibrary")?.addEventListener("click", () => {
    if (!confirm("Clear the local music library?")) {
      return;
    }

    localStorage.removeItem("valcon.music.library");

    location.reload();
  });
}

function setupNetwork(root) {
  bindValue(root, "#apiUrl", "network.apiUrl");

  bindValue(root, "#bridgeUrl", "network.bridgeUrl");

  bindValue(root, "#musicUploadUrl", "network.musicUploadUrl");

  bindValue(root, "#musicPlayUrl", "network.musicPlayUrl");

  $(root, "#networkTest")?.addEventListener("click", async () => {
    const status = $(root, "#networkStatus");

    const base = apiUrl();

    if (!base) {
      status.textContent = "No API URL configured.";

      return;
    }

    status.textContent = "Testing...";

    try {
      const controller = new AbortController();

      const timer = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(base, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timer);

      status.textContent = response.ok
        ? `Connected: ${response.status}`
        : `Server returned ${response.status}`;
    } catch {
      status.textContent = "Connection failed.";
    }
  });
}

function setupAccount(root) {
  const auth = getAuth();

  const profile = getProfile();

  if (!auth || !profile) {
    return;
  }

  $(root, "#accountUsername").textContent = auth.username;

  $(root, "#displayName").value = profile.displayName;

  $(root, "#accountBio").value = profile.bio;

  const since = new Date(profile.memberSince);

  $(root, "#accountMemberSince").textContent =
    `Member since ${since.toLocaleDateString()}`;

  const avatar = $(root, "#accountAvatar");

  if (profile.avatar) {
    avatar.src = profile.avatar;
  } else {
    avatar.removeAttribute("src");
  }

  const avatarInput = $(root, "#avatarInput");

  $(root, "#avatarButton")?.addEventListener("click", () =>
    avatarInput?.click(),
  );

  avatarInput?.addEventListener("change", async () => {
    const file = avatarInput.files?.[0];

    if (!file) return;

    try {
      const data = await resizeAvatar(file);

      updateProfile({
        avatar: data,
      });

      avatar.src = data;
    } catch (error) {
      alert(error.message);
    }

    avatarInput.value = "";
  });

  $(root, "#removeAvatar")?.addEventListener("click", () => {
    updateProfile({
      avatar: "",
    });

    avatar.removeAttribute("src");
  });

  $(root, "#saveProfile")?.addEventListener("click", () => {
    updateProfile({
      displayName: $(root, "#displayName").value.trim() || auth.username,

      bio: $(root, "#accountBio").value.trim(),
    });
  });

  $(root, "#logoutBtn")?.addEventListener("click", () => {
    logout();
  });
}

function setupStorage(root) {
  const stats = $(root, "#storageStats");

  function render() {
    const info = storageInfo();

    stats.innerHTML = `
      <div class="storage-stat">
        <strong>${formatBytes(info.bytes)}</strong>
        <span>Local settings storage</span>
      </div>
    `;
  }

  render();

  $(root, "#exportSettings")?.addEventListener("click", () => {
    const blob = new Blob([exportJSON()], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "valcon-settings.json";

    link.click();

    URL.revokeObjectURL(url);
  });

  const input = $(root, "#settingsFile");

  $(root, "#importSettings")?.addEventListener("click", () => input?.click());

  input?.addEventListener("change", async () => {
    const file = input.files?.[0];

    if (!file) return;

    try {
      const text = await file.text();

      importJSON(text);

      render();

      alert("Settings imported.");
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    }

    input.value = "";
  });

  $(root, "#resetSettings")?.addEventListener("click", () => {
    if (!confirm("Reset all VALCON settings?")) {
      return;
    }

    resetAll();

    location.reload();
  });
}

function setupAccessibility(root) {
  bindValue(root, "#reduceMotion", "appearance.reduceMotion");

  bindValue(root, "#reduceTransparency", "appearance.reduceTransparency");

  bindValue(root, "#highContrast", "appearance.highContrast");
}

function setupPrivacy(root) {
  $(root, "#clearLocalData")?.addEventListener("click", () => {
    if (!confirm("Clear VALCON local settings? Your account will remain.")) {
      return;
    }

    const keys = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key?.startsWith("valcon.settings.")) {
        keys.push(key);
      }
    }

    keys.forEach((key) => localStorage.removeItem(key));

    location.reload();
  });
}

function setupAbout(root) {
  $(root, "#runtimeInfo").textContent =
    `${navigator.platform} · ${navigator.language}`;
}

export function startSettings(win) {
  setupTabs(win);

  setupAppearance(win);
  setupDesktop(win);
  setupWindows(win);
  setupShortcut(win);
  setupTerminal(win);
  setupMusic(win);
  setupNetwork(win);
  setupAccount(win);
  setupStorage(win);
  setupAccessibility(win);
  setupPrivacy(win);
  setupAbout(win);
}
