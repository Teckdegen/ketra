const APP_URL = "https://wallet.ketra.network/";
const frame = document.getElementById("app");

fetch(APP_URL)
  .then((response) => {
    if (!response.ok) throw new Error("down");
    frame.src = APP_URL;
  })
  .catch(() => {
    frame.remove();
    document.body.innerHTML = `<main><div><img src="icon.png" alt="Ketra" /><h1>Ketra</h1><p>wallet.ketra.network did not answer. Check your connection and open Ketra again.</p></div></main>`;
  });
