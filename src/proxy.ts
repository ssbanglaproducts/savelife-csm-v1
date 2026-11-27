import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { appUrl } from "@/lib/auth-env";
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

  const isAdminSession = user?.role === "ADMIN" || user?.role === "STAFF";
  const dashboard = isAdminSession ? "admin/dashboard" : "member/dashboard";

  if ((isLoginPage || isRegisterPage) && user?.id) {
    return NextResponse.redirect(appUrl(`/${locale}/${dashboard}`, request.url));
  }

  // The two login pages are role-specific. A member may still visit the admin
  // login to switch accounts; an admin/staff session may not revisit either.
  if ((isAdminLoginPage && isAdminSession) || (isLoginPage && user?.id && isAdminSession)) {
    return NextResponse.redirect(appUrl(`/${locale}/admin/dashboard`, request.url));
  }

  if (isAdminArea && !isAdminSession) {
    return NextResponse.redirect(appUrl(`/${locale}/admin-login`, request.url));
  }

  if (isMemberArea && user?.role !== "MEMBER") {
    return NextResponse.redirect(
      appUrl(`/${locale}/${isAdminSession ? "admin-login" : "login"}`, request.url),
    );
  }

  return response;
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
