import { NextResponse } from "next/server";
import { z } from "zod";
import { addCartItem, removeCartItem, updateCartItem } from "@/lib/cart";
import { rejectInactiveCartAccess } from "@/lib/cart-access";

export const dynamic = "force-dynamic";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(0).max(999),
});

async function parseBody(request: Request) {
  try {
    const body: unknown = await request.json();
    return itemSchema.safeParse(body);
  } catch {
    return null;
  }
}

function badRequest() {
  return NextResponse.json({ error: "Invalid cart item" }, { status: 400 });
}

export async function POST(request: Request) {
  const blocked = await rejectInactiveCartAccess();
  if (blocked) return blocked;

  const parsed = await parseBody(request);
  if (!parsed?.success || parsed.data.quantity < 1) return badRequest();

  try {
    const cart = await addCartItem(parsed.data.productId, parsed.data.quantity);
    return NextResponse.json(cart);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add item" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const blocked = await rejectInactiveCartAccess();
  if (blocked) return blocked;

  const parsed = await parseBody(request);
  if (!parsed?.success) return badRequest();

  try {
    const cart = await updateCartItem(parsed.data.productId, parsed.data.quantity);
    return NextResponse.json(cart);
  } catch {
    return NextResponse.json({ error: "Unable to update item" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const blocked = await rejectInactiveCartAccess();
  if (blocked) return blocked;

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  if (!productId) return badRequest();

  const cart = await removeCartItem(productId);
  return NextResponse.json(cart);
}
