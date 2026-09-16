const tabs = document.getElementById("tabs");
const terminal = document.getElementById("terminal");
const output = document.getElementById("output");
const input = document.getElementById("cli");
const newT = document.getElementById("newTerminal");

let terminals = [];

let activeTerminal = null;

newT.addEventListener("click", createTerminal);

input.addEventListener("keydown", async (evnt) => {
  if (evnt.key !== "Enter") {
    return;
  }

  const command = input.value.trim();

  if (command === "") {
    return;
  }

  if (command === "clear") {
    output.innerHTML = "";
  } else {
    print(`user@webos:~$ ${command}`);
    try {
      const data = await sendCmd(command);
      print(JSON.stringify(data));
    } catch (err) {
      print("Something went wrong in the backend");
    }
  }
  input.value = "";
});

function print(text) {
  const line = document.createElement("div");
  line.textContent = text;

  output.appendChild(line);
}

function createTerminal() {
  const terminal = {
    id: Date.now(),
    name: `Shell ${terminals.length + 1}`,
    history: [],
  };

  terminals.push(terminal);
  activeTerminal = terminal.id;
  createTab(terminal);
}

function createTab(terminal) {
  const tab = document.createElement("button");

  tab.className = "tab";
  tab.textContent = terminal.name;

  tab.addEventListener("click", () => {
    activeTerminal = terminal.id;
    console.log("Active:", terminal.name);
    print(`Switched to Terminal ${terminals.indexOf(terminal) + 1}`);
  });

  tabs.insertBefore(tab, newT);
}

async function sendCmd(cmd) {
  const res = await fetch("https://jsonplaceholder.typicode.com/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      terminal: activeTerminal,
      command: cmd,
    }),
  });

  if (!res.ok) {
    throw new Error(`Server error: ${res.status}`);
  }

  const data = await res.json();
  return data;
}
createTerminal();
print("Welcome to WebOS");
print("Type 'help' if you need any commands..");
