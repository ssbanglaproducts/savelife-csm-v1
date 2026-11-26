import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizeMemberId } from "@/lib/member-id";
import { authConfig } from "@/auth.config";

const MEMBER_ID_PATTERN = /^SL\d{6}$/;

const loginSchema = z.object({
  memberId: z.string().min(1),
  password: z.string().min(1),
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
});
