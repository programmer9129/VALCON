// frontend/apps/terminal/terminal.js

import "./terminal.css";

import { get, on } from "../../core/settings-store.js";
import { apiUrl } from "../../api.js";
import { getAuth } from "../../auth.js";

const COMMAND_ENDPOINT = "/json";
const PROMPT = "valcon $ ";
const DEFAULT_SCROLLBACK = 1000;

export function startTerminal(root) {
  const terminal = root.matches(".terminal")
      ? root
      : root.querySelector(".terminal");

  if (!terminal) {
    console.error("Terminal markup is missing a .terminal root");
    return;
  }

  const output = terminal.querySelector(".output");

  if (!output) {
    console.error("Terminal markup is missing an .output element");
    return;
  }

  let processing = false;
  let currentPath = "";
  let disposed = false;

  function applySettings() {
    const theme = get("terminal.theme");
    const fontSize = Number(get("terminal.fontSize"));
    const lineHeight = Number(get("terminal.lineHeight"));
    const fontWeight = Number(get("terminal.fontWeight"));
    const cursor = get("terminal.cursor");
    const cursorBlink = Boolean(get("terminal.cursorBlink"));

    if (theme) {
      terminal.dataset.theme = theme;
    }

    if (Number.isFinite(fontSize) && fontSize > 0) {
      terminal.style.setProperty(
          "--terminal-font-size",
          `${fontSize}px`,
      );
    }

    if (Number.isFinite(lineHeight) && lineHeight > 0) {
      terminal.style.setProperty(
          "--terminal-line-height",
          String(lineHeight),
      );
    }

    if (Number.isFinite(fontWeight) && fontWeight > 0) {
      terminal.style.setProperty(
          "--terminal-font-weight",
          String(fontWeight),
      );
    }

    if (cursor) {
      terminal.dataset.cursor = cursor;
    }

    terminal.classList.toggle("cursor-blink", cursorBlink);
  }

  function scroll() {
    terminal.scrollTop = terminal.scrollHeight;
  }

  function trimScrollback() {
    const configured = Number(get("terminal.scrollback"));

    const limit =
        Number.isFinite(configured) && configured > 0
            ? Math.floor(configured)
            : DEFAULT_SCROLLBACK;

    while (output.children.length > limit) {
      output.firstElementChild?.remove();
    }
  }

  function print(value) {
    const line = document.createElement("div");

    line.className = "line";
    line.textContent = String(value ?? "");

    output.appendChild(line);

    trimScrollback();
    scroll();
  }

  function echo(command) {
    const line = document.createElement("div");
    const prompt = document.createElement("span");

    line.className = "line";
    prompt.className = "prompt";
    prompt.textContent = PROMPT;

    line.append(prompt, document.createTextNode(command));
    output.appendChild(line);

    trimScrollback();
    scroll();
  }

  function normalizePath(path) {
    return String(path || "")
        .replace(/\\/g, "/")
        .split("/")
        .filter((part) => part && part !== ".")
        .join("/");
  }

  async function sendCommand(command) {
    const auth = getAuth();

    if (!auth?.token) {
      throw new Error("You are not logged in.");
    }

    const base = String(
        apiUrl() ||
        (import.meta.env.DEV ? "http://localhost:3000" : ""),
    ).replace(/\/+$/, "");

    if (!base) {
      throw new Error(
          "Set the Node API URL in Settings or VITE_API_URL.",
      );
    }

    let response;

    try {
      response = await fetch(`${base}${COMMAND_ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          token: auth.token,
          profile: auth.profile || auth.username,
          cwd: currentPath,
          command,
          terminal: 0,
        }),
      });
    } catch {
      throw new Error(
          "Could not connect to the terminal server.",
      );
    }

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
          `The server returned an invalid response (${response.status}).`,
      );
    }

    if (!response.ok || data?.success === false) {
      throw new Error(
          data?.error ||
          data?.message ||
          `The server returned ${response.status}.`,
      );
    }

    if (typeof data.path === "string") {
      currentPath = normalizePath(data.path);
    }

    return data;
  }

  const row = document.createElement("div");
  const prompt = document.createElement("span");
  const typed = document.createElement("span");
  const cursor = document.createElement("span");
  const after = document.createElement("span");
  const input = document.createElement("input");

  row.className = "input";
  prompt.className = "prompt";
  typed.className = "typed";
  cursor.className = "cursor";
  after.className = "after";

  input.className = "cli";
  input.type = "text";
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Terminal input");

  prompt.textContent = PROMPT;

  function sync() {
    const position = input.selectionStart ?? input.value.length;

    typed.textContent = input.value.slice(0, position);
    after.textContent = input.value.slice(position);

    scroll();
  }

  async function submit() {
    const command = input.value.trim();

    if (!command || processing || disposed) {
      return;
    }

    processing = true;
    input.disabled = true;

    if (command === "clear") {
      output.replaceChildren();
    } else {
      echo(command);

      try {
        const data = await sendCommand(command);

        if (data.output !== undefined && data.output !== null) {
          print(data.output);
        }
      } catch (error) {
        print(`error: ${error.message || "Command failed."}`);
      }
    }

    input.value = "";
    sync();

    processing = false;
    input.disabled = false;

    if (!disposed) {
      input.focus();
    }
  }

  input.addEventListener("input", sync);
  input.addEventListener("click", sync);
  input.addEventListener("keyup", sync);

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submit();
    }
  });

  row.append(prompt, typed, cursor, after, input);
  terminal.appendChild(row);

  applySettings();
  scroll();
  input.focus();

  const focusHandler = () => {
    if (!disposed && !input.disabled) {
      input.focus();
    }
  };

  terminal.addEventListener("mousedown", () => {
    if (!get("terminal.copyOnSelect")) {
      input.focus();
    }
  });

  window.addEventListener("focus", focusHandler);

  const unsubscribe = [
    on("terminal.theme", applySettings),
    on("terminal.fontSize", applySettings),
    on("terminal.lineHeight", applySettings),
    on("terminal.fontWeight", applySettings),
    on("terminal.cursor", applySettings),
    on("terminal.cursorBlink", applySettings),
  ].filter((fn) => typeof fn === "function");

  print("VALCON terminal — type 'help' for commands.");

  return {
    clear() {
      output.replaceChildren();
    },

    focus() {
      input.focus();
    },

    getPath() {
      return currentPath;
    },

    async execute(command) {
      input.value = String(command || "");
      sync();
      await submit();
    },

    dispose() {
      disposed = true;

      window.removeEventListener("focus", focusHandler);

      for (const unsubscribeHandler of unsubscribe) {
        unsubscribeHandler();
      }

      row.remove();
    },
  };
}