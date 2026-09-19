import "@awesome.me/webawesome/dist/styles/webawesome.css";
import "@awesome.me/webawesome/dist/components/page/page.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/select/select.js";
import "@awesome.me/webawesome/dist/components/option/option.js";
import "@awesome.me/webawesome/dist/components/tooltip/tooltip.js";

export function startSettings(win) {
  const tabs = win.querySelectorAll(".settings-tab");
  const sections = win.querySelectorAll(".settings-section");

  const theme = win.querySelector("#terminalTheme");

  const wallInput = win.querySelector("#wallInput");
  const wallButton = win.querySelector("#wallButton");
  const wallStatus = win.querySelector("#wallStatus");
  const wallPreview = win.querySelector("#wallPreview");

  const dockShortcut = win.querySelector("#dockShortcut");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const section = tab.dataset.section;

      tabs.forEach((item) => {
        item.classList.toggle("active", item === tab);
      });

      sections.forEach((item) => {
        item.classList.toggle("active", item.id === section);
      });
    });
  });

  const savedTheme = localStorage.getItem("terminal-theme");

  if (savedTheme) {
    theme.value = savedTheme;
  }

  theme.addEventListener("change", () => {
    localStorage.setItem("terminal-theme", theme.value);

    window.dispatchEvent(
      new CustomEvent("terminal-theme-change", {
        detail: theme.value,
      }),
    );
  });

  function setWallpaper(wallpaper) {
    const desktopWallpaper = document.getElementById("wallpaper");

    desktopWallpaper.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.25)), url("${wallpaper}")`;

    wallPreview.innerHTML = "";

    const image = document.createElement("img");

    image.src = wallpaper;
    image.alt = "Wallpaper preview";

    wallPreview.appendChild(image);
  }

  wallButton.addEventListener("click", () => {
    wallInput.click();
  });

  wallInput.addEventListener("change", () => {
    const file = wallInput.files[0];

    if (!file) return;

    const reader = new FileReader();

    wallStatus.textContent = "Loading...";

    reader.onload = () => {
      const wallpaper = reader.result;

      try {
        localStorage.setItem("wallpaper", wallpaper);
        setWallpaper(wallpaper);

        wallStatus.textContent = "Wallpaper updated";
      } catch {
        wallStatus.textContent = "Image is too large to store";
      }
    };

    reader.onerror = () => {
      wallStatus.textContent = "Cannot load wallpaper";
    };

    reader.readAsDataURL(file);
  });

  const savedShortcut = localStorage.getItem("dock-shortcut");

  if (savedShortcut) {
    dockShortcut.textContent = savedShortcut;
  }

  dockShortcut.addEventListener("click", () => {
    dockShortcut.textContent = "Press keys...";

    const handleKey = (event) => {
      event.preventDefault();

      const keys = [];

      if (event.metaKey) keys.push("Super");
      if (event.ctrlKey) keys.push("Ctrl");
      if (event.altKey) keys.push("Alt");
      if (event.shiftKey) keys.push("Shift");

      if (!["Meta", "Control", "Alt", "Shift"].includes(event.key)) {
        keys.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
      }

      if (keys.length < 2) return;

      const shortcut = keys.join(" + ");

      localStorage.setItem("dock-shortcut", shortcut);
      dockShortcut.textContent = shortcut;

      window.dispatchEvent(
        new CustomEvent("dock-shortcut-change", {
          detail: shortcut,
        }),
      );

      window.removeEventListener("keydown", handleKey);
    };

    window.addEventListener("keydown", handleKey);
  });
}
