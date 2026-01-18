/** @type {import('next').NextConfig} */
import withBundleAnalyzer from '@next/bundle-analyzer';

const bundleAnalyzerConfig = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: false, // РЕФАКТОРИНГ: Включаем оптимизацию изображений для лучшей производительности
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.telegram.org',
      },
      {
        protocol: 'https',
        hostname: '**.telegramcdn.org',
      },
    ],
  },
  // Используем только App Router (app/), не Pages Router (pages/)
  pageExtensions: ['tsx', 'ts'],
  // Security headers
  async headers() {
    // В режиме разработки отключаем строгие CSP для удобства разработки
    const isProduction = process.env.NODE_ENV === 'production';

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
            value: 'max-age=63072000; includeSubDomains; preload' // РЕФАКТОРИНГ: Добавлен preload для HSTS
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // УДАЛЕНО: X-XSS-Protection устарел и не поддерживается современными браузерами
          // Защита от XSS обеспечивается через CSP
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          // CSP только в production режиме
          ...(isProduction ? [{
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // ИСПРАВЛЕНО: Разрешаем все необходимые источники для скриптов, включая Telegram SDK
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://*.telegram.org https://vercel.live data:",
              // ИСПРАВЛЕНО: Разрешаем inline стили и внешние стили
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
              "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com",
              // ИСПРАВЛЕНО: Разрешаем загрузку шрифтов из различных источников
              "font-src 'self' data: https://fonts.gstatic.com https://api.fontshare.com",
              // ИСПРАВЛЕНО: Разрешаем загрузку изображений из всех источников
              "img-src 'self' data: https: blob:",
              // ИСПРАВЛЕНО: Разрешаем подключения к API Telegram и другим источникам
              "connect-src 'self' https://api.telegram.org https://*.telegram.org https://vercel.live ws: wss:",
              // ИСПРАВЛЕНО: Разрешаем iframe для Telegram и других источников
              "frame-src https://telegram.org https://*.telegram.org https://vercel.live",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              // ИСПРАВЛЕНО: Разрешаем worker-src для поддержки Service Workers (если используются)
              "worker-src 'self' blob:",
            ].join('; ')
          }] : [])
        ],
      },
    ];
  },
  // ИСПРАВЛЕНО: Добавлен пустой turbopack конфиг для совместимости с Next.js 16
  // Next.js 16 использует Turbopack по умолчанию, но у нас есть webpack конфигурация
  // Пустой конфиг позволяет использовать webpack без ошибок
  turbopack: {},
  
  // Исключаем src из сборки (Vite фронтенд)
  // ОПТИМИЗАЦИЯ: Code splitting для уменьшения размера бандла
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
      
      // ОПТИМИЗАЦИЯ: Разделяем большие библиотеки на отдельные чанки
      config.optimization = config.optimization || {};
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Отдельный чанк для chart.js (используется только в админке)
          chartjs: {
            name: 'chartjs',
            test: /[\\/]node_modules[\\/](chart\.js|react-chartjs-2|recharts)[\\/]/,
            chunks: 'async',
            priority: 20,
          },
          // Отдельный чанк для PDF библиотек (используется для экспорта)
          pdf: {
            name: 'pdf',
            test: /[\\/]node_modules[\\/]jspdf[\\/]/,
            chunks: 'async',
            priority: 20,
          },
          // Отдельный чанк для анимаций (используется не везде)
          animations: {
            name: 'animations',
            test: /[\\/]node_modules[\\/](framer-motion|lottie-react|@lottiefiles)[\\/]/,
            chunks: 'async',
            priority: 20,
          },
          // Отдельный чанк для Prisma (большая библиотека)
          prisma: {
            name: 'prisma',
            test: /[\\/]node_modules[\\/]@prisma[\\/]/,
            chunks: 'async',
            priority: 30,
          },
          // Общий чанк для остальных vendor библиотек
          vendor: {
            name: 'vendor',
            test: /[\\/]node_modules[\\/]/,
            chunks: 'all',
            priority: 10,
            minChunks: 2,
          },
        },
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
};

export default bundleAnalyzerConfig(nextConfig);

