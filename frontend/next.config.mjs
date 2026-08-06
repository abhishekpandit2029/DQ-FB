/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
    // Modern formats first — typically 25-35% smaller than JPEG at the same
    // quality, which is the cheapest LCP win available on image-heavy routes.
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  experimental: {
    // Rewrites barrel imports to deep ones so a single import doesn't pull in
    // a whole module graph.
    optimizePackageImports: ["swr", "socket.io-client"],
  },

  compiler: {
    // Strips console.* from production builds, keeping errors for reporting.
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },

  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            // Camera and microphone are needed for calls, on this origin only.
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
