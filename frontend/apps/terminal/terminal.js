import "./terminal.css";

import { get, on } from "../../core/settings-store.js";
import { apiUrl } from "../../api.js";

const COMMAND_ENDPOINT = "/json";
const PROMPT = "valcon $ ";

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

  function applySettings() {
    terminal.dataset.theme = get("terminal.theme");

    terminal.style.setProperty(
      "--terminal-font-size",
      `${get("terminal.fontSize")}px`,
    );

    terminal.style.setProperty(
      "--terminal-line-height",
      `${get("terminal.lineHeight")}`,
    );

    terminal.style.setProperty(
      "--terminal-font-weight",
      `${get("terminal.fontWeight")}`,
    );

    terminal.dataset.cursor = get("terminal.cursor");

    terminal.classList.toggle("cursor-blink", get("terminal.cursorBlink"));
  }

  function scroll() {
    terminal.scrollTop = terminal.scrollHeight;
  }

  function trimScrollback() {
    const limit = get("terminal.scrollback");
    const lines = output.querySelectorAll(":scope > .line");

    while (lines.length > limit) {
      lines[0].remove();
    }
  }

  function print(text) {
    const line = document.createElement("div");

    line.className = "line";
    line.textContent = text;

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
    scroll();
  }

  async function sendCommand(command) {
    const response = await fetch(`${apiUrl()}${COMMAND_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: "USER",
        path: "",
        command,
        terminal: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`server returned ${response.status}`);
    }

    return response.json();
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

    if (!command || processing) {
      return;
    }

    processing = true;

    if (command === "clear") {
      output.replaceChildren();
    } else {
      echo(command);

      try {
        const data = await sendCommand(command);

        if (data?.output) {
          print(data.output);
        }
      } catch (error) {
        print(`error: ${error.message}`);
      }
    }

    input.value = "";
    sync();

    processing = false;
    input.disabled = false;
    input.focus();
  }

  input.addEventListener("input", sync);
  input.addEventListener("click", sync);
  input.addEventListener("keyup", sync);

  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    void submit();
  });

  row.append(prompt, typed, cursor, after, input);

  output.appendChild(row);

  applySettings();
  scroll();
  input.focus();

  terminal.addEventListener("mousedown", () => {
    if (!get("terminal.copyOnSelect")) {
      input.focus();
    }
  });

  window.addEventListener("focus", () => {
    input.focus();
  });

  on("terminal.theme", applySettings);
  on("terminal.fontSize", applySettings);
  on("terminal.lineHeight", applySettings);
  on("terminal.fontWeight", applySettings);
  on("terminal.cursor", applySettings);
  on("terminal.cursorBlink", applySettings);

  print("VALCON terminal — type 'help' for commands.");
}
