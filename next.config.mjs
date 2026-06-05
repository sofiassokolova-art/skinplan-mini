/** @type {import('next').NextConfig} */
import withBundleAnalyzer from '@next/bundle-analyzer';

const bundleAnalyzerConfig = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  images: {
    unoptimized: true, // Картинки из telegram CDN отдаём как есть, без Next image optimization
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
  // Prisma queryCompiler (engineType="client") читает query_compiler_bg.wasm с диска
  // через readFileSync. Vercel serverless tracing не всегда тащит этот .wasm в бандл
  // лямбды → DB-роуты падают с ENOENT '/var/task/node_modules/.prisma/client/query_compiler_bg.wasm'.
  // Принудительно включаем файл в трассировку для всех роутов. Ключ — picomatch-glob по
  // пути роута: `*` не пересекает `/`, поэтому `/**/*` нужен, чтобы покрыть вложенные
  // роуты (/api/questionnaire/active), а не только верхнеуровневые.
  outputFileTracingIncludes: {
    '/**/*': ['./node_modules/.prisma/client/query_compiler_bg.wasm'],
  },
  // Security headers
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production';

    // Единая CSP для production: eval разрешён (нужен частично для чанков/библиотек), стили — self + внешние
    const cspValue = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://*.telegram.org data:",
      "connect-src 'self' https://telegram.org https://api.telegram.org https://*.telegram.org https://fonts.googleapis.com https://fonts.gstatic.com ws: wss:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://api.fontshare.com",
      "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://api.fontshare.com",
      "style-src-attr 'self' 'unsafe-inline'",
      "font-src 'self' data: https://fonts.gstatic.com https://api.fontshare.com",
      "img-src 'self' data: https: blob:",
      "frame-src https://telegram.org https://*.telegram.org",
      "frame-ancestors *",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "worker-src 'self' blob:",
    ].join('; ');

    const securityHeaders = [
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ...(isProduction ? [{ key: 'Content-Security-Policy', value: cspValue }] : []),
    ];

    return [
      {
        // Статические чанки Next.js — кэшируем навсегда (хэш в имени файла гарантирует свежесть)
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
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
        // /api/* — route handlers сами выставляют Cache-Control (через addCacheHeaders),
        // глобальный no-store здесь перебивал бы их и ломал edge-кеш CF, увеличивая CPU
        // на воркере. Только security headers.
        source: '/api/:path*',
        headers: securityHeaders,
      },
      {
        // Всё остальное (HTML-страницы) — no-store, как было.
        source: '/((?!api/).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, max-age=0, must-revalidate' },
          ...securityHeaders,
        ],
      },
    ];
  },
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
            chunks: 'all',
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
    return config;
  },
};

export default bundleAnalyzerConfig(nextConfig);

