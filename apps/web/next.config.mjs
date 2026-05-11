import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@pc/shared"],
  turbopack: {
    root
  }
};

export default nextConfig;
