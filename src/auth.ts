import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeMemberId } from "@/lib/member-id";
import { canAccessAccount } from "@/lib/account-ownership";
import { authConfig } from "@/auth.config";
import {
  credentialRoleAllowed,
  normalizeAdminEmail,
  type LoginRole,
} from "@/lib/admin-login";
import { loginContext, loginThrottle } from "@/lib/login-throttle";

const MEMBER_ID_PATTERN = /^SL\d{6}$/;

/** Stable Auth.js error code; the UI keeps showing its generic invalid-credentials copy. */
class LoginRateLimitError extends CredentialsSignin {
  code = "TOO_MANY_ATTEMPTS";

  constructor(scope: "ip" | "account") {
    super("Login temporarily unavailable");
    this.name = "LoginRateLimitError";
    this.scope = scope;
  }

  readonly scope: "ip" | "account";
}

type Identity = {
  id: string;
  principalId: string;
  role: "MEMBER" | "ADMIN" | "STAFF";
  memberId: string | null;
  status: "INACTIVE" | "ACTIVE" | "SUSPENDED";
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

const loginSchema = z.object({
  memberId: z.string().optional(),
  email: z.string().optional(),
  password: z.string().min(1),
  expectedRole: z.enum(["ADMIN", "MEMBER"]).optional(),
});

export const {
  handlers,
  auth,
  signIn,
  signOut,
  unstable_update: updateSession,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        memberId: { label: "Member ID", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        expectedRole: { label: "Expected role", type: "text" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const expectedRole: LoginRole = parsed.data.expectedRole ?? "MEMBER";
        const adminLogin = expectedRole === "ADMIN";
        const throttleContext = loginContext(
          request,
          expectedRole,
          adminLogin ? (parsed.data.email ?? "") : (parsed.data.memberId ?? ""),
        );

        const decision = await loginThrottle.check(throttleContext);
        if (!decision.ok) {
          console.warn("Credentials login throttled", {
            role: expectedRole,
            ipKey: throttleContext.ipKey,
            accountKey: throttleContext.accountKey,
            scope: decision.scope,
            retryAfterMs: decision.retryAfterMs,
          });
          throw new LoginRateLimitError(decision.scope);
        }

        // All rejected credentials take the same path: increment both counters
        // and emit a structured internal audit line. Keys are hashed and the
        // caller never sees whether the account exists.
        const reject = async (reason: string) => {
          await loginThrottle.recordFailure(throttleContext);
          console.warn("Credentials login rejected", {
            role: expectedRole,
            ipKey: throttleContext.ipKey,
            accountKey: throttleContext.accountKey,
            reason,
          });
          return null;
        };

        const identityFields = {
          id: true,
          email: true,
          fullName: true,
          profileImage: true,
          role: true,
          memberId: true,
          status: true,
          passwordHash: true,
          accountLink: { select: { ownerId: true } },
        } as const;

        let member;
        if (adminLogin) {
          // The admin form has one identifier only. A Member ID is rejected so
          // internal IDs such as SL000000 can never become login names.
          const email = normalizeAdminEmail(parsed.data.email);
          if (!email || parsed.data.memberId) return reject("INVALID_IDENTIFIER");
          member = await prisma.member.findFirst({
            where: {
              email: { equals: email, mode: "insensitive" },
              role: { in: ["ADMIN", "STAFF"] },
            },
            select: identityFields,
          });
        } else {
          if (parsed.data.email) return reject("INVALID_IDENTIFIER");
          const memberId = normalizeMemberId(parsed.data.memberId ?? "");
          if (!MEMBER_ID_PATTERN.test(memberId)) return reject("INVALID_IDENTIFIER");
          member = await prisma.member.findUnique({
            where: { memberId },
            select: identityFields,
          });
        }
        if (!member || !credentialRoleAllowed(member.role, expectedRole)) {
          return reject("IDENTITY_REJECTED");
        }
        if (adminLogin && member.status !== "ACTIVE") return reject("ADMIN_NOT_ACTIVE");

        const valid = await bcrypt.compare(parsed.data.password, member.passwordHash);
        if (!valid) return reject("PASSWORD_INVALID");

        await loginThrottle.clearAccount(throttleContext.accountKey);
        return {
          id: member.id,
          email: member.email,
          name: member.fullName,
          image: member.profileImage,
          role: member.role,
          memberId: member.memberId,
          status: member.status,
          principalId: member.accountLink?.ownerId ?? member.id,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const identity = user as Identity;
        token.id = identity.id;
        token.principalId = identity.principalId ?? identity.id;
        token.role = identity.role;
        token.memberId = identity.memberId;
        token.status = identity.status;
        token.name = identity.name ?? token.name ?? null;
        token.email = identity.email ?? token.email ?? null;
        token.picture = identity.image ?? null;
      }

      if (trigger === "update" && session && typeof session === "object") {
        const update = session as {
          switchTo?: unknown;
          name?: unknown;
          image?: unknown;
        };

        if (typeof update.switchTo === "string" && update.switchTo) {
          const ownerId =
            typeof token.principalId === "string" && token.principalId
              ? token.principalId
              : typeof token.id === "string"
                ? token.id
                : "";
          if (!ownerId) return token;
          const target = await prisma.member.findUnique({
            where: { id: update.switchTo },
            select: {
              id: true,
              email: true,
              fullName: true,
              profileImage: true,
              role: true,
              memberId: true,
              status: true,
            },
          });
          // Account switching is a member-only multi-account feature. Admin and
          // staff sessions can never swap into a different identity this way.
          if (
            target &&
            token.role === "MEMBER" &&
            target.role === "MEMBER" &&
            (await canAccessAccount(prisma, ownerId, target.id))
          ) {
            token.id = target.id;
            token.email = target.email;
            token.name = target.fullName;
            token.picture = target.profileImage;
            token.role = target.role;
            token.memberId = target.memberId;
            token.status = target.status;
            token.principalId = ownerId;
          }
        }

        if (update.name === null || typeof update.name === "string") token.name = update.name;
        if (update.image === null || typeof update.image === "string") token.picture = update.image;
      }

      return token;
    },
  },
});
