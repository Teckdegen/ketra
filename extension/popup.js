const APP_URL = "http://127.0.0.1:3001/";
const frame = document.getElementById("app");

fetch(APP_URL)
  .then((response) => {
    if (!response.ok) throw new Error("down");
    frame.src = APP_URL;
  })
  .catch(() => {
    frame.remove();
    document.body.innerHTML = `<main><div><img src="icon.png" alt="Ketra" /><h1>Ketra</h1><p>The desktop app is not running yet. Start it, then open Ketra again.</p></div></main>`;
  });
