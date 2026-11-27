import type { NextAuthConfig } from "next-auth";

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

/** Edge-safe configuration shared by the app and the route proxy. */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/en/login" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
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

      // Identity and authorization claims are never accepted from client session
      // updates. The Node-only auth instance handles trusted account switches.
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const claims = token as Identity & { picture?: string | null };
        session.user.id = claims.id;
        session.user.principalId = claims.principalId ?? claims.id;
        session.user.role = claims.role;
        session.user.memberId = claims.memberId;
        session.user.status = claims.status;
        session.user.name = claims.name ?? session.user.name;
        session.user.email = claims.email ?? session.user.email;
        session.user.image = claims.picture ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
