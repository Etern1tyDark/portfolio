import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const blockedNames = new Set(['.git', '.gitmodules']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (blockedNames.has(entry.name)) {
      await rm(fullPath, { recursive: true, force: true });
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.png.png')) {
      await rm(fullPath, { force: true });
      continue;
    }

    if (entry.isDirectory()) {
      await walk(fullPath);
    }
  }
}

try {
  const info = await stat(distDir);
  if (info.isDirectory()) {
    await walk(distDir);
  }
} catch {
  // Dist may not exist if build failed; no-op in that case.
}
