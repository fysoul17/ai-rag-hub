import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@autonomy/shared'],
  turbopack: {
    root: '..',
  },
};

export default nextConfig;
