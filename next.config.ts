import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (Postgres embebido para desarrollo) trae archivos WASM que no deben empaquetarse.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
