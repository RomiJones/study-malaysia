import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const projectRoot = path.resolve(process.cwd());
const publicRoot = path.join(projectRoot, "apps", "web", "public");
const manifestPath = path.join(publicRoot, "assets", "static-html", "manifest.json");
const outputDir = path.join(projectRoot, "output", "playwright");
const screenshotPath = path.join(outputDir, "task036-static-assets-browser.png");
const successStatuses = new Set(["downloaded", "decoded", "extracted", "copied"]);

const contentTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"]
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isInsideDirectory(parent, child) {
  const relative = path.relative(parent, child);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function buildReviewPage(assets) {
  const cards = assets.map((asset) => `
    <article class="asset-card">
      <div class="asset-frame">
        <img
          src="${escapeHtml(asset.publicPath)}"
          alt="${escapeHtml(asset.referenceId)}"
          data-reference-id="${escapeHtml(asset.referenceId)}"
          data-local-path="${escapeHtml(asset.localPath)}"
        />
      </div>
      <div class="asset-meta">
        <strong>${escapeHtml(asset.referenceId)}</strong>
        <span>${escapeHtml(asset.purpose)} / ${escapeHtml(asset.mimeType)}</span>
        <span>${escapeHtml(asset.width ?? "?")} x ${escapeHtml(asset.height ?? "?")}</span>
      </div>
    </article>
  `).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TASK-036 Static HTML Assets</title>
  <style>
    body {
      margin: 0;
      background: #fafaf8;
      color: #0c0e1a;
      font-family: Arial, sans-serif;
    }
    main {
      max-width: 1180px;
      margin: 0 auto;
      padding: 24px;
    }
    h1 {
      margin: 0 0 16px;
      font-size: 24px;
      line-height: 1.25;
    }
    .asset-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 14px;
    }
    .asset-card {
      border: 1px solid #dedbd2;
      border-radius: 8px;
      background: #fff;
      overflow: hidden;
    }
    .asset-frame {
      display: grid;
      place-items: center;
      height: 132px;
      background: #f3f1ea;
    }
    img {
      max-width: 100%;
      max-height: 132px;
      object-fit: contain;
      display: block;
    }
    .asset-meta {
      display: grid;
      gap: 3px;
      padding: 10px;
      font-size: 12px;
      line-height: 1.35;
    }
  </style>
</head>
<body>
  <main>
    <h1>TASK-036 Static HTML Assets (${assets.length})</h1>
    <section class="asset-grid">
      ${cards}
    </section>
  </main>
</body>
</html>`;
}

async function sendFile(response, filePath) {
  const data = await fs.readFile(filePath);
  response.writeHead(200, {
    "Content-Type": contentTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
    "Content-Length": data.length
  });
  response.end(data);
}

function createServer(reviewHtml) {
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      if (requestUrl.pathname === "/" || requestUrl.pathname === "/task036-static-assets") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(reviewHtml);
        return;
      }

      const requestedPath = path.resolve(publicRoot, `.${decodeURIComponent(requestUrl.pathname)}`);
      if (!isInsideDirectory(publicRoot, requestedPath)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      await sendFile(response, requestedPath);
    } catch (error) {
      response.writeHead(404);
      response.end(error instanceof Error ? error.message : "Not found");
    }
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const assets = manifest.assets.filter((asset) => successStatuses.has(asset.status));
  if (assets.length === 0) {
    throw new Error("No successful static HTML assets found in manifest.");
  }

  const reviewHtml = buildReviewPage(assets);
  const server = await createServer(reviewHtml);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();

  const failedRequests = [];
  const externalRequests = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    page.on("request", (request) => {
      if (!request.url().startsWith(baseUrl)) {
        externalRequests.push(request.url());
      }
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.url()} ${request.failure()?.errorText || ""}`.trim());
    });

    await page.goto(`${baseUrl}/task036-static-assets`, { waitUntil: "networkidle" });
    await page.waitForLoadState("load");
    await fs.mkdir(outputDir, { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const imageResults = await page.evaluate(() => Array.from(document.images).map((image) => ({
      referenceId: image.dataset.referenceId,
      src: image.currentSrc || image.src,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight
    })));

    const brokenImages = imageResults.filter((image) =>
      !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0
    );

    if (externalRequests.length > 0 || failedRequests.length > 0 || brokenImages.length > 0) {
      throw new Error(JSON.stringify({ externalRequests, failedRequests, brokenImages }, null, 2));
    }

    console.log(JSON.stringify({
      checkedImages: imageResults.length,
      externalRequests,
      failedRequests,
      brokenImages,
      screenshot: path.relative(projectRoot, screenshotPath).split(path.sep).join("/")
    }, null, 2));
  } finally {
    await browser.close();
    await closeServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
