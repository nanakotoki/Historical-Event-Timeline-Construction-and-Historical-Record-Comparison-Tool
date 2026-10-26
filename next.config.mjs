/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig = {
  reactStrictMode: true,
  // 纯静态导出：零后端成本部署（Vercel / GitHub Pages / 任意 CDN）
  output: 'export',
  // 允许换一个构建目录：某些 Windows 环境下 .next 会被安全策略锁住，
  // 此时用 NEXT_DIST_DIR=.build 另起目录即可绕过。
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
