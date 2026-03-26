import type MarkdownIt from 'markdown-it';
import * as vscode from 'vscode';
import { extendMarkdownItWithExcalidraw } from '../shared-md-excalidraw';
import { configSection, injectExcalidrawConfig } from './config';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(configSection) || event.affectsConfiguration('workbench.colorTheme')) {
      void vscode.commands.executeCommand('markdown.preview.refresh');
    }
  }));

  return {
    extendMarkdownIt(md: MarkdownIt) {
      extendMarkdownItWithExcalidraw(md, {
        languageIds: () => vscode.workspace.getConfiguration(configSection).get<string[]>('languages', ['excalidraw'])
      });
      md.use(injectExcalidrawConfig);
      return md;
    }
  };
}
