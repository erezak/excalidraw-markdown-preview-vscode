import esbuild from 'esbuild';
import path from 'path';

const rootDir = import.meta.dirname;
const srcDir = path.join(rootDir, '..', 'src');
const distDir = path.join(rootDir, '..', 'dist');
const distPreviewDir = path.join(rootDir, '..', 'dist-preview');

async function main() {
  const contexts = await Promise.all([
    esbuild.context({
      bundle: true,
      external: ['vscode'],
      sourcemap: true,
      logLevel: 'info',
      entryPoints: [path.join(srcDir, 'vscode-extension', 'index.ts')],
      outfile: path.join(distDir, 'index.js'),
      format: 'cjs',
      platform: 'node',
      target: ['node18']
    }),
    esbuild.context({
      bundle: true,
      external: ['vscode'],
      sourcemap: true,
      logLevel: 'info',
      entryPoints: [path.join(srcDir, 'vscode-extension', 'index.ts')],
      outfile: path.join(distDir, 'web', 'index.js'),
      format: 'cjs',
      platform: 'browser',
      target: ['es2022']
    }),
    esbuild.context({
      bundle: true,
      entryPoints: {
        'index.bundle': path.join(srcDir, 'markdownPreview', 'index.ts')
      },
      outdir: distPreviewDir,
      format: 'iife',
      platform: 'browser',
      target: ['es2022'],
      sourcemap: true,
      logLevel: 'info'
    })
  ]);

  await Promise.all(contexts.map((context) => context.watch()));

  const dispose = async () => {
    await Promise.all(contexts.map((context) => context.dispose()));
    process.exit(0);
  };

  process.on('SIGINT', () => void dispose());
  process.on('SIGTERM', () => void dispose());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});