const ORIGIN = "https://salah-api.abdlh.com";
const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
];

export default {
  async fetch(request) {
    const incomingUrl = new URL(request.url);
    const targetUrl = new URL(incomingUrl.pathname + incomingUrl.search, ORIGIN);
    const headers = new Headers(request.headers);

    for (const header of HOP_BY_HOP_HEADERS) {
      headers.delete(header);
    }

    headers.set("x-forwarded-host", incomingUrl.host);
    headers.set("x-salah-api-proxy", "cloudflare-worker");

    return fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });
  },
};
