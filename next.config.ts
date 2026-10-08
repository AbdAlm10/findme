import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phones open the LAN address. With this list set, Next blocks every other origin.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*", "10.*.*.*", "172.*.*.*"],
};

export default nextConfig;
