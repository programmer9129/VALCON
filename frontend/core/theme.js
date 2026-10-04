import { get, set, onAny } from "./settings-store.js";

let mediaQuery = null;
let mediaListener = null;

function getResolvedTheme() {
  const theme = get("appearance.theme");

  if (theme === "light") {
    return "light";
  }

  if (theme === "dark") {
    return "dark";
  }

  if (!mediaQuery) {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  }

  return mediaQuery.matches ? "dark" : "light";
}

function applyTheme() {
  const html = document.documentElement;
  const resolved = getResolvedTheme();

  html.dataset.theme = resolved;

  html.style.setProperty("--accent", get("appearance.accent"));

  html.style.setProperty("--ui-scale", `${get("appearance.fontScale") / 100}`);

  html.style.setProperty(
    "--window-opacity",
    `${get("appearance.windowOpacity") / 100}`,
  );

  html.style.setProperty(
    "--window-radius",
    `${get("appearance.windowRadius")}px`,
  );

  html.classList.toggle("reduce-motion", get("appearance.reduceMotion"));

  html.classList.toggle(
    "reduce-transparency",
    get("appearance.reduceTransparency"),
  );

  html.classList.toggle("high-contrast", get("appearance.highContrast"));

  html.classList.toggle("monospace-ui", get("appearance.monospace"));

  applyWallpaper();
}

function applyWallpaper() {
  const wallpaper = get("appearance.wallpaper");
  const fit = get("appearance.wallpaperFit");
  const dim = get("appearance.wallpaperDim");
  const blur = get("appearance.wallpaperBlur");

  const element = document.getElementById("wallpaper");

  if (!element) {
    return;
  }

  element.style.setProperty("--wallpaper-dim", `${dim / 100}`);

  element.style.setProperty("--wallpaper-blur", `${blur}px`);

  element.style.backgroundImage = wallpaper ? `url("${wallpaper}")` : "none";

  element.style.backgroundSize =
    fit === "stretch"
      ? "100% 100%"
      : fit === "tile"
        ? "auto"
        : fit === "contain"
          ? "contain"
          : fit === "center"
            ? "auto"
            : "cover";

  element.style.backgroundRepeat = fit === "tile" ? "repeat" : "no-repeat";

  element.style.backgroundPosition = "center";
}

export function initTheme() {
  if (!mediaQuery) {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  }

  mediaListener = () => {
    if (get("appearance.theme") === "system") {
      applyTheme();
    }
  };

  mediaQuery.addEventListener?.("change", mediaListener);

  onAny((detail) => {
    if (detail.key.startsWith("appearance.")) {
      applyTheme();
    }
  });

  applyTheme();
}

export function setTheme(theme) {
  set("appearance.theme", theme);
}

export function setAccent(color) {
  set("appearance.accent", color);
}

export function applyCurrentTheme() {
  applyTheme();
}
