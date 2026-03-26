import type MarkdownIt from 'markdown-it';
import * as vscode from 'vscode';

export const configSection = 'markdown-inline-excalidraw';

export function injectExcalidrawConfig(md: MarkdownIt) {
  const render = md.renderer.render;
  md.renderer.render = function (...args) {
    const config = vscode.workspace.getConfiguration(configSection);
    const configData = {
      exportBackground: config.get<boolean>('exportBackground', true),
      maxTextSize: config.get<number>('maxTextSize', 200000),
      theme: sanitizeTheme(config.get<string>('theme'))
    };

    const escapedConfig = escapeHtmlAttribute(JSON.stringify(configData));
    return `<span id="${configSection}" aria-hidden="true" data-config="${escapedConfig}"></span>${render.apply(md.renderer, args)}`;
  };

  return md;
}

function sanitizeTheme(theme: string | undefined): 'auto' | 'light' | 'dark' {
  switch (theme) {
    case 'light':
    case 'dark':
      return theme;
    default:
      return 'auto';
  }
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
