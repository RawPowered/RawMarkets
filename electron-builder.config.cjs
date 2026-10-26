const path = require("path");

const flavor = (process.env.RAWMARKETS_BUILD_FLAVOR || "portable-memory").trim();
const includeMemorySeed = flavor === "portable-memory";
const target =
  flavor === "nsis-clean"
    ? [{ target: "nsis", arch: ["x64"] }]
    : [{ target: "portable", arch: ["x64"] }];

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: "com.rawinvestor.rawmarkets",
  productName: "RawMarkets",
  directories: {
    output: "release",
  },
  files: [
    "dist/**/*",
    "electron/**/*",
    "python/**/*",
    "!python/.venv/**",
    "migrations/**/*",
    "scripts/ensure-runtime.mjs",
    "scripts/install-python.ps1",
    "scripts/install-ollama.ps1",
    "data/.gitkeep",
    "package.json",
    "node_modules/better-sqlite3/**/*",
    "node_modules/bindings/**/*",
    "node_modules/file-uri-to-path/**/*",
    "node_modules/playwright/**/*",
    "node_modules/playwright-core/**/*",
  ],
  asarUnpack: [
    "**/dist/**",
    "**/node_modules/better-sqlite3/**",
    "**/node_modules/bindings/**",
    "**/node_modules/file-uri-to-path/**",
    "**/node_modules/playwright/**",
    "**/node_modules/playwright-core/**",
    "**/python/**",
    "**/migrations/**",
  ],
  extraResources: includeMemorySeed
    ? [
        {
          from: "build-resources/portable-memory/data/rawmarkets.db",
          to: "seed-data/rawmarkets.db",
        },
      ]
    : [],
  win: {
    target,
    artifactName:
      flavor === "nsis-clean"
        ? "${productName}-Installer-Clean-${version}-${arch}.${ext}"
        : "${productName}-Portable-Memory-${version}-${arch}.${ext}",
  },
  portable: {
    artifactName: "${productName}-Portable-Memory-${version}-${arch}.${ext}",
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    artifactName: "${productName}-Installer-Clean-${version}-${arch}.${ext}",
  },
};

module.exports = config;
