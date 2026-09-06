import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * pdfkit reads its built-in AFM font metrics off disk with a relative path.
   * Bundled into a route handler those files are not there and the first
   * `new PDFDocument()` throws ENOENT, so it is loaded through native `require`
   * instead. `@aws-sdk/client-s3` is already on Next's own externals list and
   * does not need repeating here.
   */
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
