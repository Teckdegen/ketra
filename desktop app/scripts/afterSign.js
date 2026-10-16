const path = require("path");

const DESCRIPTION =
  "Quantum resistant wallet. Assets sit on a smart account. Only an MLDSA44 signature can move them. Live on Robinhood Chain.";

/** Run after asar integrity + sign so FileDescription sticks on Ketra.exe. */
exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== "win32") return;

  const exe = path.join(context.appOutDir, "Ketra.exe");
  const rcedit = require("rcedit");
  await rcedit(exe, {
    "version-string": {
      FileDescription: DESCRIPTION,
      ProductName: "Ketra",
      CompanyName: "Ketra",
      LegalCopyright: "Copyright © Ketra",
      OriginalFilename: "Ketra.exe",
    },
    "file-version": context.packager.appInfo.version,
    "product-version": context.packager.appInfo.version,
  });
};
