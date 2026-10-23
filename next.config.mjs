/** @type {import('next').NextConfig} */
const immutable = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }];
const nextConfig = {
  reactStrictMode: true,
  // Local build checks can set NEXT_DIST_DIR so they never overwrite a running dev server's .next (which breaks its CSS/JS).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  serverExternalPackages: ['@node-rs/argon2', 'sharp', 'mongoose'],
  experimental: { optimizePackageImports: ['lucide-react', 'framer-motion', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@tanstack/react-query'] },
  // Type-checking runs in `pnpm typecheck` (client + server projects) as part of `pnpm build`.
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [
      { source: '/demo/:path*', headers: immutable }, // demo photos never change under the same name
      { source: '/video/:path*', headers: immutable },
      { source: '/(.*)', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
      ] },
    ];
  },
};
export default nextConfig;
