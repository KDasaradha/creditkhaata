
/** @type {import('next').NextConfig} */
const nextConfig = {
    // Optional: Add any Next.js specific configurations here
    // Example: reactStrictMode: true,
    env: {
        NEXT_PUBLIC_API_URL: process.env.NODE_ENV === 'production'
            ? 'https://your-production-api-url.com/api' // Replace with your actual production API URL
            : 'http://localhost:3001/api', // Default for development
    },
      images: {
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'picsum.photos',
            port: '',
            pathname: '**',
          },
        ],
      },
};

export default nextConfig;
