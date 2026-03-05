import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const API_RATE_WINDOW_MS = 60_000;
const API_DEFAULT_RATE_MAX = 180;
const API_SENSITIVE_RATE_MAX = 60;
const sensitiveApiPrefixes = ["/api/auth", "/api/payment", "/api/admin"];

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const edgeApiRateLimitStore = new Map<string, RateLimitEntry>();
const googleCallbackReplayStore = new Map<string, number>();

const GOOGLE_CALLBACK_REPLAY_WINDOW_MS = 5 * 60_000;
const GOOGLE_CALLBACK_CODE_COOKIE = "__gauth_code_seen";

function getRateLimitStore() {
  return edgeApiRateLimitStore;
}

function pruneGoogleCallbackReplayStore(now: number) {
  for (const [code, seenAt] of googleCallbackReplayStore.entries()) {
    if (now - seenAt > GOOGLE_CALLBACK_REPLAY_WINDOW_MS) {
      googleCallbackReplayStore.delete(code);
    }
  }
}

function getPostAuthRedirectFromCookie(request: NextRequest) {
  const callbackCookie = request.cookies.get("__Secure-next-auth.callback-url")?.value
    || request.cookies.get("next-auth.callback-url")?.value;

  if (!callbackCookie) {
    return "/account";
  }

  try {
    const currentOrigin = request.nextUrl.origin;
    const callbackUrl = callbackCookie.startsWith("http")
      ? new URL(callbackCookie)
      : new URL(callbackCookie, currentOrigin);

    if (callbackUrl.origin !== currentOrigin) {
      return "/account";
    }

    const candidatePath = `${callbackUrl.pathname}${callbackUrl.search}`;
    if (!candidatePath.startsWith("/") || candidatePath.startsWith("//")) {
      return "/account";
    }

    return candidatePath;
  } catch {
    return "/account";
  }
}

function getAllowedOrigins(request: NextRequest) {
  const envOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const appOrigins = [
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    `${request.nextUrl.protocol}//${request.headers.get("host") || ""}`,
  ].filter((origin): origin is string => Boolean(origin && origin.trim()));

  return new Set([...envOrigins, ...appOrigins]);
}

function applyCorsHeaders(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get("origin");
  const allowedOrigins = getAllowedOrigins(request);
  const isAllowedOrigin = !origin || allowedOrigins.has(origin);

  if (origin && isAllowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-CSRF-Token");
  response.headers.set("Access-Control-Allow-Credentials", "true");

  return isAllowedOrigin;
}

function enforceApiRateLimit(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const clientIp = forwardedFor.split(",")[0]?.trim() || "unknown";
  const pathname = request.nextUrl.pathname;
  const isSensitivePath = sensitiveApiPrefixes.some((prefix) => pathname.startsWith(prefix));
  const maxRequests = isSensitivePath ? API_SENSITIVE_RATE_MAX : API_DEFAULT_RATE_MAX;

  const now = Date.now();
  const currentWindow = Math.floor(now / API_RATE_WINDOW_MS);
  const key = `${clientIp}:${currentWindow}:${isSensitivePath ? "sensitive" : "default"}`;

  const store = getRateLimitStore();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + API_RATE_WINDOW_MS });
    return { allowed: true, remaining: maxRequests - 1, resetInMs: API_RATE_WINDOW_MS };
  }

  if (current.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetInMs: Math.max(0, current.resetAt - now) };
  }

  current.count += 1;
  store.set(key, current);
  return { allowed: true, remaining: maxRequests - current.count, resetInMs: Math.max(0, current.resetAt - now) };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminLoginKey = process.env.ADMIN_LOGIN_KEY?.trim();
  const isProduction = process.env.NODE_ENV === "production";
  const adminAccessCookieName = "admin_login_access";
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("host") || "";
  const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1");

  if (pathname.startsWith("/api")) {
    let googleCallbackCodeForCookie: string | null = null;

    if (pathname === "/api/auth/callback/google" && request.method === "GET") {
      const oauthCode = request.nextUrl.searchParams.get("code");
      const cookieSeenCode = request.cookies.get(GOOGLE_CALLBACK_CODE_COOKIE)?.value;

      if (oauthCode) {
        if (cookieSeenCode === oauthCode) {
          const callbackToken = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

          if (callbackToken?.role === "admin") {
            return NextResponse.redirect(new URL("/admin/dashboard", request.url));
          }

          if (callbackToken?.role === "vendor" || callbackToken?.role === "both") {
            return NextResponse.redirect(new URL("/vendors/dashboard", request.url));
          }

          if (callbackToken?.role === "user") {
            return NextResponse.redirect(new URL("/account", request.url));
          }

          return NextResponse.redirect(new URL(getPostAuthRedirectFromCookie(request), request.url));
        }

        const now = Date.now();
        pruneGoogleCallbackReplayStore(now);

        const previousSeenAt = googleCallbackReplayStore.get(oauthCode);
        googleCallbackReplayStore.set(oauthCode, now);
        googleCallbackCodeForCookie = oauthCode;

        if (previousSeenAt && now - previousSeenAt <= GOOGLE_CALLBACK_REPLAY_WINDOW_MS) {
          const callbackToken = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

          if (callbackToken?.role === "admin") {
            return NextResponse.redirect(new URL("/admin/dashboard", request.url));
          }

          if (callbackToken?.role === "vendor" || callbackToken?.role === "both") {
            return NextResponse.redirect(new URL("/vendors/dashboard", request.url));
          }

          if (callbackToken?.role === "user") {
            return NextResponse.redirect(new URL("/account", request.url));
          }

          return NextResponse.redirect(new URL(getPostAuthRedirectFromCookie(request), request.url));
        }
      }
    }

    const origin = request.headers.get("origin");
    const preflightResponse = new NextResponse(null, { status: 204 });
    const isAllowedOrigin = applyCorsHeaders(request, preflightResponse);

    if (origin && !isAllowedOrigin) {
      return new NextResponse(JSON.stringify({ error: "CORS origin not allowed" }), {
        status: 403,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
      });
    }

    if (request.method === "OPTIONS") {
      return preflightResponse;
    }

    const limit = enforceApiRateLimit(request);
    if (!limit.allowed) {
      const rateLimitedResponse = new NextResponse(
        JSON.stringify({ error: "Too many requests. Please retry shortly." }),
        {
          status: 429,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "retry-after": String(Math.ceil(limit.resetInMs / 1000)),
          },
        }
      );

      applyCorsHeaders(request, rateLimitedResponse);
      return rateLimitedResponse;
    }

    const response = NextResponse.next();
    applyCorsHeaders(request, response);
    response.headers.set("X-RateLimit-Remaining", String(limit.remaining));
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(limit.resetInMs / 1000)));

    if (pathname === "/api/auth/callback/google" && request.method === "GET" && googleCallbackCodeForCookie) {
      response.cookies.set(GOOGLE_CALLBACK_CODE_COOKIE, googleCallbackCodeForCookie, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/api/auth/callback/google",
        maxAge: 300,
      });
    }

    return response;
  }

  if (process.env.NODE_ENV === "production" && !isLocalHost && forwardedProto === "http") {
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = "https";
    return NextResponse.redirect(httpsUrl, 308);
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (
    pathname === "/auth/login" ||
    pathname === "/auth/google-onboarding" ||
    pathname === "/auth/otp" ||
    pathname === "/auth/forgot-password" ||
    pathname === "/auth/resend-verification" ||
    pathname === "/auth/verify-email" ||
    pathname === "/vendors/login"
  ) {
    if (token?.role === "admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }

    if (token?.role === "vendor") {
      return NextResponse.redirect(new URL("/vendors/dashboard", request.url));
    }

    if (token?.role === "both") {
      return NextResponse.redirect(new URL("/vendors/dashboard", request.url));
    }

    if (token?.role === "user") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (pathname.startsWith("/auth/admin-login")) {
    if (token?.role === "admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }

    if (isProduction && !adminLoginKey) {
      return new NextResponse("Not Found", { status: 404 });
    }

    if (adminLoginKey) {
      const accessKeyFromQuery = request.nextUrl.searchParams.get("k");
      const accessKeyFromHeader = request.headers.get("x-admin-access-key");
      const providedAccessKey = accessKeyFromQuery || accessKeyFromHeader;
      const cookieAccessKey = request.cookies.get(adminAccessCookieName)?.value;
      const hasValidCookie = cookieAccessKey === adminLoginKey;

      if (!hasValidCookie && providedAccessKey !== adminLoginKey) {
        return new NextResponse("Not Found", { status: 404 });
      }

      if (!hasValidCookie && accessKeyFromQuery === adminLoginKey) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.searchParams.delete("k");
        const response = NextResponse.redirect(redirectUrl);

        response.cookies.set(adminAccessCookieName, adminLoginKey, {
          httpOnly: true,
          secure: isProduction,
          sameSite: "strict",
          maxAge: 600,
          path: "/auth/admin-login",
        });

        return response;
      }

      if (!hasValidCookie && accessKeyFromHeader === adminLoginKey) {
        const response = NextResponse.next();

        response.cookies.set(adminAccessCookieName, adminLoginKey, {
          httpOnly: true,
          secure: isProduction,
          sameSite: "strict",
          maxAge: 600,
          path: "/auth/admin-login",
        });

        return response;
      }
    }

    if (token && token.role !== "admin") {
      const homeUrl = new URL("/", request.url);
      homeUrl.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(homeUrl);
    }
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/dashboard/admin")) {
    if (!token || token.role !== "admin") {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith("/vendors/dashboard")) {
    if (!token) {
      const loginUrl = new URL("/vendors/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (token.role !== "vendor" && token.role !== "both") {
      const homeUrl = new URL("/", request.url);
      homeUrl.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(homeUrl);
    }
  }

  if (pathname.startsWith("/orders") || pathname.startsWith("/checkout")) {
    if (!token) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (token.role !== "user" && token.role !== "both") {
      const homeUrl = new URL("/", request.url);
      homeUrl.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*", "/dashboard/admin", "/dashboard/admin/:path*", "/auth/admin-login", "/auth/login", "/auth/google-onboarding", "/auth/otp", "/auth/forgot-password", "/auth/resend-verification", "/auth/verify-email", "/vendors/login", "/vendors/dashboard/:path*", "/orders/:path*", "/checkout/:path*"],
};
