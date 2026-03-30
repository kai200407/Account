import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [],
    // 允许本地 uploads 目录的图片
    unoptimized: false,
  },
};

export default nextConfig;
