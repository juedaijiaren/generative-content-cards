import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    ignoreIssue: [
      {
        path: '**/next.config.ts',
        title: /unexpected file in NFT list/i,
      },
    ],
  },
};

export default nextConfig;
