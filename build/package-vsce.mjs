import path from 'node:path';
import { createVSIX } from '@vscode/vsce';

const outputPath = path.resolve(process.cwd(), 'markdown-inline-excalidraw-1.0.0.vsix');

try {
  await createVSIX({
    cwd: process.cwd(),
    packagePath: outputPath,
  });

  console.log(path.basename(outputPath));
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}