import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Enable instrumentation hook for running migrations at startup
  experimental: {
    instrumentationHook: true,
  },

  // Output standalone server to bypass Next.js 16 static pre-rendering bug
  output: 'standalone',

  // Include WASM files that Next.js standalone doesn't automatically trace
  outputFileTracingIncludes: {
    '/api/verify': ['./node_modules/tiny-secp256k1/**/*'],
    '/api/verify/dns-check': ['./node_modules/tiny-secp256k1/**/*'],
  },

  // Transpile workspace packages and CommonJS dependencies
  transpilePackages: ['@atlasp2p/config', '@atlasp2p/types', 'bitcoinjs-message'],

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
