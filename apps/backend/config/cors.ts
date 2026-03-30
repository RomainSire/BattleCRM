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
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
