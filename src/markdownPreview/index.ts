import { renderExcalidrawBlocksInElement } from '../shared-excalidraw';

let currentAbortController: AbortController | undefined;

async function init() {
  currentAbortController?.abort();
  currentAbortController = new AbortController();

  try {
    await renderExcalidrawBlocksInElement(document.body, currentAbortController.signal);
  } catch (error) {
    console.error('Failed to render Excalidraw markdown blocks', error);
  }
}

window.addEventListener('vscode.markdown.updateContent', () => {
  void init();
});

void init();
