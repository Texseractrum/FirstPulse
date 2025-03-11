import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    OUTBOUND_CALL_API_URL: process.env.OUTBOUND_CALL_API_URL,
  },
};

export default nextConfig;
