const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const APP_URL = "http://127.0.0.1:3001";
const appDir = path.resolve(__dirname, "..", "app");
let server = null;
let weStarted = false;

function ping() {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: "127.0.0.1", port: 3001, path: "/", method: "GET", timeout: 15000 },
      (res) => {
        res.resume();
        resolve(true);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureServer() {
  if (await ping()) return;
  weStarted = true;
  server = spawn("npm", ["run", "dev"], {
    cwd: appDir,
    stdio: "inherit",
    shell: true,
    windowsHide: true,
  });
  const started = Date.now();
  while (Date.now() - started < 120000) {
    if (await ping()) return;
    await sleep(500);
  }
  throw new Error("Ketra did not start.");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    title: "Ketra",
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#f4f4f4",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(APP_URL);
}

function stopServer() {
  if (!weStarted || !server) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], { windowsHide: true });
  } else {
    server.kill();
  }
  server = null;
}

app.whenReady().then(async () => {
  try {
    await ensureServer();
  } catch (error) {
    console.error(error);
  }
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});
