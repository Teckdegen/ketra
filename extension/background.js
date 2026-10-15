const APP_URL = "http://127.0.0.1:3001/";
const MIN_WIDTH = 380;
const MIN_HEIGHT = 520;

chrome.action.onClicked.addListener(() => {
  openKetra();
});

chrome.windows.onBoundsChanged.addListener((win) => {
  remember(win);
});

async function openKetra() {
  const stored = await chrome.storage.local.get(["windowId", "bounds"]);
  if (stored.windowId != null) {
    try {
      await chrome.windows.get(stored.windowId);
      await chrome.windows.update(stored.windowId, { focused: true });
      return;
    } catch {
      /* The saved window was closed. */
    }
  }

  let url = APP_URL;
  try {
    const response = await fetch(APP_URL);
    if (!response.ok) url = chrome.runtime.getURL("offline.html");
  } catch {
    url = chrome.runtime.getURL("offline.html");
  }

  const bounds = stored.bounds || {};
  const options = {
    url,
    type: "popup",
    width: Math.max(bounds.width || 1040, MIN_WIDTH),
    height: Math.max(bounds.height || 720, MIN_HEIGHT),
    focused: true,
  };
  if (Number.isFinite(bounds.left)) options.left = bounds.left;
  if (Number.isFinite(bounds.top)) options.top = bounds.top;

  const created = await chrome.windows.create(options);
  if (created.id != null) await chrome.storage.local.set({ windowId: created.id });
}

async function remember(win) {
  const { windowId } = await chrome.storage.local.get("windowId");
  if (win.id !== windowId || win.width == null || win.height == null) return;

  const width = Math.max(win.width, MIN_WIDTH);
  const height = Math.max(win.height, MIN_HEIGHT);
  if (width !== win.width || height !== win.height) {
    await chrome.windows.update(win.id, { width, height });
  }

  await chrome.storage.local.set({
    bounds: { width, height, left: win.left, top: win.top },
  });
}
