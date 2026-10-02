import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mongoose must run in the Node.js runtime and should not be bundled.
  serverExternalPackages: ["mongoose"],
};

export default nextConfig;
