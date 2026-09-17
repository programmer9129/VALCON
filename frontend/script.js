const tabs = document.getElementById("tabs");
const terminal = document.getElementById("terminal");
const output = document.getElementById("output");
const newT = document.getElementById("newTerminal");

let terminals = [];
let processing = false;
let activeTerminalId = null;
let currentInput = null;

document.addEventListener("click", () => {
  if (currentInput) {
    currentInput.focus();
  }
});

newT.addEventListener("click", createTerminal);

function print(text) {
  const line = document.createElement("div");
  line.style.whiteSpace = "pre-wrap";
  line.textContent = text;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function createTerminal() {
  const terminal = {
    id: Date.now(),
    name: `Shell ${terminals.length + 1}`,
    history: ["Welcome to VALCON_WEB_TERMINAL", "Type 'help' if you need any commands.."],
  };

  terminals.push(terminal);
  createTab(terminal);
  switchTerminal(terminal.id);
}

function createTab(terminal) {
  const tab = document.createElement("button");
  tab.className = "tab";
  tab.id = `tab-${terminal.id}`;

  const name = document.createElement("span");
  name.className = "tab-name";
  name.textContent = terminal.name;

  const close = document.createElement("span");
  close.className = "close";
  close.textContent = "x";

  tab.appendChild(name);
  tab.appendChild(close);

  tab.addEventListener("click", (evnt) => {
    if (evnt.target === close) {
      closeTerminal(terminal.id);
      return;
    }
    switchTerminal(terminal.id);
  });

  tabs.insertBefore(tab, newT);
}

function switchTerminal(id) {
  activeTerminalId = id;

  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  const activeTab = document.getElementById(`tab-${id}`);
  if (activeTab) activeTab.classList.add("active");

  output.innerHTML = "";
  const activeTerm = terminals.find((t) => t.id === id);

  if (!activeTerm) {
    return;
  }

  activeTerm.history.forEach((line) => {
    print(line);
  });

  const statusOfShell = document.getElementById("currentShell");

  if (statusOfShell) {
    statusOfShell.textContent = activeTerm.name;
  }

  createInput();
}
function closeTerminal(id) {
  if (terminals.length === 1) {
    return;
  }
  const index = terminals.findIndex((t) => t.id === id);
  terminals = terminals.filter((t) => t.id !== id);

  const tab = document.getElementById(`tab-${id}`);

  if (tab) {
    tab.remove();
  }

  updateNameTerminal();

  if (activeTerminalId === id) {
    const newI = Math.max(0, index - 1);
    switchTerminal(terminals[newI].id);
  }
}
async function sendCmd(cmd) {
  const res = await fetch("https://valcon-r5ti.onrender.com/json", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
    },
    body: JSON.stringify({
      terminal: activeTerminalId,
      command: cmd,
    }),
  });

  if (!res.ok) {
    throw new Error(`Server error: ${res.status}`);
  }

  return await res.json();
}

function createInput() {
  const inputrow = document.createElement("div");
  inputrow.className = "input";

  const prompt = document.createElement("span");
  prompt.className = "prompt";
  prompt.textContent = "user@valcon:~$ ";

  const before = document.createElement("span");
  before.className = "typed";

  const after = document.createElement("span");
  after.className = "after";
  const cursor = document.createElement("span");
  cursor.className = "cursor";

  const input = document.createElement("input");
  input.className = "cli";
  input.type = "text";

  inputrow.appendChild(prompt);
  inputrow.appendChild(before);
  inputrow.appendChild(cursor);
  inputrow.appendChild(after);
  inputrow.appendChild(input);

  output.appendChild(inputrow);

  function updateVisualInput() {
    const position = input.selectionStart;
    before.textContent = input.value.slice(0, position);
    after.textContent = input.value.slice(position);
  }
  input.addEventListener("input", updateVisualInput);
  input.addEventListener("keyup", updateVisualInput);
  input.addEventListener("click", updateVisualInput);

  input.addEventListener("keydown", async (evnt) => {
    if (evnt.key !== "Enter" || processing) {
      return;
    }

    const command = input.value.trim();

    if (command === "") {
      return;
    }

    processing = true;

    const activeTerm = terminals.find((t) => t.id === activeTerminalId);

    if (activeTerm) {
      activeTerm.history.push(`user@valcon:~$ ${command}`);
    }

    if (command === "clear") {
      if (activeTerm) {
        activeTerm.history = [];
      }

      output.innerHTML = "";

      processing = false;
      createInput();

      return;
    }

    try {
      const data = await sendCmd(command);
      const responseText = data.output;

      if (activeTerm) {
        activeTerm.history.push(responseText);
      }

      print(responseText);
    } catch (err) {
      const errText = "Something went wrong in the backend" + err.message;

      if (activeTerm) {
        activeTerm.history.push(errText);
      }

      print(errText);
    }
    input.disabled = true;
    const oldC = inputrow.querySelector(".cursor");

    if (oldC) {
      oldC.remove();
    }
    processing = false;

    createInput();
  });

  currentInput = input;
  input.focus();

  output.scrollTop = output.scrollHeight;
}

function updateNameTerminal() {
  terminals.forEach((terminal, index) => {
    terminal.name = `Shell ${index + 1}`;

    const tab = document.getElementById(`tab-${terminal.id}`);

    if (tab) {
      const name = tab.querySelector(".tab-name");
      if (name) {
        name.textContent = terminal.name;
      }
    }
  });
}
createTerminal();
