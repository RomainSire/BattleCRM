import { defineConfig } from '@adonisjs/cors'
import env from '#start/env'

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
const extensionOrigins = env
  .get('EXTENSION_ORIGINS', '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

const allowedOrigins = [env.get('CORS_ORIGIN'), ...extensionOrigins]

// Note: `credentials: true` is required for web session cookies and applies globally to all
// allowed origins — including extension origins (chrome-extension://, moz-extension://).
// Extension endpoints use Bearer tokens so credentials are not needed there, but AdonisJS
// does not support per-route CORS credentials config. This is a known limitation.
const corsConfig = defineConfig({
  enabled: true,
  origin: (requestOrigin) => {
    return allowedOrigins.includes(requestOrigin) ? requestOrigin : false
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH'],
  headers: true,
  // `Content-Disposition` must be explicitly exposed so the browser can read the
  // dated backup filename (e.g. battlecrm-export-2026-06-10.json.gz) from a
  // cross-origin download response; otherwise the frontend falls back to a generic name.
  exposeHeaders: ['content-disposition'],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
