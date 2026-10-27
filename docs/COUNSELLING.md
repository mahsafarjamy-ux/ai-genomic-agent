# BioVerse counselling operations

This module adds a separate counselling workflow to existing BioVerse accounts. It does not automatically upload or share genomic files, analysis results, or DNA with consultants. The default consent text is a starting draft for the founder and counsellor to review, not a legal compliance certification.

## Configuration and first launch

1. Install backend dependencies from the existing requirements file. `stripe==11.6.0` and `email-validator==2.2.0` are added. Start the normal backend; the new SQLAlchemy tables are additive and created by the existing startup `init_db()` call. Back up the database before deployment. Use durable database storage and encrypted backups, never ephemeral application files for real patient data.
2. Set the variables in `.env.counselling.example` securely. Keep `COUNSELLING_ENABLED=false` while configuring. `FRONTEND_URL` is the exact HTTPS website origin. SMTP always uses TLS (STARTTLS on 587, implicit TLS on 465). No verification-code console fallback exists.
3. Put the founder/admin's verified account email in `COUNSELLING_ADMIN_EMAILS`. Register through `/counselling`, send the code, and confirm it. Existing BioVerse accounts may sign in and verify without registering again. New counselling passwords use scrypt; existing auth login accepts them.
4. Add actual consultant profiles, credentials, fees in integer cents, duration, and timezone from the admin panel. Match the consultant profile email to their verified account. The assigned consultant gets their booked sessions in the same counselling dashboard. No fabricated consultant profiles or fees are seeded.
5. Publish consultant-specific slots. API timestamps must include UTC offsets. The duration must match the profile. Overlapping slots are rejected transactionally. Remove only unreserved slots. Calendar times are stored in UTC. Slots less than one hour away are not bookable.
6. Configure Stripe test mode first. Register `POST /api/counselling/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `checkout.session.expired`. Use this endpoint's signing secret in `COUNSELLING_STRIPE_WEBHOOK_SECRET`; the existing licensing webhook is separate. Confirm Stripe supports the business/service before live payments.
7. Connect a Daily account. Calls use private, opaque per-booking rooms; short-lived tokens are issued only for verified patients and their assigned consultant, after paid confirmation, from ten minutes before to fifteen minutes after the session. Recording and automatic transcription are disabled in configuration. This does not prevent participants using their own recording software. Review provider data handling and applicable agreements for the clinical use before enabling.
8. Set `COUNSELLING_SUPPORT_PHONE` to the existing Twilio E.164 number after its BioVerse routing and knowledge are configured. The number alone does not reroute the dental assistant. Follow the voice service's setup instructions separately.
9. Finalize privacy notice, consent wording, consultant agreements, support/cancellation policy and access/retention operations. Configure rate limiting on public registration/login at the deployment edge. Existing BioVerse authentication uses browser bearer tokens, so enforce HTTPS, secure the frontend against XSS, and review the overall platform before collecting real patient information.
10. Run a complete test transaction, email delivery, patient/consultant meeting, expiry, and a real test call before changing `COUNSELLING_ENABLED=true` and switching to live Stripe keys. Neither this change nor local tests provision accounts, deploy services, approve providers, or verify a live phone number.

## Booking and payment behavior

A database conditional slot claim prevents competing patients from reserving one slot, including across backend workers. Checkout fees and currency come from the consultant's stored profile, never a client amount. Stripe receives an opaque booking ID, contact email and generic consultation description; no referral, DNA, consent or clinical detail is placed in payment metadata.

A return from Stripe does **not** confirm payment. Only a signature-verified event matching the booking ID, session, currency and exact amount confirms it. Duplicate delivery is safe. Unpaid and incomplete sessions do not confirm appointments.

Checkout normally expires after about 30 minutes. A hold is released only by an authenticated Stripe expiry event, not by the application clock. This deliberately preserves a slot when payment outcome is uncertain. Monitor Stripe webhook failures and redeliver events. If initial Checkout creation times out, use the booking's retry-payment operation; it reuses an idempotency key. If the retry window closes before a session was created, a verified admin can call `POST /admin/bookings/{id}/reconcile`. It retrieves the known Stripe session or, after expiry plus a minute, fully searches the bounded creation window before releasing a reservation with no session. Provider errors or an excessive result set fail closed. Do not clear a hold directly merely because time elapsed.

The first release records cancellation **requests**, visible to the assigned consultant. It does not automatically cancel a confirmed session, issue a refund, or release the slot. Staff issue the full refund in Stripe, then call `POST /admin/bookings/{id}/complete-cancellation`; the server verifies the full refund before marking cancelled and releasing the slot. A cancellation request still permits meeting entry until cancellation is actually completed. Automated rescheduling, refunds, reminders and external Google/Microsoft calendar synchronization are not included; published consultant calendars are BioVerse's source of availability.

## Consent and referral handling

Email confirmation codes expire after 15 minutes, allow five attempts, and can be requested no more than once a minute per account. Only salted hashes are stored. Codes are not returned in responses or logs. A new request invalidates the previous code.

Consent stores the exact displayed wording and acceptance timestamp. The version includes a content hash, so editing wording requires fresh acceptance even if the human-readable version is unchanged. Optional referral contact/reference details can be recorded after verification and consent; no clinical files are accepted by this endpoint. The verified patient and, after payment, assigned consultant can read referral details via `/bookings/{id}/referral`. These records are not available to other users.

## API

All paths are under `/api/counselling`. Authenticated calls use the existing `Authorization: Bearer <genomics_token>` header. Sensitive responses use `Cache-Control: no-store`.

- Public: `GET /config`, `GET /consultants/{id}/slots?month=YYYY-MM`, `POST /register`.
- Patient: `GET /me`, `POST /verification/send`, `POST /verification/confirm {code}`, `POST /consent {version,accepted:true}`, `POST /referral {referrer_name,referrer_email,reference}`.
- Booking: `POST /bookings {slot_id}`, `GET /bookings`, `POST /bookings/{id}/retry-payment`, `POST /bookings/{id}/cancel-request`, `POST /bookings/{id}/join`, `GET /bookings/{id}/referral`.
- Verified administrator: `GET /admin/bookings`, `GET|POST /admin/consultants`, `GET /admin/slots?consultant_id=...`, `POST /admin/slots {consultant_id,starts_at,ends_at}`, `DELETE /admin/slots/{id}`, `POST /admin/bookings/{id}/reconcile`, `POST /admin/bookings/{id}/complete-cancellation`.
- Stripe: `POST /stripe/webhook` with Stripe signature, not a user token.

## Verification

`python -m pytest tests/test_counselling.py -q` uses a real temporary SQLite database and external-service doubles. It covers verification limits, consent changes, access separation, payment validation and replay, hold expiry, concurrent bookings, overlapping availability, uncertain payment retries, and meeting time gates. Provider configuration and network behavior require separate staging smoke tests; these tests do not assert live SMTP, Stripe, Daily or Twilio operation.
