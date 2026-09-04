import { defineConfig } from "vite";
import { recognizeBuffer } from "./src/server/ocr.js";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let received = 0;

  for await (const chunk of request) {
    received += chunk.length;
    if (received > MAX_IMAGE_BYTES * 1.5) {
      throw new Error("Request exceeds the 12 MB local OCR limit.");
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function localOcrMiddleware() {
  return async (request, response) => {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Use POST for local OCR." });
      return;
    }

    try {
      const body = await readJson(request);
      const encoded = String(body.dataBase64 || "");
      const buffer = Buffer.from(encoded, "base64");

      if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
        throw new Error("Choose a non-empty image smaller than 12 MB.");
      }

      const result = await recognizeBuffer(buffer);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Local OCR failed."
      });
    }
  };
}

function localOcrPlugin() {
  const attach = (middlewares) => {
    middlewares.use("/api/ocr", localOcrMiddleware());
  };

  return {
    name: "codex-intake-local-ocr",
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    }
  };
}

export default defineConfig({
  plugins: [localOcrPlugin()],
  server: {
    strictPort: true,
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  },
  preview: {
    strictPort: true,
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  },
  build: {
    sourcemap: true
  }
});

