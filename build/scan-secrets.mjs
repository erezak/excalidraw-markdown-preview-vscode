import fs from 'node:fs';
import path from 'node:path';

const rootDirectory = process.cwd();

const ignoredDirectories = new Set(['.git', 'node_modules']);
const generatedDirectories = new Set(['dist', 'dist-preview']);
const ignoredGeneratedExtensions = new Set(['.map']);

const placeholderFragments = [
  'example',
  'sample',
  'placeholder',
  'changeme',
  'dummy',
  'fake',
  'mock',
  'redacted',
  'xxxxx',
  'xxxx',
  'your_',
  'token_here',
  'secret_here',
  'password_here',
  'api_key_here',
  'key_here',
  'oai-api-key',
  'excalidraw-oai-api-key',
  'publish-library-data',
  'mermaid-to-excalidraw',
];

const envReferenceFragments = [
  'process.env',
  'import.meta.env',
  '${',
  'env(',
];

const highConfidencePatterns = [
  {
    name: 'private_key_header',
    expression: /-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----/g,
    redact: () => '-----BEGIN ... PRIVATE KEY-----',
  },
  {
    name: 'aws_access_key_id',
    expression: /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|AIPA)[0-9A-Z]{16}\b/g,
    redact: (value) => `${value.slice(0, 4)}...[REDACTED]`,
  },
  {
    name: 'github_token',
    expression: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
    redact: (value) => `${value.slice(0, 4)}...[REDACTED]`,
  },
  {
    name: 'google_api_key',
    expression: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
    redact: (value) => `${value.slice(0, 6)}...[REDACTED]`,
  },
  {
    name: 'stripe_key',
    expression: /\b(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{16,}\b/g,
    redact: (value) => `${value.slice(0, 7)}...[REDACTED]`,
  },
  {
    name: 'slack_token',
    expression: /\bxox(?:a|b|p|r|s|t|u|xapp)-[A-Za-z0-9-]{10,}\b/g,
    redact: (value) => `${value.slice(0, 4)}...[REDACTED]`,
  },
];

const assignmentPattern = /\b([A-Za-z0-9_]*(?:api[_-]?key|apikey|password|passwd|pwd|secret|token|client_secret|access_token)[A-Za-z0-9_]*)\b\s*[:=]\s*(["'])?([^\s"'`,;}{]{4,})\2?/gi;

function walk(directoryPath, relativePrefix = '') {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = relativePrefix ? path.posix.join(relativePrefix, entry.name) : entry.name;
    const absolutePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }

      files.push(...walk(absolutePath, relativePath));
      continue;
    }

    if (entry.isFile()) {
      files.push({ absolutePath, relativePath });
    }
  }

  return files;
}

function isBinary(buffer, extension) {
  if (['.pem', '.key', '.crt', '.cer'].includes(extension)) {
    return false;
  }

  return buffer.subarray(0, 4096).includes(0);
}

function hasGeneratedSegment(relativePath) {
  return relativePath.split('/').some((segment) => generatedDirectories.has(segment));
}

function isIgnoredGeneratedArtifact(relativePath) {
  return hasGeneratedSegment(relativePath) && ignoredGeneratedExtensions.has(path.extname(relativePath));
}

function isLikelyCodeReference(value, wasQuoted) {
  if (wasQuoted) {
    return false;
  }

  return /^[A-Za-z_$][A-Za-z0-9_.$\[\]()]*$/.test(value);
}

function isPlaceholder(value) {
  const normalized = value.toLowerCase();
  return placeholderFragments.some((fragment) => normalized.includes(fragment));
}

function isEnvReference(line) {
  const normalized = line.toLowerCase();
  return envReferenceFragments.some((fragment) => normalized.includes(fragment));
}

function collectFindings() {
  const files = walk(rootDirectory);
  const findings = [];
  let scannedFileCount = 0;

  for (const file of files) {
    if (isIgnoredGeneratedArtifact(file.relativePath)) {
      continue;
    }

    const extension = path.extname(file.relativePath);
    const contents = fs.readFileSync(file.absolutePath);

    if (isBinary(contents, extension)) {
      continue;
    }

    const text = contents.toString('utf8');
    if (!text) {
      continue;
    }

    scannedFileCount += 1;
    const lines = text.split(/\r?\n/);
    const generatedFile = hasGeneratedSegment(file.relativePath);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];

      for (const pattern of highConfidencePatterns) {
        pattern.expression.lastIndex = 0;

        for (const match of line.matchAll(pattern.expression)) {
          findings.push({
            filePath: file.relativePath,
            lineNumber: lineIndex + 1,
            type: pattern.name,
            snippet: pattern.redact(match[0]),
          });
        }
      }

      if (generatedFile) {
        continue;
      }

      assignmentPattern.lastIndex = 0;

      for (const match of line.matchAll(assignmentPattern)) {
        const key = match[1];
        const quote = match[2] ?? '';
        const rawValue = match[3];
        const normalizedValue = rawValue.toLowerCase();

        if (isEnvReference(line) || isPlaceholder(rawValue)) {
          continue;
        }

        if (['true', 'false', 'null', 'undefined'].includes(normalizedValue)) {
          continue;
        }

        if (rawValue.length < 12) {
          continue;
        }

        if (isLikelyCodeReference(rawValue, Boolean(quote))) {
          continue;
        }

        findings.push({
          filePath: file.relativePath,
          lineNumber: lineIndex + 1,
          type: 'sensitive_assignment',
          snippet: `${key}=[REDACTED]`,
        });
      }
    }
  }

  return {
    files,
    findings,
    scannedFileCount,
  };
}

function main() {
  const { findings, scannedFileCount } = collectFindings();

  if (findings.length === 0) {
    console.log(`Secret scan passed. Scanned ${scannedFileCount} text files.`);
    return;
  }

  console.error(`Secret scan failed. Found ${findings.length} potential secret${findings.length === 1 ? '' : 's'}.`);
  for (const finding of findings) {
    console.error(`${finding.filePath}:${finding.lineNumber} [${finding.type}] ${finding.snippet}`);
  }

  process.exitCode = 1;
}

main();