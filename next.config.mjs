/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '45mb' } },
};
export default nextConfig;
