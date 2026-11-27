import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https: http://localhost:* http://127.0.0.1:*;
  font-src 'self' data:;
  media-src 'self' blob: data: https: http://localhost:* http://127.0.0.1:*;
  connect-src 'self' blob: data:;
  worker-src 'self' blob:;
  frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://*.vimeocdn.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`.replace(/\n/g, "");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        locale: false,
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:locale(en|bn)/admin/salary/treasuries/:rankKey/members",
        destination: "/:locale/admin/rank-salary/rank-treasuries/:rankKey/members",
        permanent: false,
      },
      {
        source: "/:locale(en|bn)/admin/salary/treasuries/:rankKey",
        destination: "/:locale/admin/rank-salary/rank-treasuries/:rankKey",
        permanent: false,
      },
      {
        source: "/:locale(en|bn)/admin/rank-plan",
        destination: "/:locale/admin/rank-salary/rank-configuration",
        permanent: false,
      },
      {
        source: "/:locale(en|bn)/admin/settings/rank-plan",
        destination: "/:locale/admin/rank-salary/rank-configuration",
        permanent: false,
      },
      {
        source: "/:locale(en|bn)/admin/rank-salary",
        destination: "/:locale/admin/rank-salary/overview",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
