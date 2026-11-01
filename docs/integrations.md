# Integrations and imports

[Documentation index](README.md) · [Deployment configuration](deployment.md#environment-configuration)

## Imports

Open **More → Imports** and choose the relevant flow. The current import tools support:

- **Income and expenses:** Budjet exports (UTF-16LE, tab-delimited quoted fields for Type,
  Category, Date, Transaction and Note). Preview the parsed movements, correct categories or
  values and remove unwanted rows before committing.
- **Investment transactions:** CSV/TSV broker-style records with ticker, price, quantity, total,
  date and broker. Map columns and map symbols/accounts to Ledgerly records in the preview.
  The parser supports Italian-formatted numbers and local or ISO dates; this is not a promise
  of compatibility with every broker export.
- **Balance snapshots:** wide CSV/TSV files with a date column and one balance column per
  account or debt. Map columns before committing cash, asset or debt history.

Check the preview and import result against the source records. Importing financial data and
balance history is distinct from connecting directly to a bank.

## iPhone Wallet automation

Settings → Advanced lets each user create one personal integration token for an Apple Shortcuts
Wallet automation. The full secret is returned only when it is generated or rotated; Ledgerly
stores a verifier and only shows the token's short prefix, suffix and creation date afterward.
Treat the secret like a password. Revoke or rotate it in Ledgerly if it is exposed.

The narrow integration endpoint accepts the complete raw Wallet transaction and queues it:

```http
POST /api/integrations/transactions
Authorization: Bearer <personal-token>
Content-Type: application/json
```

When the shared Shortcut asks for the bearer token, enter only the `ledgerly_…` value; it adds the
`Bearer` authorization prefix itself.

The request body is the Shortcut's raw Wallet input; no amount, merchant, category, direction, or
date mapping is required on the phone. Ledgerly persists the request, enqueues it in BullMQ, and a
dedicated worker uses OpenAI Structured Outputs to create the transaction. Repeated identical
payloads are idempotent; callers may also send an `Idempotency-Key` header. The minimal Wallet
`Run Immediately` setup is documented in Settings → Advanced.

The worker extracts the transaction's source currency from the Wallet payload. Foreign amounts are
converted with a date-aware FX rate into the user's base currency before they are
stored; unresolved currencies or unavailable rates follow the import retry/failure path. The raw
Wallet payload remains available for audit and debugging.

After import, Ledgerly stores an in-app notification linked directly to the new transaction. Web
Push is optional: configure `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`, then enable
notifications in Settings. After enabling them, use **Send test notification** in Settings → Advanced
to verify the complete server-to-browser delivery path. This is Wallet-triggered automation, not bank-account synchronization,
so the backend must be reachable from the iPhone and the authorized amount may differ from the final
amount posted by the card issuer.

The configured model defaults are listed in [Deployment](deployment.md#environment-configuration).
The request is a JSON object with nonempty keys of at most 100 characters and a serialized
length of at most 64,000 characters. A successful handoff returns HTTP **202** with `id`,
`status` and `duplicate`; acceptance does not mean the movement has already been booked.
Invalid tokens return **401**, invalid payloads **400**, and a queue handoff failure **503**.
Explicit idempotency keys are limited to 200 characters and deduplication is per user. Use a
stable key for retries of the same purchase and distinct keys for separate identical purchases.

The worker sends the raw Wallet payload, receipt time, base currency and candidate categories
to OpenAI with `store: false`. Unlike forecast interpretation, this integration transmits raw
purchase information. Enable it only if that data flow is acceptable. Keep tokens in the
Shortcut's private configuration, use HTTPS, and exclude raw payloads and secrets from shared
logs and support reports. The personal token authorizes this import endpoint, not general
administration or interactive sign-in.

## Notification troubleshooting

If the in-app notification exists but push does not arrive, check browser notification permission,
the saved subscription and the matching VAPID configuration on backend and worker. Test with
**Send test notification** in Advanced settings. If no transaction appears, check worker and
queue health before retrying; retain the same idempotency key for the same input.
