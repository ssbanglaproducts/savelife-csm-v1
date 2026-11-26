import { NextResponse } from "next/server";
import { getCartSummary } from "@/lib/cart";
import { rejectInactiveCartAccess } from "@/lib/cart-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const blocked = await rejectInactiveCartAccess();
  if (blocked) return blocked;
  const cart = await getCartSummary();
  return NextResponse.json(cart);
}
