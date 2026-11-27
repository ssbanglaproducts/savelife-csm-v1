/** Public identity shared with the storefront header and panel account menu. */
export type MemberStatus = "INACTIVE" | "ACTIVE" | "SUSPENDED";

export type Viewer = {
  name: string;
  image: string | null;
  memberId: string;
  role: "MEMBER" | "ADMIN" | "STAFF";
  status?: MemberStatus;
  phone?: string | null;
};
