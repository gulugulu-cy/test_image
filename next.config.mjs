/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    serverComponentsExternalPackages: ['pino', 'pino-pretty'],
  },
  // output: 'standalone',
  // images: {
  //   remotePatterns: [
  //     {
  //       protocol: 'https',
  //       hostname: 'file.302.ai',
  //     },
  //   ],
  // },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    BUILD_ENV: process.env.BUILD_ENV || 'test',
    buildTime: new Date().toLocaleString()
  }
}

export default nextConfig
