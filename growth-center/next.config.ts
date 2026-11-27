import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Native/wasm-heavy packages stay on the server as plain Node modules.
  serverExternalPackages: ['@electric-sql/pglite', 'exceljs'],
  // The original workbook (for "reset to original"), schema and seed ship with the server functions.
  outputFileTracingIncludes: {
    '/api/**': ['./data/**/*', './db/**/*'],
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
