import type { NextConfig } from "next";
import path from "path";

// Loader path from @ideavo/webpack-tagger - use direct resolve to get the actual file
const loaderPath = require.resolve('@ideavo/webpack-tagger');

const nextConfig: NextConfig = {
  // Flaw 6 Fix: Lock workspace root to this project dir to silence multiple-lockfile ambiguity
  outputFileTracingRoot: path.resolve(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  allowedDevOrigins: ['*.e2b.app', '*.ideavo.app', '*.ideavo.ai'],
  typescript: {
    ignoreBuildErrors: false,
  },
  turbopack: {
    rules: {
      "*.{jsx,tsx}": {
        loaders: [loaderPath]
      }
    }
  }
} as NextConfig;

export default nextConfig;
