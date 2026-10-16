Desktop builds ship on GitHub Releases (files are too large for git):

https://github.com/Teckdegen/ketra/releases

Expected assets:

- `Ketra-macOS.zip`
- `Ketra-Windows.zip`
- `Ketra-linux.zip`

Build from `desktop app/`:

```bash
cd "desktop app"
npm install
npm run dist
npm run pack:web
```

Then upload the zips to the release with `gh release upload`.
