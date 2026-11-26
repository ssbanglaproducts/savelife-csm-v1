/** Routes an INACTIVE member may open after signing in. */
export const INACTIVE_OPEN_PATHS = [
  "/member/dashboard",
  "/member/profile",
  "/member/referrals",
  "/member/program",
  "/member/company-info",
  "/member/wallet",
  "/member/transactions",
  "/member/top-up",
] as const;

/** Sidebar links that display a lock while the account is INACTIVE. */
export const INACTIVE_LOCKED_NAV_HREFS = [
  "/member/team",
  "/member/rank-rewards",
  "/member/salary",
  "/member/orders",
  "/member/investments",
  "/member/withdrawals",
  "/member/send-money",
] as const;

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

export function isPathOpenToInactive(pathname: string): boolean {
  const path = normalizePath(pathname);
  return INACTIVE_OPEN_PATHS.some((open) => path === open || path.startsWith(`${open}/`));
}

/**
 * Member-area routes that stay blurred while an account is INACTIVE. Wallet,
 * top-up and transaction history are open so members can fund and spend their
 * balance; order confirmation remains reachable because a wallet-paid order
 * activates the account immediately.
 */
export function isInactiveRestrictedPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  const inMemberArea = path === "/member" || path.startsWith("/member/");
  return inMemberArea && !isPathOpenToInactive(path);
}
