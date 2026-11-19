/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Data Dragon URLs include the patch, so an optimized copy never goes stale.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ddragon.leagueoflegends.com",
        pathname: "/cdn/**",
      },
    ],
    // Local images are versioned with ?v= when their content changes.
    minimumCacheTTL: 31536000,
  },
};
module.exports = nextConfig;
