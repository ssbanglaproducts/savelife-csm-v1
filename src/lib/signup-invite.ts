import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type SignupInvitePayload = {
  sponsorMemberId: string;
  placementMemberId: string;
  placementSlot: number;
};

type SignedPayload = SignupInvitePayload & {
  issuedAt: number;
  nonce: string;
  version: 1;
};

const VERSION = 1;

function secret(): string {
  const value = process.env.SIGNUP_INVITE_SECRET ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!value) {
    throw new Error("Signup invite signing secret is not configured");
  }
  return value;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

/** Creates a tamper-evident token tied to one exact placement slot. */
export function createSignupInvite(payload: SignupInvitePayload): string {
  const signed: SignedPayload = {
    ...payload,
    issuedAt: Date.now(),
    nonce: randomBytes(8).toString("hex"),
    version: VERSION,
  };
  const body = encode(JSON.stringify(signed));
  return `v1.${body}.${signature(body)}`;
}

export function verifySignupInvite(token: string | null | undefined): SignupInvitePayload | null {
  if (!token) return null;
  const [prefix, body, supplied] = token.split(".");
  if (prefix !== "v1" || !body || !supplied) return null;

  const expected = signature(body);
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(decode(body)) as Partial<SignedPayload>;
    if (parsed.version !== VERSION) return null;
    if (
      typeof parsed.sponsorMemberId !== "string" ||
      typeof parsed.placementMemberId !== "string" ||
      typeof parsed.placementSlot !== "number" ||
      !Number.isInteger(parsed.placementSlot)
    ) {
      return null;
    }
    return {
      sponsorMemberId: parsed.sponsorMemberId,
      placementMemberId: parsed.placementMemberId,
      placementSlot: parsed.placementSlot,
    };
  } catch {
    return null;
  }
}

export function buildSignupInviteUrl(
  locale: string,
  token: string,
  payload: SignupInvitePayload,
): string {
  const params = new URLSearchParams({
    sponsor: payload.sponsorMemberId,
    placement: payload.placementMemberId,
    slot: String(payload.placementSlot),
    invite: token,
  });
  return `/${locale}/register?${params.toString()}`;
}
