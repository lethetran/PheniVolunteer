import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // "standalone" cho phép build image Docker nhỏ gọn; Vercel bỏ qua tuỳ chọn này.
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '15mb' }, // đủ cho file Excel import
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
}

export default nextConfig
