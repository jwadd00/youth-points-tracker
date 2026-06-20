import { NextResponse } from "next/server";
import { authCookieName, authToken } from "@/lib/auth-token";

const PUBLIC_PATHS = [
  "/login",
  "/favicon.ico"
];

function isPublicPath(pathname) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/")
  );
}

export async function middleware(request) {
  if (!process.env.APP_PASSWORD || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const expectedToken = await authToken();
  const actualToken = request.cookies.get(authCookieName())?.value;
  if (actualToken === expectedToken) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
