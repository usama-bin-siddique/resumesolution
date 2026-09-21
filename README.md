# GlobalCV

Astro public pages, a React resume editor, and a small Cloudflare-compatible Worker for private D1 drafts. Guest creation, document import and PDF export do not require authentication. Hosted accounts use Sites' dispatch-owned Sign in with ChatGPT.

## Development

`npm install`, `npm run dev`, `npm run db:generate`, `npm test`, `npm run build`.

The local Astro preview supports guest workflows. Its API middleware deliberately reports an anonymous visitor; it does not simulate a real account. Hosted identity headers are only trusted behind the Sites dispatcher. Never expose the draft Worker directly with untrusted identity headers.

Imports are client-side PDF.js / Mammoth text extraction, followed by conservative section mapping and mandatory review. Scanned PDFs are rejected; OCR is not implemented. DOCX import is supported; DOCX export is outside the first release. PDF export is client-side React PDF with selectable text and embedded Noto Sans fonts. Templates use one shared resume schema. English-first, no Arabic/Urdu layout guarantee.

## Saving

Temporary state uses sessionStorage. Only an explicit Save draft creates an account draft. Existing account drafts autosave with optimistic revision checks. All draft reads/writes/deletes are scoped by the authenticated user ID. Schema changes are generated in Drizzle and applied by hosting. Never rewrite an already applied migration.

## Launch items owned by the publisher

- Add a custom domain if desired, rebuild with PUBLIC_SITE_URL for canonical URLs and sitemap.
- Obtain AdSense approval and a publisher ID. This release deliberately ships no live advertising, fabricated ad account, analytics or consent placeholder. Integrate a certified consent-management platform where required before enabling ads; reserve ad dimensions on public content routes and keep the editor/PDF ad-free.
- Supply business/operator identity and a real contact channel; review privacy/terms against the actual operation and provider backup retention before a commercial launch. Current pages describe implemented data handling, not a completed legal compliance review.
- Keep guides accurate and add useful original profession examples over time.

## Validation

Worker tests cover guest protection, draft ownership, optimistic concurrency, deletion, cross-origin writes and schema validation. Public pages are static HTML; only editor/draft routes hydrate React. PDF and import libraries are dynamically imported when requested.
