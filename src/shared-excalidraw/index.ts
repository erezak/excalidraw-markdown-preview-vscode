import { exportToSvg, loadFromBlob } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import { decompressFromBase64 } from 'lz-string';
import { loadExtensionConfig } from './config';

const diagramClassName = 'markdown-inline-excalidraw';
const renderedClassName = 'markdown-inline-excalidraw-rendered';
const styleElementClassName = 'markdown-inline-excalidraw-styles';
const obsidianDrawingHeadingText = 'drawing';

const diagramStyles = `
.${diagramClassName} {
  display: block;
  margin: 1rem 0;
}

.${renderedClassName} {
  border: 1px solid var(--vscode-panel-border, transparent);
  border-radius: 8px;
  padding: 12px;
  background: color-mix(in srgb, var(--vscode-editor-background) 92%, transparent);
  overflow-x: auto;
  white-space: normal;
  font: inherit;
}

.${renderedClassName} > svg {
  display: block;
  max-width: 100%;
  height: auto;
}

.${renderedClassName} > svg .style-fonts {
  font-family: var(--vscode-font-family);
}

.${diagramClassName}-error {
  white-space: pre-wrap;
  border-radius: 8px;
  padding: 12px;
  color: var(--vscode-errorForeground);
  background: color-mix(in srgb, var(--vscode-inputValidation-errorBackground, transparent) 75%, transparent);
  border: 1px solid var(--vscode-inputValidation-errorBorder, transparent);
}
`;

type LoadedScene = {
  type?: string;
  elements?: readonly unknown[];
  appState?: Partial<AppState>;
  files?: BinaryFiles;
};

type DiagramSource = {
  container: HTMLElement;
  format: 'json' | 'compressed-json';
  source: string;
};

export async function renderExcalidrawBlocksInElement(root: HTMLElement, signal?: AbortSignal): Promise<void> {
  ensureStyles();

  const config = loadExtensionConfig();
  const diagramSources = [
    ...Array.from(root.querySelectorAll<HTMLElement>(`.${diagramClassName}`), (container): DiagramSource => ({
      container,
      format: 'json',
      source: (container.textContent ?? '').trim()
    })),
    ...findObsidianDrawingBlocks(root)
  ];

  await Promise.all(Array.from(diagramSources, (diagramSource) => renderExcalidrawElement(diagramSource, config, signal)));
}

async function renderExcalidrawElement(
  diagramSource: DiagramSource,
  config: ReturnType<typeof loadExtensionConfig>,
  signal?: AbortSignal
): Promise<void> {
  const { container, format, source } = diagramSource;
  if (!source) {
    return;
  }

  if (source.length > config.maxTextSize) {
    renderError(container, `Excalidraw source exceeds markdown-inline-excalidraw.maxTextSize (${config.maxTextSize}).`);
    return;
  }

  try {
    const scene = await loadScene(getSceneSource(source, format, config.maxTextSize));
    if (signal?.aborted) {
      return;
    }

    assertValidScene(scene);

    const svg = await exportToSvg({
      elements: scene.elements ?? [],
      appState: {
        ...(scene.appState ?? {}),
        exportBackground: config.exportBackground,
        theme: resolveTheme(config.theme)
      },
      files: scene.files ?? {}
    });

    if (signal?.aborted) {
      return;
    }

    svg.removeAttribute('width');
    svg.style.maxWidth = '100%';
    svg.style.height = 'auto';

    container.innerHTML = '';
    container.classList.add(renderedClassName);
    container.appendChild(svg);
  } catch (error) {
    renderError(container, error instanceof Error ? error.message : String(error));
  }
}

async function loadScene(source: string): Promise<LoadedScene> {
  return await loadFromBlob(new Blob([source], { type: 'application/json' }), null, null) as LoadedScene;
}

function getSceneSource(source: string, format: DiagramSource['format'], maxTextSize: number): string {
  if (format !== 'compressed-json') {
    return source;
  }

  const decodedSource = decompressFromBase64(source);
  if (!decodedSource) {
    throw new Error('Could not decompress the Obsidian Excalidraw compressed-json block.');
  }

  if (decodedSource.length > maxTextSize) {
    throw new Error(`Decoded Excalidraw source exceeds markdown-inline-excalidraw.maxTextSize (${maxTextSize}).`);
  }

  return decodedSource;
}

function assertValidScene(scene: LoadedScene): asserts scene is LoadedScene & { elements: readonly unknown[] } {
  if (!scene || typeof scene !== 'object') {
    throw new Error('Inline Excalidraw content did not produce a valid scene object.');
  }

  if (scene.type && scene.type !== 'excalidraw') {
    throw new Error(`Unsupported scene type "${scene.type}". Expected "excalidraw".`);
  }

  if (scene.elements && !Array.isArray(scene.elements)) {
    throw new Error('Inline Excalidraw content has an invalid "elements" value.');
  }

  if (scene.appState && typeof scene.appState !== 'object') {
    throw new Error('Inline Excalidraw content has an invalid "appState" value.');
  }
}

function resolveTheme(theme: 'auto' | 'light' | 'dark'): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  return document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast')
    ? 'dark'
    : 'light';
}

function renderError(container: HTMLElement, message: string): void {
  container.classList.remove(renderedClassName);
  container.innerHTML = `<div class="${diagramClassName}-error">${escapeHtml(message)}</div>`;
}

function ensureStyles(): void {
  if (document.head.querySelector(`.${styleElementClassName}`)) {
    return;
  }

  const style = document.createElement('style');
  style.className = `${styleElementClassName} markdown-style`;
  style.textContent = diagramStyles;
  document.head.appendChild(style);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function findObsidianDrawingBlocks(root: HTMLElement): DiagramSource[] {
  const blocks: DiagramSource[] = [];

  for (const codeElement of Array.from(root.querySelectorAll<HTMLElement>('pre > code.language-json, pre > code.language-compressed-json'))) {
    const container = codeElement.parentElement;
    if (!container || !isObsidianDrawingBlock(container)) {
      continue;
    }

    blocks.push({
      container,
      format: codeElement.classList.contains('language-compressed-json') ? 'compressed-json' : 'json',
      source: (codeElement.textContent ?? '').trim()
    });
  }

  return blocks;
}

function isObsidianDrawingBlock(container: HTMLElement): boolean {
  const previousElement = container.previousElementSibling;
  if (!previousElement || !/^H[1-6]$/u.test(previousElement.tagName)) {
    return false;
  }

  return normalizeText(previousElement.textContent) === obsidianDrawingHeadingText;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}
