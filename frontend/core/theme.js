import { get, set, onAny } from "./settings-store.js";

import defaultWallpaper from "../assets/background.jpg";

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
    theme: get("appearance.theme"),
    accent: get("appearance.accent"),
    fontScale: get("appearance.fontScale"),
    opacity: get("appearance.windowOpacity"),
    radius: get("appearance.windowRadius"),
    highContrast: get("appearance.highContrast"),
    monospace: get("appearance.monospace"),
    reduceMotion: get("appearance.reduceMotion"),
    reduceTransparency: get("appearance.reduceTransparency"),
  });

  html.dataset.theme = resolved;

  html.style.setProperty("--accent", get("appearance.accent"));

  const scale = get("appearance.fontScale");

  html.style.setProperty(
    "--ui-scale",
    `${Math.min(Math.max(scale, 80), 130) / 100}`,
  );

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

  try {
    applyWallpaper();
  } catch (error) {
    throw error;
  }
    htmlTheme: html.dataset.theme,
    accentVar: html.style.getPropertyValue("--accent"),
    scaleVar: html.style.getPropertyValue("--ui-scale"),
    htmlClasses: html.className,
    fontSizePx: getComputedStyle(html).fontSize,
  });
}

function applyWallpaper() {
  const wallpaper = get("appearance.wallpaper") || defaultWallpaper;
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

  try {
    applyTheme();
  } catch (error) {

    throw error;
  }
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
