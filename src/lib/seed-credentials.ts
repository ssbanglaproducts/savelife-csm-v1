const DEV_ADMIN_PASSWORD = "Admin@123456";
const DEV_FOUNDER_PASSWORD = "Founder@123456";
const MIN_PRODUCTION_PASSWORD_LENGTH = 12;

export type SeedPasswords = {
  adminPassword: string;
  founderPassword: string;
};

/**
 * Local seeding keeps the documented credentials. Production seeding must be
 * given explicit, rotatable secrets so a copied example password can never
 * become a real administrator login.
 */
export function resolveSeedPasswords(
  env: NodeJS.ProcessEnv = process.env,
  nodeEnv = env.NODE_ENV,
): SeedPasswords {
  if (nodeEnv !== "production") {
    return {
      adminPassword: env.SEED_ADMIN_PASSWORD || DEV_ADMIN_PASSWORD,
      founderPassword: env.SEED_FOUNDER_PASSWORD || DEV_FOUNDER_PASSWORD,
    };
  }

  const adminPassword = env.SEED_ADMIN_PASSWORD?.trim();
  const founderPassword = env.SEED_FOUNDER_PASSWORD?.trim();

  if (!adminPassword || adminPassword.length < MIN_PRODUCTION_PASSWORD_LENGTH) {
    throw new Error("Cannot seed a production database: SEED_ADMIN_PASSWORD must be at least 12 characters.");
  }
  if (!founderPassword || founderPassword.length < MIN_PRODUCTION_PASSWORD_LENGTH) {
    throw new Error("Cannot seed a production database: SEED_FOUNDER_PASSWORD must be at least 12 characters.");
  }

  return { adminPassword, founderPassword };
}
