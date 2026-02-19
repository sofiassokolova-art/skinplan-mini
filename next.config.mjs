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
    const isProduction = process.env.NODE_ENV === 'production';

    // Единая CSP для production: eval разрешён (нужен частично для чанков/библиотек), стили — self + внешние
    const cspValue = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://*.telegram.org https://vercel.live data:",
      "connect-src 'self' https://telegram.org https://api.telegram.org https://*.telegram.org https://fonts.googleapis.com https://fonts.gstatic.com https://vercel.live ws: wss:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://api.fontshare.com",
      "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://api.fontshare.com",
      "style-src-attr 'self' 'unsafe-inline'",
      "font-src 'self' data: https://fonts.gstatic.com https://api.fontshare.com",
      "img-src 'self' data: https: blob:",
      "frame-src https://telegram.org https://*.telegram.org https://vercel.live",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "worker-src 'self' blob:",
    ].join('; ');

    const securityHeaders = [
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ...(isProduction ? [{ key: 'Content-Security-Policy', value: cspValue }] : []),
    ];

    return [
      {
        source: '/',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, max-age=0' },
          ...securityHeaders,
        ],
      },
      {
        source: '/home',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, max-age=0' },
          ...securityHeaders,
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, max-age=0, must-revalidate' },
          ...securityHeaders,
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
          // React отдельно — реже меняется, лучше кэш
          framework: {
            name: 'framework',
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            chunks: 'all',
            priority: 40,
            enforce: true,
          },
          // Chart.js только в админке — async
          chartjs: {
            name: 'chartjs',
            test: /[\\/]node_modules[\\/](chart\.js|react-chartjs-2|recharts)[\\/]/,
            chunks: 'async',
            priority: 20,
          },
          pdf: {
            name: 'pdf',
            test: /[\\/]node_modules[\\/]jspdf[\\/]/,
            chunks: 'async',
            priority: 20,
          },
          // Анимации только при заходе на страницы с Lottie (framer-motion убран из layout)
          animations: {
            name: 'animations',
            test: /[\\/]node_modules[\\/](framer-motion|lottie-react|@lottiefiles)[\\/]/,
            chunks: 'async',
            priority: 20,
          },
          prisma: {
            name: 'prisma',
            test: /[\\/]node_modules[\\/]@prisma[\\/]/,
            chunks: 'async',
            priority: 30,
          },
          // Остальные node_modules — в vendor (tanstack, radix и т.д.)
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

