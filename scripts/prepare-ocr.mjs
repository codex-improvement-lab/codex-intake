import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const targetDirectory = path.join(projectRoot, "vendor", "ocr");

async function findFile(directory, fileName) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === fileName) return candidate;
    if (entry.isDirectory()) {
      const nested = await findFile(candidate, fileName);
      if (nested) return nested;
    }
  }
  return null;
}

async function packageRoot(packageName) {
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch {
    let current = path.dirname(require.resolve(packageName));
    while (current !== path.dirname(current)) {
      try {
        const details = await stat(path.join(current, "package.json"));
        if (details.isFile()) return current;
      } catch {
        // Walk upward until the package root is found.
      }
      current = path.dirname(current);
    }
    throw new Error(`Could not locate ${packageName}.`);
  }
}

await mkdir(targetDirectory, { recursive: true });

for (const language of ["eng", "chi_sim"]) {
  const packageName = `@tesseract.js-data/${language}`;
  const root = await packageRoot(packageName);
  const source = await findFile(root, `${language}.traineddata.gz`);
  if (!source) throw new Error(`No trained data found in ${packageName}.`);
  await copyFile(source, path.join(targetDirectory, `${language}.traineddata.gz`));
}

process.stdout.write("Prepared local OCR data for eng + chi_sim.\n");

