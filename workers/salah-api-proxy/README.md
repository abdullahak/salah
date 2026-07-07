# Salah API proxy Worker

This Worker keeps the public API contract at `https://api.salah.abdlh.com`
while forwarding requests to `https://salah-api.abdlh.com`, a first-level
hostname covered by the zone's existing Universal SSL certificate.

The origin hostname is routed through the existing Cloudflare Tunnel to the
Pi-hosted Fastify API.

Production requires an `ORIGIN_TOKEN` Worker secret. The Worker sends it as
`x-salah-origin-token`, and nginx rejects direct origin requests without it.
