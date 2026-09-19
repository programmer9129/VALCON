import "./terminal.css";

const backend = "http://localhost:8080/jsonRequest";

export function startTerminal(root) {
  root.innerHTML = `
    <div class="terminal">
      <div class="output"></div>
    </div>
  `;

  const terminal = root.querySelector(".terminal");
  const output = root.querySelector(".output");

  let processing = false;

  function scroll() {
    terminal.scrollTop = terminal.scrollHeight;
  }

  function print(text) {
    const line = document.createElement("div");

    line.style.whiteSpace = "pre-wrap";
    line.textContent = text;

    output.appendChild(line);
    scroll();
  }

  async function sendCommand(command) {
    const response = await fetch(backend, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: command,
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
      const pos = input.selectionStart ?? input.value.length;

      typed.textContent = input.value.slice(0, pos);
      after.textContent = input.value.slice(pos);
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

      if (command === "clear") {
        output.innerHTML = "";
        processing = false;
        createInput();
        return;
      }

      try {
        const data = await sendCommand(command);
        const result = data.output ?? "";

        if (result) {
          print(result);
        }
      } catch (error) {
        print(`Backend error: ${error.message}`);
      }

      cursor.remove();

      processing = false;
      createInput();
    });

    input.focus();
    scroll();
  }

  print("Welcome to VALCON_WEB_TERMINAL");
  print("Type 'help' if you need any commands..");

  createInput();
}
