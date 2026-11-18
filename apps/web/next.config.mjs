/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// CSP: camera frames never leave the device; only the MediaPipe model host is
// contacted for the face-landmark model file. No third-party scripts. Images may
// also come from the reference lookbook host used by the seeded runway looks.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://reel-ref-try-the-look.vercel.app",
  "media-src 'self' blob:",
  "connect-src 'self' https://storage.googleapis.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@glamotion/contracts", "@glamotion/core", "@glamotion/tryon", "@glamotion/motion", "@glamotion/agents", "@glamotion/integrations", "@glamotion/ui"],
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
      ],
    }];
  },
};
export default nextConfig;
