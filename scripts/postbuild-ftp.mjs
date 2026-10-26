import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "deploy", "ftp");

const configExample = {
  apiBaseUrl: "http://127.0.0.1:3000",
  note: "Point to your PC API or an HTTPS tunnel URL when the FTP site uses HTTPS.",
};

fs.writeFileSync(
  path.join(out, "config.json"),
  JSON.stringify(configExample, null, 2),
  "utf-8"
);

const htaccess = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
`;

fs.writeFileSync(path.join(out, ".htaccess"), htaccess, "utf-8");

const readme = `RawMarkets — FTP static distribution
=====================================

Upload ALL files in this folder to your web host via FTP.

1. Edit config.json on the server (or before upload):
   - apiBaseUrl: URL of your RawMarkets API (Node server on your PC)
   - Example local: http://127.0.0.1:3000 (only works if visitors use YOUR machine — usually not)
   - Example remote: https://your-tunnel.example.com (ngrok, Cloudflare Tunnel, etc.)

2. On your PC, run the API:
   - npm run dev
   - or npm run launcher (Electron)
   - or npm run start (after npm run build)

3. Set CORS_ORIGINS in .env on the API machine:
   CORS_ORIGINS=https://your-ftp-site.com,http://your-ftp-site.com

4. HTTPS FTP sites require an HTTPS API URL (use a tunnel).

API keys and SQLite admin are LOCAL ONLY (not on FTP).
`;

fs.writeFileSync(path.join(out, "README.txt"), readme, "utf-8");

const examplePath = path.join(root, "deploy", "ftp", "config.json.example");
if (fs.existsSync(examplePath)) {
  fs.copyFileSync(examplePath, path.join(out, "config.json.example"));
}

console.log("[build:ftp] Wrote config.json, .htaccess, README.txt");
