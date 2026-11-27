import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { routing } from "@/i18n/routing";

const { auth } = NextAuth(authConfig);
const intlMiddleware = createIntlMiddleware(routing);

export default auth((request) => {
  const response = intlMiddleware(request);
  const { pathname } = request.nextUrl;

  const locale =
    routing.locales.find((item) => pathname === `/${item}` || pathname.startsWith(`/${item}/`)) ??
    routing.defaultLocale;

  const user = request.auth?.user;
  const isLoginPage = pathname === `/${locale}/login`;
  const isAdminLoginPage = pathname === `/${locale}/admin-login`;
  const isRegisterPage = pathname === `/${locale}/register`;
  const isAdminArea = pathname === `/${locale}/admin` || pathname.startsWith(`/${locale}/admin/`);
  const isMemberArea = pathname === `/${locale}/member` || pathname.startsWith(`/${locale}/member/`);

  if ((isLoginPage || isRegisterPage) && user?.id) {
    const dashboard = user.role === "ADMIN" ? "admin/dashboard" : "member/dashboard";
    return NextResponse.redirect(new URL(`/${locale}/${dashboard}`, request.url));
  }

  // A member may open the administrator login to switch accounts, but an
  // administrator has no reason to see it again.
  if (isAdminLoginPage && user?.role === "ADMIN") {
    return NextResponse.redirect(new URL(`/${locale}/admin/dashboard`, request.url));
  }

  if (isAdminArea && user?.role !== "ADMIN") {
    return NextResponse.redirect(new URL(`/${locale}/admin-login`, request.url));
  }

  if (isMemberArea && !user) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  return response;
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
