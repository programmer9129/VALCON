const tabs = document.getElementById("tabs");
const terminal = document.getElementById("terminal");
const output = document.getElementById("output");
const newT = document.getElementById("newTerminal");

let terminals = [];
let processing = false;
let activeTerminalId = null;
let currentInput = null;

// FIX: Changed 'input.focus()' to 'currentInput.focus()' to avoid ReferenceError
document.addEventListener("click", () => {
  if (currentInput) {
    currentInput.focus();
  }
});

newT.addEventListener("click", createTerminal);

function print(text) {
  const line = document.createElement("div");
  line.textContent = text;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function createTerminal() {
  const terminal = {
    id: Date.now(),
    name: `Shell ${terminals.length + 1}`,
    history: ["Welcome to WebOS", "Type 'help' if you need any commands.."],
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

  createInput();
}
function closeTerminal(id) {
  if (terminals.length === 1) {
    return;
  }
  const index = terminals.findIndex((t) => t.id === id);
  terminals = terminals.filter((t) => t.id !== id);

  const tab = document.getElementById(`tan-${id}`);

  if (tab) {
    tab.remove();
  }

  if (activeTerminalId === id) {
    const newI = Math.max(0, index - 1);
    switchTerminal(terminals[newI].id);
  }
}
async function sendCmd(cmd) {
  const res = await fetch("https://jsonplaceholder.typicode.com/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      terminal: activeTerminalId,
      command: cmd,
    }),
  });

  if (!res.ok) {
    throw new Error(`Server error: ${res.status}`);
  }

  const data = await res.json();
  return data;
}

function createInput() {
  const inputrow = document.createElement("div");
  inputrow.className = "input";

  const prompt = document.createElement("span");
  prompt.className = "prompt";
  prompt.textContent = "user@valcon:~$ ";

  const typed = document.createElement("span");
  typed.className = "typed";

  const cursor = document.createElement("span");
  cursor.className = "cursor";

  const input = document.createElement("input");
  input.className = "cli";
  input.type = "text";

  inputrow.appendChild(prompt);
  inputrow.appendChild(typed);
  inputrow.appendChild(cursor);
  inputrow.appendChild(input);

  output.appendChild(inputrow);

  input.addEventListener("input", () => {
    typed.textContent = input.value;
  });

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
      const responseText = JSON.stringify(data);

      if (activeTerm) {
        activeTerm.history.push(responseText);
      }

      print(responseText);
    } catch (err) {
      const errText = "Something went wrong in the backend";

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
createTerminal();
