import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
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
        source: "/:locale(en|bn)/admin/salary",
        destination: "/:locale/admin/rank-salary/overview",
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
