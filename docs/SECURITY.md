# Sandeep Opportunity OS — Security & Secret Hygiene (`docs/SECURITY.md`)

1. **Zero Client Secret Exposure**: `DATABASE_URL`, `APP_SESSION_SECRET`, `APP_ADMIN_PASSWORD`, `AGENT_API_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_JSON`, and model API keys reside strictly in server-side deployment secrets and are excluded via `.gitignore`.
2. **Private Database Boundary**: Cloudflare D1 is bound directly to the Worker and is never reachable from browser code. Browser writes require a `Secure`, `HttpOnly`, `SameSite=Strict` signed administrator session; agent endpoints require a separate bearer token.
3. **XSS & JSON-LD Serialization**: All external URLs are validated against `https:` / `mailto:` protocols, and all external links enforce `rel="noopener noreferrer"`.
4. **HTTP Response Headers (`public/_headers`)**: Enforces 2-year HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a strict `Content-Security-Policy`.
