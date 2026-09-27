/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@cjverse/game-logic', '@cjverse/db', '@cjverse/asset-pipeline']
};

export default nextConfig;
