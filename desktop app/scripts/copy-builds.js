const fs = require("fs");
const path = require("path");

const dist = path.join(__dirname, "..", "dist");
const out = path.join(__dirname, "..", "..", "webpage", "public", "downloads");

const { execSync } = require("child_process");

fs.mkdirSync(out, { recursive: true });

function zipDir(sourceDir, destZip) {
  if (!fs.existsSync(sourceDir)) {
    console.log(`skip missing ${sourceDir}`);
    return;
  }
  if (fs.existsSync(destZip)) fs.rmSync(destZip);
  if (process.platform === "win32") {
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${sourceDir.replace(/'/g, "''")}\\*' -DestinationPath '${destZip.replace(/'/g, "''")}' -Force"`,
      { stdio: "inherit" },
    );
  } else {
    execSync(`cd "${sourceDir}" && zip -r "${destZip}" .`, { stdio: "inherit" });
  }
  console.log(`wrote ${path.basename(destZip)}`);
}

zipDir(path.join(dist, "win-unpacked"), path.join(out, "Ketra-Windows.zip"));
zipDir(path.join(dist, "linux-unpacked"), path.join(out, "Ketra-linux.zip"));
zipDir(path.join(dist, "mac"), path.join(out, "Ketra-macOS.zip"));
zipDir(path.join(dist, "mac-arm64"), path.join(out, "Ketra-macOS.zip"));
