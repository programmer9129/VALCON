import "./statusbar.css";

export function mountStatusBar(apps) {
  document.getElementById("valcon-statusbar")?.remove();
  document.getElementById("valcon-statusbar-menu")?.remove();

  const bar = document.createElement("header");
  bar.id = "valcon-statusbar";
  bar.innerHTML = `
    <div class="status-left">
      <button class="status-brand" data-action="menu" aria-label="Open VALCON menu">
        VALCON
      </button>
      <span class="status-workspace">Desktop</span>
    </div>

    <div class="status-clock" aria-live="off"></div>

    <div class="status-right">
      <button class="status-action" data-action="windows" title="Open applications">
        <span class="status-dot"></span>
        <span class="status-open-count">0</span>
        <span class="status-open-label">open</span>
      </button>
      <button class="status-action" data-action="menu" aria-label="Open app menu">
        <span>☰</span>
      </button>
    </div>
  `;

  const menu = document.createElement("div");
  menu.id = "valcon-statusbar-menu";
  menu.hidden = true;

  document.body.append(bar, menu);

  const clock = bar.querySelector(".status-clock");
  const count = bar.querySelector(".status-open-count");

  let menuMode = "all";

  function getOpenIds() {
    return typeof apps.list === "function" ? apps.list() : [];
  }

  function updateClock() {
    const now = new Date();

    clock.textContent = now.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function updateCount() {
    count.textContent = String(getOpenIds().length);
  }

  function addHeading(text) {
    const heading = document.createElement("div");
    heading.className = "status-menu-heading";
    heading.textContent = text;
    menu.append(heading);
  }

  function addDivider() {
    const divider = document.createElement("div");
    divider.className = "status-menu-divider";
    menu.append(divider);
  }

  function addButton(title, detail, action, id = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "status-menu-button";
    button.dataset.action = action;

    if (id) button.dataset.appId = id;

    const label = document.createElement("span");
    label.textContent = title;

    const meta = document.createElement("span");
    meta.className = "status-menu-meta";
    meta.textContent = detail;

    button.append(label, meta);
    menu.append(button);
  }

  function renderMenu() {
    menu.replaceChildren();

    const openIds = getOpenIds();
    const registeredApps = [...apps.apps.entries()];

    if (menuMode === "windows") {
      addHeading("Open applications");

      if (openIds.length === 0) {
        const empty = document.createElement("div");
        empty.className = "status-menu-empty";
        empty.textContent = "No applications are open.";
        menu.append(empty);
      } else {
        for (const id of openIds) {
          const app = apps.apps.get(id);

          addButton(app?.title || id, "Focus window", "focus", id);
        }
      }

      addDivider();
      addButton("All applications", "Open launcher", "all");
      return;
    }

    addHeading("VALCON");

    addButton("Desktop", "Your workspace", "desktop");

    addDivider();
    addHeading("Applications");

    for (const [id, app] of registeredApps) {
      const isOpen = openIds.includes(id);

      addButton(
        app.title || id,
        isOpen ? "Open · Focus" : "Launch",
        "launch",
        id,
      );
    }

    addDivider();
    addButton("Open windows", `${openIds.length} active`, "windows");
  }

  function showMenu(mode = "all") {
    menuMode = mode;
    renderMenu();
    menu.hidden = false;
  }

  function hideMenu() {
    menu.hidden = true;
  }

  async function handleAction(action, id) {
    switch (action) {
      case "menu":
        showMenu("all");
        break;

      case "windows":
        showMenu("windows");
        break;

      case "all":
        showMenu("all");
        break;

      case "desktop":
        hideMenu();
        break;

      case "launch":
        hideMenu();
        if (id && apps.apps.has(id)) {
          await apps.open(id);
          updateCount();
        }
        break;

      case "focus":
        hideMenu();
        if (id && apps.apps.has(id)) {
          await apps.focus(id);
          updateCount();
        }
        break;
    }
  }

  bar.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    try {
      await handleAction(button.dataset.action, button.dataset.appId);
    } catch (error) {
      console.error("VALCON status bar action failed:", error);
    }
  });

  menu.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    try {
      await handleAction(button.dataset.action, button.dataset.appId);
    } catch (error) {
      console.error("VALCON status bar action failed:", error);
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (menu.hidden) return;
    if (bar.contains(event.target) || menu.contains(event.target)) return;

    hideMenu();
  });

  updateClock();
  updateCount();

  const clockTimer = window.setInterval(updateClock, 15_000);
  const windowTimer = window.setInterval(updateCount, 1_000);

  return () => {
    window.clearInterval(clockTimer);
    window.clearInterval(windowTimer);
    bar.remove();
    menu.remove();
  };
}
