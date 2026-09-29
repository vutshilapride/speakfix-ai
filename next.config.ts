import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" is for self-hosting (bun .next/standalone/server.js).
  // On Vercel it must be off — Vercel builds and serves Next.js itself.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
