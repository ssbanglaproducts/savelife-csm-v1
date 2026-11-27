import type { DefaultSession } from "next-auth";

type Role = "MEMBER" | "ADMIN" | "STAFF";
type MemberStatus = "INACTIVE" | "ACTIVE" | "SUSPENDED";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      principalId: string;
      role: Role;
      memberId: string;
      status: MemberStatus;
    } & DefaultSession["user"];
  }

  interface User {
    principalId?: string;
    role: Role;
    memberId: string;
    status: MemberStatus;
    /** Server-validated account-switch marker; never accepted as an identity claim. */
    switchTo?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    principalId?: string;
    role: Role;
    memberId: string;
    status: MemberStatus;
  }
}
