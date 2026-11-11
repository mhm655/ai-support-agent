import type { NextConfig } from "next";

// Security headers for every page this app serves.
//
// Before these, the only one present in production was the HSTS header
// Vercel adds itself, so any site could load the dashboard in an invisible
// iframe and trick a signed-in owner into clicking its buttons (Delete
// agent, Delete document) while believing they were clicking something
// else. frame-ancestors 'none' and X-Frame-Options (for older browsers)
// refuse that framing outright. No page here is meant to be framed: the
// widget reaches customer sites as a <script>, which these do not affect.
//
// A full Content-Security-Policy is deliberately not set here. Next.js
// inlines scripts, and a policy strict enough to matter needs nonces wired
// through middleware; a loose one would only look like protection.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
