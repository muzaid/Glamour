/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// CSP: camera frames never leave the device; only the MediaPipe model host is
// contacted for the face-landmark model file. No third-party scripts.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "connect-src 'self' https://storage.googleapis.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// The static "Try the Look" runway page loads its art from the reference deployment.
const runwayCsp = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'unsafe-inline'",
  "img-src 'self' https://reel-ref-try-the-look.vercel.app data: blob:",
  "font-src data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const common = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@glamotion/contracts", "@glamotion/core", "@glamotion/tryon", "@glamotion/motion", "@glamotion/agents", "@glamotion/integrations", "@glamotion/ui"],
  poweredByHeader: false,
  async redirects() {
    return [{ source: "/runway", destination: "/runway/index.html", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/((?!runway/).*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          ...common,
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/runway/:path*",
        headers: [
          { key: "Content-Security-Policy", value: runwayCsp },
          ...common,
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default nextConfig;
