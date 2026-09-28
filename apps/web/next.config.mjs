/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@cjverse/game-logic', '@cjverse/db'],
  experimental: {
    serverComponentsExternalPackages: ['@napi-rs/canvas', '@cjverse/asset-pipeline'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)), '@napi-rs/canvas'];
    }
    return config;
  },
};

export default nextConfig;
