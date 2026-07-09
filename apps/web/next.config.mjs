/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@account/shared'],
  async rewrites() {
    // Inside Docker, web reaches api via the internal service name
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';
    return [
      {
        source: '/api/proxy/:path*',
        destination: apiUrl + '/:path*',
      },
    ];
  },
};
export default nextConfig;
