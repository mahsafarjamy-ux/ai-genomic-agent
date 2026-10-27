# BioVerse payment deployment

## Architecture

Hosted Stripe Checkout handles one-time DNA plan payments. The backend retrieves the configured Stripe Price; both pricing pages display that amount and currency. Checkout rejects a stale displayed quote. Only a signed webhook that matches the paid session, customer, user and configured price activates a licence. Repeated events preserve the licence and cannot downgrade an existing higher plan.

Virtual consultation checkout has separate booking fulfilment and its own webhook. Empty consultant lists produce no appointment availability and no consultation payments. Publishing the page does not provision the backend, email or meeting providers.

## Vercel hosting

The root `app.py` and minimal `requirements.txt` deploy the existing account, payment and counselling routers as a separate Vercel FastAPI project. The Next.js website remains in `web`. Set `DATABASE_URL` to a durable PostgreSQL database (pooled connection URL with TLS), `FRONTEND_URL` to the website origin, and `CORS_ORIGINS` to that same origin. The cloud entrypoint does not mount local file or genomic processing endpoints. Vercel connections use SQLAlchemy NullPool. Keep existing database data and back it up before connecting; do not point the cloud app at a new database expecting old local accounts to appear.

Without a configured, reachable PostgreSQL database, the API returns an empty, closed counselling configuration and rejects account changes, bookings and fulfilment with HTTP 503. No account or payment state is written to Vercel temporary storage. Configure the durable database in the Vercel dashboard, then redeploy and verify `/api/health` reports `ready: true`.

## Production prerequisites

Configure secrets directly in the backend host, never frontend public variables or Git:

- `STRIPE_SECRET_KEY`: live key for the live BioVerse account.
- `STRIPE_PRICE_ESSENTIAL`, `STRIPE_PRICE_COMPLETE`, `STRIPE_PRICE_LIFETIME`: active one-time live price IDs. Confirm the founder's intended prices/currency first; old pages contained inconsistent amounts.
- `STRIPE_WEBHOOK_SECRET`: signing secret for `POST /api/billing/webhook`, events `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
- `FRONTEND_URL=https://ai-genomic-agent.vercel.app`.
- Counselling variables and separate webhook described in `COUNSELLING.md`.

Set Vercel `NEXT_PUBLIC_API_URL` to the verified HTTPS backend origin and rebuild. Until configured, new payment and counselling requests fail closed instead of attempting to contact a visitor's localhost. Personal local DNA processing remains local.

## Invoicing and Tax

For individually quoted research services, start with manually reviewed Dashboard invoices and Stripe's hosted Invoice Page. Do not email invoices, charge saved payment methods, or create priced products until the founder confirms the amount, customer and terms. This release does not automate invoice creation.

Stripe Tax is not enabled in code. Confirm registrations, business address, product-specific tax classification and inclusive/exclusive tax behaviour first. Consultation fulfilment currently verifies the exact final total against the published consultant fee; adding tax or discounts requires corresponding pricing and webhook validation changes and tests. Do not simply add automatic tax to this checkout. Clinical/genomic details must not be included in Stripe product descriptions, metadata or invoices.

## Verification

`python -m pytest tests/test_billing.py tests/test_counselling.py -q` covers quote mismatches, missing configuration, incorrect webhook signatures, unpaid events, mismatched customer/price, replay protection, email verification, consent, booking concurrency and cancellation reconciliation. `npm run build` in `web` validates Next.js production compilation and types.

Before accepting real payments, run sandbox end-to-end payment/expiry tests against the deployed backend and confirm live webhook delivery/configuration. Do not run a real customer charge as a smoke test.
