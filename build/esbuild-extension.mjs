import esbuild from 'esbuild';
import path from 'path';

const rootDir = import.meta.dirname;
const srcDir = path.join(rootDir, '..', 'src');
const distDir = path.join(rootDir, '..', 'dist');
const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

const sharedOptions = {
  bundle: true,
  external: ['vscode'],
  sourcemap: isProduction ? false : true,
  minify: isProduction,
  logLevel: 'info'
};

const nodeOptions = {
  ...sharedOptions,
  entryPoints: [path.join(srcDir, 'vscode-extension', 'index.ts')],
  outfile: path.join(distDir, 'index.js'),
  format: 'cjs',
  platform: 'node',
  target: ['node18']
};

const webOptions = {
  ...sharedOptions,
  entryPoints: [path.join(srcDir, 'vscode-extension', 'index.ts')],
  outfile: path.join(distDir, 'web', 'index.js'),
  format: 'cjs',
  platform: 'browser',
  target: ['es2022']
};

async function main() {
  if (isWatch) {
    const nodeContext = await esbuild.context(nodeOptions);
    const webContext = await esbuild.context(webOptions);
    await Promise.all([nodeContext.watch(), webContext.watch()]);
    return;
  }

  await Promise.all([esbuild.build(nodeOptions), esbuild.build(webOptions)]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
