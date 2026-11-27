import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeMemberId } from "@/lib/member-id";
import { canAccessAccount } from "@/lib/account-ownership";
import { authConfig } from "@/auth.config";

const MEMBER_ID_PATTERN = /^SL\d{6}$/;

type Identity = {
  id: string;
  principalId: string;
  role: "MEMBER" | "ADMIN";
  memberId: string;
  status: "INACTIVE" | "ACTIVE" | "SUSPENDED";
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

const loginSchema = z.object({
  memberId: z.string().min(1),
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
        password: { label: "Password", type: "password" },
        expectedRole: { label: "Expected role", type: "text" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const memberId = normalizeMemberId(parsed.data.memberId);
        if (!MEMBER_ID_PATTERN.test(memberId)) return null;

        const member = await prisma.member.findUnique({
          where: { memberId },
          select: {
            id: true,
            email: true,
            fullName: true,
            profileImage: true,
            role: true,
            memberId: true,
            status: true,
            passwordHash: true,
            accountLink: { select: { ownerId: true } },
          },
        });
        if (!member) return null;

        if (parsed.data.expectedRole === "ADMIN" && member.role !== "ADMIN") return null;
        if (parsed.data.expectedRole === "MEMBER" && member.role === "ADMIN") return null;

        const valid = await bcrypt.compare(parsed.data.password, member.passwordHash);
        if (!valid) return null;

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
          if (target && (await canAccessAccount(prisma, ownerId, target.id))) {
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
