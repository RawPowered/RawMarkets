/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  rawMarkets?: {
    openExternal?: (
      url: string
    ) => Promise<{ ok: boolean; error?: string }>;
  };
}
