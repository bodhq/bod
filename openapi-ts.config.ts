import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './docs/openapi.json',
  output: './packages/api-client/src',
  plugins: [
    '@hey-api/typescript',
    '@hey-api/client-fetch',
    '@hey-api/sdk',
    'zod'
  ]
});
