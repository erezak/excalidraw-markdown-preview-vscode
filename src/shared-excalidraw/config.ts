export interface ExcalidrawExtensionConfig {
  readonly exportBackground: boolean;
  readonly maxTextSize: number;
  readonly theme: 'auto' | 'light' | 'dark';
}

const defaultConfig: ExcalidrawExtensionConfig = {
  exportBackground: true,
  maxTextSize: 200000,
  theme: 'auto'
};

export function loadExtensionConfig(): ExcalidrawExtensionConfig {
  const configNode = document.getElementById('markdown-inline-excalidraw');
  const configAttr = configNode?.dataset.config;
  if (!configAttr) {
    return defaultConfig;
  }

  try {
    return { ...defaultConfig, ...JSON.parse(configAttr) };
  } catch {
    return defaultConfig;
  }
}
