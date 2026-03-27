import path from 'node:path';
import { createVSIX } from '@vscode/vsce';
import pkg from '../package.json' with { type: 'json' };

const outputFileName = `${pkg.name}-${pkg.version}.vsix`;
const outputPath = path.resolve(process.cwd(), outputFileName);

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