import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorker, OEM } from "tesseract.js";

const languageDirectory = fileURLToPath(new URL("../../vendor/ocr/", import.meta.url));
const cacheDirectory = fileURLToPath(new URL("../../.cache/tesseract/", import.meta.url));
let workerPromise;

async function ensureLanguageData() {
  await mkdir(cacheDirectory, { recursive: true });
  for (const language of ["eng", "chi_sim"]) {
    try {
      await stat(path.join(languageDirectory, `${language}.traineddata.gz`));
    } catch {
      throw new Error("Local OCR data is missing. Run `pnpm install` or `pnpm prepare:ocr` first.");
    }
  }
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      await ensureLanguageData();
      return createWorker(["eng", "chi_sim"], OEM.LSTM_ONLY, {
        langPath: languageDirectory,
        cachePath: cacheDirectory,
        cacheMethod: "none",
        gzip: true
      });
    })();
  }
  return workerPromise;
}

export async function recognizeBuffer(buffer) {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);
  return {
    text: String(data.text || "").trim(),
    confidence: Number.isFinite(data.confidence) ? Math.round(data.confidence * 10) / 10 : null,
    engine: "tesseract.js@6",
    languages: ["eng", "chi_sim"],
    processing: "local"
  };
}

export async function terminateOcrWorker() {
  if (!workerPromise) return;
  const worker = await workerPromise;
  workerPromise = undefined;
  await worker.terminate();
}
