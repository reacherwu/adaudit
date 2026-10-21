/** @type {import('next').NextConfig} */
const nextConfig = {
  // exceljs / pdf-lib are server-only; keep them out of the client bundle.
  serverExternalPackages: ["exceljs", "pdf-lib"],
};

export default nextConfig;
