interface ImportMetaEnv {
  /** The released version, set when the image is built (apps/web/Dockerfile); absent in dev. */
  readonly VITE_APP_VERSION?: string;
}
