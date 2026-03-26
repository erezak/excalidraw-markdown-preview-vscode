import type MarkdownIt from 'markdown-it';

const diagramClassName = 'markdown-inline-excalidraw';
const containerTokenName = 'excalidrawContainer';
const minMarkers = 3;
const markerStr = ':';
const markerChar = markerStr.charCodeAt(0);
const markerLen = markerStr.length;

interface MarkdownContainerState {
  src: string;
  bMarks: number[];
  tShift: number[];
  eMarks: number[];
  sCount: number[];
  blkIndent: number;
  parentType: string;
  lineMax: number;
  line: number;
  skipSpaces(pos: number): number;
  getLines(startLine: number, endLine: number, indent: number, keepLastLF: boolean): string;
  push(type: string, tag: string, nesting: number): MarkdownToken;
}

interface MarkdownToken {
  markup: string;
  block: boolean;
  info: string;
  map: [number, number] | null;
  content: string;
}

export function extendMarkdownItWithExcalidraw(md: MarkdownIt, config: { languageIds(): readonly string[] }) {
  md.use((markdownIt: MarkdownIt) => {
    function container(state: MarkdownContainerState, startLine: number, endLine: number, silent: boolean) {
      let start = state.bMarks[startLine] + state.tShift[startLine];
      let max = state.eMarks[startLine];

      if (markerChar !== state.src.charCodeAt(start)) {
        return false;
      }

      let pos: number;
      for (pos = start + 1; pos <= max; pos++) {
        if (markerStr[(pos - start) % markerLen] !== state.src[pos]) {
          break;
        }
      }

      const markerCount = Math.floor((pos - start) / markerLen);
      if (markerCount < minMarkers) {
        return false;
      }

      pos -= (pos - start) % markerLen;
      const markup = state.src.slice(start, pos);
      const params = state.src.slice(pos, max).trim();
      const languageId = params.split(/\s+/u)[0]?.toLowerCase();
      if (!languageId || !config.languageIds().some(candidate => candidate.toLowerCase() === languageId)) {
        return false;
      }

      if (silent) {
        return true;
      }

      let nextLine = startLine;
      let autoClosed = false;

      for (;;) {
        nextLine++;
        if (nextLine >= endLine) {
          break;
        }

        start = state.bMarks[nextLine] + state.tShift[nextLine];
        max = state.eMarks[nextLine];

        if (start < max && state.sCount[nextLine] < state.blkIndent) {
          break;
        }

        if (markerChar !== state.src.charCodeAt(start)) {
          continue;
        }

        if (state.sCount[nextLine] - state.blkIndent >= 4) {
          continue;
        }

        for (pos = start + 1; pos <= max; pos++) {
          if (markerStr[(pos - start) % markerLen] !== state.src[pos]) {
            break;
          }
        }

        if (Math.floor((pos - start) / markerLen) < markerCount) {
          continue;
        }

        pos -= (pos - start) % markerLen;
        pos = state.skipSpaces(pos);
        if (pos < max) {
          continue;
        }

        autoClosed = true;
        break;
      }

      const oldParent = state.parentType;
      const oldLineMax = state.lineMax;
      state.parentType = 'container';
      state.lineMax = nextLine;

      const containerToken = state.push(containerTokenName, 'div', 1);
      containerToken.markup = markup;
      containerToken.block = true;
      containerToken.info = params;
      containerToken.map = [startLine, nextLine];
      containerToken.content = state.getLines(startLine + 1, nextLine, state.blkIndent, true);

      state.parentType = oldParent;
      state.lineMax = oldLineMax;
      state.line = nextLine + (autoClosed ? 1 : 0);
      return true;
    }

    markdownIt.block.ruler.before('fence', containerTokenName, container, {
      alt: ['paragraph', 'reference', 'blockquote', 'list']
    });

    markdownIt.renderer.rules[containerTokenName] = (tokens: MarkdownToken[], idx: number) => {
      const token = tokens[idx];
      return `<div class="${diagramClassName}">${preProcess(token.content)}</div>`;
    };
  });

  const highlight = md.options.highlight;
  md.options.highlight = (code: string, lang: string, attrs: string) => {
    const expression = new RegExp(`\\b(${config.languageIds().map(escapeRegExp).join('|')})\\b`, 'i');
    if (lang && expression.test(lang)) {
      return `<pre class="${diagramClassName}" style="all: unset;">${preProcess(code)}</pre>`;
    }

    return highlight?.(code, lang, attrs) ?? code;
  };

  return md;
}

function preProcess(source: string): string {
  return source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n+$/u, '')
    .trimStart();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
