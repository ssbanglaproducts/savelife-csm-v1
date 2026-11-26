import { NextResponse } from "next/server";
import { getCartCount } from "@/lib/cart";
import { rejectInactiveCartAccess } from "@/lib/cart-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const blocked = await rejectInactiveCartAccess();
  if (blocked) return blocked;
  return NextResponse.json({ count: await getCartCount() });
}
