import "@awesome.me/webawesome/dist/styles/webawesome.css";
import "@awesome.me/webawesome/dist/components/page/page.js";
import "@awesome.me/webawesome/dist/components/icon/icon.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/tooltip/tooltip.js";

import WinBox from "winbox";
import "winbox/dist/css/winbox.min.css";

const terminalApp = document.getElementById("terminalApp");

async function openApp(path, title) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }

  const html = await response.text();

  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");

  const content = document.body.firstElementChild;

  const win = new WinBox({
    title,
    width: "700px",
    height: "450px",
    x: "center",
    y: "center",
    root: document.body,
    class: ["valcon-window"],
    mount: content,
  });

  return win;
}

terminalApp.addEventListener("click", () => {
  openApp("./apps/terminal/terminal.html", "Terminal");
});
