import type { NextConfig } from "next";

const isGhPages = process.env.GITHUB_ACTIONS === "true";
const repoName = "deadlock-optimizer";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: isGhPages ? `/${repoName}` : "",
  assetPrefix: isGhPages ? `/${repoName}/` : undefined,
};

export default nextConfig;
