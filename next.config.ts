import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // "standalone" cho phép build image Docker nhỏ gọn; Vercel bỏ qua tuỳ chọn này.
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '15mb' }, // đủ cho file Excel import
  },
  // Đảm bảo font .ttf dùng để xuất PDF chứng nhận được đóng gói vào serverless
  // function trên Vercel — fs.readFileSync với đường dẫn động không phải lúc nào
  // cũng được file tracing tự phát hiện.
  outputFileTracingIncludes: {
    '/admin/campaigns/[id]/members/certificate': ['./src/assets/fonts/**/*'],
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
