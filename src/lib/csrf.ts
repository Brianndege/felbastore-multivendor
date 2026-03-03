import type { NextApiRequest, NextApiResponse } from "next";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseHost(value: string | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

function getAllowedHosts(req: NextApiRequest): Set<string> {
  const hosts = new Set<string>();
  const requestHost = parseHost(req.headers.host);

  if (requestHost) {
    hosts.add(requestHost);
  }

  const envUrls = [
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
  ];

  for (const envUrl of envUrls) {
    const host = parseHost(envUrl);
    if (host) hosts.add(host);
  }

  return hosts;
}

function matchesAllowedHost(value: string | undefined, allowedHosts: Set<string>): boolean {
  const host = parseHost(value);
  if (!host) return false;
  return allowedHosts.has(host);
}

export function enforceCsrfOrigin(req: NextApiRequest, res: NextApiResponse): boolean {
  const method = (req.method || "GET").toUpperCase();

  if (SAFE_METHODS.has(method)) {
    return true;
  }

  if (req.headers["x-webhook-source"] === "payment-provider") {
    return true;
  }

  const allowedHosts = getAllowedHosts(req);
  if (allowedHosts.size === 0) {
    res.status(403).json({ error: "Request origin could not be validated" });
    return false;
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const secFetchSiteHeader = req.headers["sec-fetch-site"];
  const secFetchSite = Array.isArray(secFetchSiteHeader) ? secFetchSiteHeader[0] : secFetchSiteHeader;

  if (secFetchSite && ["same-origin", "same-site", "none"].includes(secFetchSite.toLowerCase())) {
    return true;
  }

  if (matchesAllowedHost(origin, allowedHosts) || matchesAllowedHost(referer, allowedHosts)) {
    return true;
  }

  res.status(403).json({ error: "Invalid CSRF origin" });
  return false;
}
