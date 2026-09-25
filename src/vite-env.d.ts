/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_IMAGE_PROXY?: string;
  readonly VITE_CHAT_API_BASE?: string;
  readonly VITE_CHAT_MOCK?: string;
  /** Optional CoinGecko-compatible root. Unset uses the public API. */
  readonly VITE_MARKET_API_BASE?: string;
  /** Optional Wan 2.2 Extend Space origin. Unset uses Simzy/wan22-extend. */
  readonly VITE_WAN_EXTEND_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
