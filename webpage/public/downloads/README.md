# Desktop download assets

Hosted on the GitHub release `v0.1.0` and redirected from `/api/download/{platform}`.

- `Ketra-Setup.exe` — Windows NSIS installer. Installs as **Ketra** with Start Menu + desktop shortcuts.
- `Ketra.deb` — Linux Debian/Ubuntu installer. Installs as **Ketra** in the app menu (`sudo dpkg -i Ketra.deb` or open the file).

Build locally:

```bash
cd "desktop app"
npm install
# Windows
set CSC_IDENTITY_AUTO_DISCOVERY=false
npx electron-builder --win nsis --x64
# Linux (on Linux)
npx electron-builder --linux deb --x64
```
