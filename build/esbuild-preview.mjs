import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const rootDir = import.meta.dirname;
const srcDir = path.join(rootDir, '..', 'src');
const outDir = path.join(rootDir, '..', 'dist-preview');
const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');
const shouldEmitMetafile = process.argv.includes('--metafile');

const buildOptions = {
  bundle: true,
  entryPoints: {
    'index.bundle': path.join(srcDir, 'markdownPreview', 'index.ts')
  },
  outdir: outDir,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  sourcemap: isProduction ? false : true,
  minify: isProduction,
  metafile: shouldEmitMetafile,
  logLevel: 'info'
};

async function main() {
  if (isWatch) {
    const context = await esbuild.context(buildOptions);
    await context.watch();
    return;
  }

  const result = await esbuild.build(buildOptions);

  if (shouldEmitMetafile && result.metafile) {
    const metafilePath = path.join(outDir, 'meta.json');
    await fs.promises.writeFile(metafilePath, JSON.stringify(result.metafile, null, 2));
    const analysis = await esbuild.analyzeMetafile(result.metafile, {
      verbose: true
    });
    console.log(`Wrote preview bundle metadata to ${metafilePath}`);
    console.log(analysis);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
