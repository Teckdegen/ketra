const fs = require("fs");
const path = require("path");

const dist = path.join(__dirname, "..", "dist");
const out = path.join(__dirname, "..", "..", "webpage", "public", "downloads");

const files = ["Ketra-Windows.exe", "Ketra-linux.AppImage", "Ketra-macOS.dmg"];

fs.mkdirSync(out, { recursive: true });

for (const name of files) {
  const src = path.join(dist, name);
  if (!fs.existsSync(src)) {
    console.log(`skip missing ${name}`);
    continue;
  }
  fs.copyFileSync(src, path.join(out, name));
  console.log(`copied ${name}`);
}
