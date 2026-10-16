Desktop downloads are single app files on GitHub Releases:

- `Ketra-Windows.exe` — portable Windows app (double click to run)
- `Ketra-linux.AppImage` — Linux AppImage
- `Ketra-macOS.dmg` — macOS disk image

Get started serves them through `/api/download/{windows|linux|mac}`.

Build Windows locally:

```bash
cd "desktop app"
npm install
npm run dist:win
```

Linux AppImage and macOS DMG are built by `.github/workflows/desktop.yml`.
