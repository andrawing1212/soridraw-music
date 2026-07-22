/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_APP_CHECK_SITE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
