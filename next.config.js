const isNetlifyBuild = process.env.NETLIFY === 'true' || process.env.NETLIFY_LOCAL === 'true';
const distDir = process.env.NEXT_DIST_DIR || (isNetlifyBuild ? '.next' : process.platform === 'win32' ? '.next-runtime' : '.next');

const nextConfig = {
  distDir,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  outputFileTracingExcludes: {
    '/*': [
      './.netlify/**/*',
      './.next-runtime/**/*',
      './.next-runtime*/**/*',
      './.next-runtime-build-*/**/*',
      './.next-runtime-smoke/**/*',
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' && !isNetlifyBuild,
  },
  webpack: (config, { dev }) => {
    if (!dev) {
      // Temporary workaround for Next 15.5.x minifier crash on this environment.
      config.optimization = {
        ...config.optimization,
        minimize: false,
      };
    }
    return config;
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' https: wss:",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'no-referrer' }
        ],
      },
    ];
  },
};

export default nextConfig;