/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTHORIZED_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
