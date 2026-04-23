import { resolve } from 'node:path'
import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
  }),
  manifest: {
    name: 'BattleCRM',
    description: 'BattleCRM browser extension — ajoutez des prospects LinkedIn en un clic',
    permissions: ['storage', 'activeTab', 'scripting', 'tabs'],
    host_permissions: ['*://www.linkedin.com/*'],
    // Fixed key keeps the extension ID stable across dev reloads.
    // EXTENSION_ORIGINS in .env can remain stable without reconfiguring CORS.
    // Generated with: openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
    //                 openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzRI4nbltX8DQe/cPPCgL5+wEkNeb+TOmFa1EwXtkHESzn6lgswZKEGlmsUk4YTwvH4av31WpP20/aS9Hw5iUS5HuEJxvPWTEHvD0C8mZPj55MQoZ0Nku67x7Qhel5mKVtYXnCYrcr8NfMtrO6qyiBDAXRakoRjZPyGGiJcExktgMSfFELjxAt+gRcmvzg+KyFUhidRzQ2WzCDPhdjV65IwlXko06wUSsmz0m3aBdXIpbpN3WLiPekFpLLNgKuPc5xxVg051esHYz+Djxg3UD48eLVWB7oXlPPIb6w7qw6Hw39C92BnNS8Ro6NPlJdyCeJHE76ksgrbECc46R+44lQQIDAQAB',
    icons: {
      16: 'icons/16.png',
      32: 'icons/32.png',
      48: 'icons/48.png',
      128: 'icons/128.png',
    },
  },
})
