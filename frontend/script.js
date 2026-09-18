import "@awesome.me/webawesome/dist/styles/webawesome.css";
import "@awesome.me/webawesome/dist/components/page/page.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/tooltip/tooltip.js";
import "@awesome.me/webawesome/dist/components/dialog/dialog.js";

const tabs = document.getElementById("terminalTabs");
const output = document.getElementById("output");
const newTerminal = document.getElementById("newTerminal");
const settingsButton = document.getElementById("settingsButton");
const settings = document.getElementById("settingsDialog");
const closeSettings = document.getElementById("closeSettings");
const con = document.getElementById("connectionText");
const shell = document.getElementById("currentShell");
const version = document.getElementById("valconVersion");
const clock = document.getElementById("clock");

const backend = "http://localhost:8080/json";

let terminals = [];
let activeTerminal = null;
let currentInput = null;
let processing = false;

document.addEventListener("click", (event) => {
  if (
    !event.target.closest(
      "#settingsButton, #closeSettings, #newTerminal, .tab, wa-dialog",
    )
  ) {
    currentInput?.focus();
  }
});

settingsButton.onclick = () => {
  settings.open = true;
};

closeSettings.onclick = () => {
  settings.open = false;
};

newTerminal.onclick = createTerminal;

function updateClock() {
  clock.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

updateClock();
setInterval(updateClock, 1000);

function createTerminal() {
  const terminal = {
    id: Date.now(),
    name: `Shell ${terminals.length + 1}`,
    history: [
      "Welcome to VALCON_WEB_TERMINAL",
      "Type 'help' if you need any commands..",
    ],
  };

  terminals.push(terminal);
  createTab(terminal);
  switchTerminal(terminal.id);
}

function createTab(terminal) {
  const tab = document.createElement("button");
  const name = document.createElement("span");
  const close = document.createElement("span");

  tab.className = "tab";
  tab.id = `tab-${terminal.id}`;
  tab.type = "button";

  name.className = "tab-name";
  name.textContent = terminal.name;

  close.className = "close";
  close.textContent = "×";

  tab.append(name, close);
  tabs.appendChild(tab);

  tab.onclick = (event) => {
    if (event.target === close) {
      closeTerminal(terminal.id);
    } else {
      switchTerminal(terminal.id);
    }
  };
}

function switchTerminal(id) {
  activeTerminal = id;

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("active");
  });

  document.getElementById(`tab-${id}`)?.classList.add("active");

  const terminal = terminals.find((t) => t.id === id);

  if (!terminal) return;

  output.innerHTML = "";
  terminal.history.forEach(print);

  shell.textContent = terminal.name;

  createInput();
}

function closeTerminal(id) {
  if (terminals.length === 1) return;

  const index = terminals.findIndex((t) => t.id === id);

  terminals = terminals.filter((t) => t.id !== id);

  document.getElementById(`tab-${id}`)?.remove();

  updateTerminalNames();

  if (activeTerminal === id) {
    switchTerminal(terminals[Math.max(0, index - 1)].id);
  }
}

function updateTerminalNames() {
  terminals.forEach((terminal, index) => {
    terminal.name = `Shell ${index + 1}`;

    const name = document
      .getElementById(`tab-${terminal.id}`)
      ?.querySelector(".tab-name");

    if (name) {
      name.textContent = terminal.name;
    }
  });

  const terminal = terminals.find((t) => t.id === activeTerminal);

  if (terminal) {
    shell.textContent = terminal.name;
  }
}

function print(text) {
  const line = document.createElement("div");

  line.style.whiteSpace = "pre-wrap";
  line.textContent = text;

  output.appendChild(line);

  const terminal = document.getElementById("terminal");

  terminal.scrollTop = terminal.scrollHeight;
}

async function sendCommand(command) {
  const response = await fetch(backend, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      terminal: activeTerminal,
      command,
    }),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  return response.json();
}

function createInput() {
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

  prompt.textContent = "user@valcon:~$ ";

  row.append(prompt, typed, cursor, after, input);

  output.appendChild(row);

  function updateInput() {
    const position = input.selectionStart ?? input.value.length;

    typed.textContent = input.value.slice(0, position);

    after.textContent = input.value.slice(position);
  }

  input.addEventListener("input", updateInput);
  input.addEventListener("keyup", updateInput);
  input.addEventListener("click", updateInput);

  input.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter" || processing) return;

    const command = input.value.trim();

    if (!command) return;

    processing = true;
    input.disabled = true;

    const terminal = terminals.find((t) => t.id === activeTerminal);

    if (terminal) {
      terminal.history.push(`user@valcon:~$ ${command}`);
    }

    if (command === "clear") {
      if (terminal) {
        terminal.history = [];
      }

      output.innerHTML = "";

      processing = false;
      createInput();

      return;
    }

    try {
      const data = await sendCommand(command);
      const response = data.output ?? "";

      if (terminal) {
        terminal.history.push(response);
      }

      print(response);
    } catch (error) {
      const message = `Something went wrong in the backend: ${error.message}`;

      if (terminal) {
        terminal.history.push(message);
      }

      print(message);
    }

    cursor.remove();

    processing = false;
    createInput();
  });

  currentInput = input;
  input.focus();

  const terminal = document.getElementById("terminal");

  terminal.scrollTop = terminal.scrollHeight;
}

con.textContent = "Connected";
version.textContent = "VALCON v0.1";

createTerminal();
