/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Используем только App Router (app/), не Pages Router (pages/)
  pageExtensions: ['tsx', 'ts'],
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

