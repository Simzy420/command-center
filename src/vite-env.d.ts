/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_IMAGE_PROXY?: string;
  readonly VITE_CHAT_API_BASE?: string;
  readonly VITE_CHAT_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
