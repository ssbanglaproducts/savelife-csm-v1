import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMemberStatus } from "@/lib/member-access";

/**
 * Cart and checkout are home-delivery features. Inactive members must use the
 * single activation purchase (office pickup) instead. Guests may keep a cart
 * so they can sign up and check out after activation.
 */
export async function rejectInactiveCartAccess(): Promise<Response | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (session.user.role !== "MEMBER") return null;

  const status = await getMemberStatus(session.user.id);
  if (status === "INACTIVE" || status === "SUSPENDED") {
    return NextResponse.json({ error: "CART_NOT_AVAILABLE" }, { status: 403 });
  }
  return null;
}
