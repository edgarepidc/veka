import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@veka/shared', '@veka/supabase'],
};

export default nextConfig;
