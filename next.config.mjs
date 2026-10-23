/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['@node-rs/argon2', 'sharp', 'mongoose'],
  // Type-checking is run separately; mongoose's generics make `tsc` over this whole project very slow.
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
    ] }];
  },
};
export default nextConfig;
