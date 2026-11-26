import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { getProductById, type StoreProduct } from "@/lib/catalog";

export const CART_COOKIE = "sl_cart";

export type CartCookieItem = {
  productId: string;
  quantity: number;
};

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  nameBn: string | null;
  image: string;
  unitPricePaisa: string;
  lineTotalPaisa: string;
  quantity: number;
  stock: number;
};

export type CartSummary = {
  lines: CartLine[];
  itemCount: number;
  subtotalPaisa: string;
};

const emptyCart: CartSummary = { lines: [], itemCount: 0, subtotalPaisa: "0" };

function parseCart(value: string | undefined): CartCookieItem[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CartCookieItem => {
      if (typeof item !== "object" || item === null) return false;
      const candidate = item as Record<string, unknown>;
      return (
        typeof candidate.productId === "string" &&
        typeof candidate.quantity === "number" &&
        Number.isInteger(candidate.quantity) &&
        candidate.quantity > 0
      );
    });
  } catch {
    return [];
  }
}

export async function readCartItems(): Promise<CartCookieItem[]> {
  const store = await cookies();
  return parseCart(store.get(CART_COOKIE)?.value);
}

export async function writeCartItems(items: CartCookieItem[]): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, JSON.stringify(items), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getCartSummary(): Promise<CartSummary> {
  const items = await readCartItems();
  if (items.length === 0) return emptyCart;

  const products = await Promise.all(items.map((item) => getProductById(item.productId)));
  const lines: CartLine[] = [];
  let itemCount = 0;
  let subtotal = 0n;

  for (let index = 0; index < items.length; index += 1) {
    const product: StoreProduct | null = products[index];
    if (!product) continue;

    const quantity = Math.min(items[index].quantity, Math.max(product.stock, 1));
    const unit = BigInt(product.pricePaisa);
    const lineTotal = unit * BigInt(quantity);

    lines.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      nameBn: product.nameBn,
      image: product.image,
      unitPricePaisa: unit.toString(),
      lineTotalPaisa: lineTotal.toString(),
      quantity,
      stock: product.stock,
    });

    itemCount += quantity;
    subtotal += lineTotal;
  }

  return { lines, itemCount, subtotalPaisa: subtotal.toString() };
}

export async function getCartCount(): Promise<number> {
  const summary = await getCartSummary();
  return summary.itemCount;
}

export async function addCartItem(productId: string, quantity: number): Promise<CartSummary> {
  const product = await getProductById(productId);
  if (!product) throw new Error("Product not found");
  if (product.stock <= 0) throw new Error("Out of stock");

  const requested = Math.max(1, Math.min(Math.trunc(quantity), product.stock));
  const items = await readCartItems();
  const existing = items.find((item) => item.productId === productId);

  if (existing) {
    existing.quantity = Math.min(existing.quantity + requested, product.stock);
  } else {
    items.push({ productId, quantity: requested });
  }

  await writeCartItems(items);
  return getCartSummary();
}

export async function updateCartItem(productId: string, quantity: number): Promise<CartSummary> {
  const items = await readCartItems();
  const product = await getProductById(productId);
  const maxStock = product?.stock ?? 1;

  if (quantity <= 0) {
    await writeCartItems(items.filter((item) => item.productId !== productId));
    return getCartSummary();
  }

  const existing = items.find((item) => item.productId === productId);
  if (!existing) return getCartSummary();

  existing.quantity = Math.min(Math.trunc(quantity), Math.max(maxStock, 1));
  await writeCartItems(items);
  return getCartSummary();
}

export async function removeCartItem(productId: string): Promise<CartSummary> {
  const items = await readCartItems();
  await writeCartItems(items.filter((item) => item.productId !== productId));
  return getCartSummary();
}

export async function clearCart(): Promise<void> {
  await writeCartItems([]);
}

export function createCartSessionId(): string {
  return randomUUID();
}
