# GlobalCV

Astro public pages, a React resume editor, and a small Cloudflare-compatible Worker for private D1 drafts. Guest creation, document import and PDF export do not require authentication. Accounts use GlobalCV email/password login and opaque HttpOnly session cookies.

## Run locally (Windows)
Install Node.js 24 or newer, then open PowerShell:

```powershell
cd "C:\Users\zigron\Documents\Codex\2026-09-21\i-x20\outputs\globalcv"
npm install
npm run dev
```

Open http://127.0.0.1:4321/ (use this exact host). Local accounts and drafts are stored in .sites-runtime/globalcv.sqlite; migrations apply automatically. This is a separate database from the published site. Astro runs the dev server in the background; stop it with `npx astro dev stop`.

Run `npm test` for API tests, `npm run build` for production output, and `npm run db:generate` only when changing the database schema.

## Accounts
Use /login/, /signup/ and /dashboard/. Registration issues a one-time recovery code: save it outside the browser. /recover/ resets a password using that code and rotates the code. No SMTP, email verification or email-based reset is configured. Account security in the dashboard changes the password and invalidates other sessions.

Passwords use salted scrypt (N=16384, r=8, p=5). Only hashes of session tokens and recovery codes are stored. HTTPS sessions use a Secure, HttpOnly, SameSite=Strict cookie. Write requests require a matching Origin. Auth attempts are rate-limited in the database.

Earlier provider-linked drafts are preserved in the database, but not automatically transferred to email/password accounts: an unverified matching email cannot prove ownership. A verified migration process would be required to transfer those records safely.

Imports are client-side PDF.js / Mammoth text extraction, followed by conservative section mapping and mandatory review. Scanned PDFs are rejected; OCR is not implemented. DOCX import is supported; DOCX export is outside the first release. PDF export is client-side React PDF with selectable text and embedded Noto Sans fonts. Templates use one shared resume schema. English-first, no Arabic/Urdu layout guarantee.

## Saving

Temporary state uses sessionStorage. Only an explicit Save draft creates an account draft. Existing account drafts autosave with optimistic revision checks. All draft reads/writes/deletes are scoped by the authenticated user ID. Schema changes are generated in Drizzle and applied by hosting. Never rewrite an already applied migration.

## Launch items owned by the publisher

- Add a custom domain if desired, rebuild with PUBLIC_SITE_URL for canonical URLs and sitemap.
- Obtain AdSense approval and a publisher ID. This release deliberately ships no live advertising, fabricated ad account, analytics or consent placeholder. Integrate a certified consent-management platform where required before enabling ads; reserve ad dimensions on public content routes and keep the editor/PDF ad-free.
- Supply business/operator identity and a real contact channel; review privacy/terms against the actual operation and provider backup retention before a commercial launch. Current pages describe implemented data handling, not a completed legal compliance review.
- Keep guides accurate and add useful original profession examples over time.

## Validation

Worker tests cover guest protection, draft ownership, optimistic concurrency, deletion, cross-origin writes and schema validation. Public pages are static HTML; only editor/account routes hydrate React. PDF and import libraries are dynamically imported when requested.
