import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/docs/content': ['./docs/**/*'],
  },
};

export default nextConfig;

