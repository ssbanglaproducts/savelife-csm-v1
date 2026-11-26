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
    jwt({ token, user, trigger, session }) {
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

      if (trigger === "update" && session?.user) {
        const next = session.user as Partial<Identity>;
        // The owner link is immutable here; the switch route validates it.
        if (next.id) token.id = next.id;
        if (next.role) token.role = next.role;
        if (next.memberId) token.memberId = next.memberId;
        if (next.status) token.status = next.status;
        if (next.name !== undefined) token.name = next.name;
        if (next.email !== undefined) token.email = next.email;
        if (next.image !== undefined) token.picture = next.image;
      }

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
