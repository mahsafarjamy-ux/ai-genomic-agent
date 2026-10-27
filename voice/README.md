# BioVerse phone support

Adapted from the existing `mahsafarjamy-ux/Dental_office/apps/voice/server.mjs` bridge.
Keeps Twilio signed inbound calling, OpenAI realtime voice and staff transfer. The
BioVerse assistant reads only the public counselling configuration. It cannot read
patient records, collect card details, change bookings or interpret genetic results.
There is no call recording or transcript persistence in this service.

## Configure

Use Node 22+, `npm ci`, then `npm start` in this directory. Host this as a separate
long-running HTTPS/WSS service (not a Vercel request function).

Set server environment variables:

- `VOICE_SERVER_PORT` (default 8081)
- `VOICE_PUBLIC_BASE_URL=https://your-voice-host`
- `VOICE_STREAM_URL=wss://your-voice-host/media`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `OPENAI_API_KEY`
- `COUNSELLING_API_URL=https://your-bioverse-api-host`
- `COUNSELLING_SITE_URL=https://your-bioverse-site/counselling`
- `COUNSELLING_STAFF_PHONE` (actual human support line in E.164 format)
- optional `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE`

Set `COUNSELLING_SUPPORT_PHONE` in the BioVerse API to the existing Twilio number.
In Twilio, route that number's incoming Voice webhook to `POST /incoming` on this
service only once its BioVerse routing has been reviewed and tested. If the number
still serves the dental project, configure a deliberate dental/BioVerse routing
choice first; do not silently replace the existing service. No number was purchased
or rerouted by this change.

Keep `VOICE_VALIDATE_TWILIO=1` in production. `VOICE_ALLOW_INSECURE_WS=1` and
`VOICE_VALIDATE_TWILIO=0` are local development options only. Ensure the proxy keeps
the exact externally configured URL for signature verification. Confirm with a
real test call before enabling the support number on the patient page. Twilio and
OpenAI usage charges apply; phone support is not part of Daily's video allowance.

## Verification

`npm run check` checks syntax. `node --test server.test.mjs` starts the bridge with
test-only credentials and verifies signed/unsigned HTTP webhooks without placing
calls, connecting an AI session, or transmitting patient information.
