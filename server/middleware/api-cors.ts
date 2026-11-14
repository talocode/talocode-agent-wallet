const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, idempotency-key",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "cache-control": "no-store",
};

export default async function apiCorsMiddleware(
  event: { url: URL; req: { method?: string } },
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  if (!event.url.pathname.startsWith("/api/v1")) return next();
  if ((event.req.method ?? "GET").toUpperCase() === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  const result = await next();
  if (result instanceof Response) {
    const headers = new Headers(result.headers);
    for (const [key, value] of Object.entries(CORS)) {
      if (!headers.has(key)) headers.set(key, value);
    }
    return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
  }
  return result;
}
