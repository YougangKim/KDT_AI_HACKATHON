import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 같은 폴더에서 next dev와 next build가 동시에 돌 때 .next 충돌을 피하려고 바꿀 수 있게 한다(기본 .next)
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
