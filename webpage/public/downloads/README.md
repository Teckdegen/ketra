# Desktop download assets

Hosted on the GitHub release `v0.1.0` and redirected from `/api/download/{platform}`.

- `Ketra-Setup.exe` — Windows NSIS installer. Installs as **Ketra** with Start Menu + desktop shortcuts.
- `Ketra-linux.AppImage` — Linux x64 AppImage

Build Windows locally:

```bash
cd "desktop app"
npm install
set CSC_IDENTITY_AUTO_DISCOVERY=false
npx electron-builder --win nsis --x64
```
