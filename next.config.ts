import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "pdf-parse", "mammoth", "@prisma/client"],
  experimental: {
    // Uploads can be large — video especially.
    serverActions: { bodySizeLimit: "512mb" },
  },
};

export default nextConfig;
