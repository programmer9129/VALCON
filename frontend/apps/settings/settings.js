export function startSettings(win) {
  const tabs = win.querySelectorAll(".settings-tab");
  const sections = win.querySelectorAll(".settings-section");
  const theme = win.querySelector("#terminalTheme");
  const wallInput = win.querySelector("#wallInput");
  const wallButton = win.querySelector("#wallButton");
  const wallStatus = win.querySelector("#wallStatus");

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

  theme.addEventListener("change", () => {
    localStorage.setItem("terminal-theme", theme.value);

    window.dispatchEvent(
      new CustomEvent("terminal-theme-change", {
        detail: theme.value,
      }),
    );
  });

  wallButton.addEventListener("click", () => {
    wallInput.click();
  });

  wallInput.addEventListener("change", async () => {
    const file = wallInput.files[0];

    if (!file) return;

    wallStatus.textContent = "Uploading...";

    const form = new FormData();
    form.append("wallpaper", file);

    try {
      const response = await fetch("/wallpaper", {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error("Backend rejected wallpaper");
      }

      document.getElementById("wallpaper").style.backgroundImage =
        `url("${result.url}")`;

      localStorage.setItem("wallpaper", result.url);
      wallStatus.textContent = "Wallpaper updated";
    } catch {
      wallStatus.textContent = "Cannot update wallpaper";
    }
  });

  const savedTheme = localStorage.getItem("terminal-theme");

  if (savedTheme) {
    theme.value = savedTheme;
  }
}
