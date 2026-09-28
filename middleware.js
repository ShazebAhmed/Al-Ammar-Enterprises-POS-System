import { NextResponse } from "next/server";

// The admin panel has its own address, so its notifications, sign-in and service worker
// are separate from the shop's: on a phone with both apps, new-order alerts show in the
// Admin app and order updates in the Store app. Only the two live addresses redirect;
// Vercel previews and localhost serve everything as before.
const STORE_HOST = "alammarstore.vercel.app";
const ADMIN_HOST = "alammar-admin.vercel.app";
const ADMIN_PAGES = ["/admin", "/auth", "/reset-password"];

const under = (path, page) => path === page || path.startsWith(`${page}/`);

export function middleware(request) {
  const host = request.headers.get("host");
  const { pathname, search } = request.nextUrl;
  if (host === STORE_HOST && under(pathname, "/admin"))
    return NextResponse.redirect(`https://${ADMIN_HOST}${pathname}${search}`);
  if (host === ADMIN_HOST && !ADMIN_PAGES.some((p) => under(pathname, p))) {
    // After signing in the admin lands on "/" or "/account": that is the admin panel.
    if (pathname === "/" || pathname === "/account")
      return NextResponse.redirect(`https://${ADMIN_HOST}/admin`);
    return NextResponse.redirect(`https://${STORE_HOST}${pathname}${search}`);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: not the API, Next's files, the service worker, icons or .well-known.
  matcher: [
    "/((?!api|_next|\\.well-known|sw\\.js|offline\\.html|icons|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|icon\\.png|apple-icon\\.png|favicon\\.ico).*)",
  ],
};
