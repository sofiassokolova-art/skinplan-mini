/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Используем только App Router (app/), не Pages Router (pages/)
  pageExtensions: ['tsx', 'ts'],
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ],
      },
    ];
  },
  // Исключаем src из сборки (Vite фронтенд)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    // Исключаем src/pages из сборки Next.js
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.resolve.alias = {
      ...config.resolve.alias,
      // Игнорируем src/pages
    };
    return config;
  },
  // Игнорируем директории при сборке
  experimental: {
    // outputFileTracingRoot: path.join(process.cwd(), './'),
  },
};

export default nextConfig;

