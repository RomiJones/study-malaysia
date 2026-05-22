import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "apps", "admin", "dist");
const port = Number(process.env.ADMIN_PREVIEW_PORT || 3101);
const apiTarget = process.env.ADMIN_PREVIEW_API_TARGET || "http://127.0.0.1:3000";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end("Bad Request");
    return;
  }

  if (req.url.startsWith("/api")) {
    const targetUrl = new URL(req.url, apiTarget);
    const proxyReq = http.request(targetUrl, { method: req.method, headers: req.headers }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", (error) => {
      res.statusCode = 502;
      res.end(String(error));
    });
    req.pipe(proxyReq);
    return;
  }

  const requestPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  let filePath = path.join(root, requestPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(root, "index.html");
  }

  fs.readFile(filePath, (error, buffer) => {
    if (error) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }
    res.setHeader("Content-Type", mime[path.extname(filePath)] || "application/octet-stream");
    res.end(buffer);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Admin preview server running at http://127.0.0.1:${port}, proxying API to ${apiTarget}`);
});