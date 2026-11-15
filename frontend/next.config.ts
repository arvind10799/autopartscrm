import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return ['/sw.js','/reminder-sw.js'].map(source=>({source,headers:[{key:'Cache-Control',value:'no-cache, no-store, must-revalidate'}]}));
  },
};

export default nextConfig;
