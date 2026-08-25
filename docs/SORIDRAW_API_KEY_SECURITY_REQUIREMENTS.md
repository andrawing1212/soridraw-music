# SORIDRAW API Key Security Requirements

Status: REQUIRED / architecture constraint
Date: 2026-08-25 KST
Applies to: Gemini personal API keys, Suno/provider personal API keys, future Worker proxy migration

## 1. Non-negotiable rule

User API keys must never be persisted in plaintext in Firestore, D1, R2, GitHub, IndexedDB, localStorage, logs, analytics, traces, crash reports, build artifacts, or server configuration files.

SORIDRAW must treat encrypted ciphertext as the only persistent representation of a user's external API key.

## 2. Target storage model

For each user/provider key, persist only encrypted material and metadata, for example:

- ciphertext
- nonce/IV
- encryption algorithm/version
- wrapped data-encryption-key reference or key version metadata
- created/rotated timestamps
- provider identifier

Do not persist the plaintext API key or a reversible plaintext copy in compatibility fields after migration verification.

## 3. Encryption design

Preferred design is envelope encryption:

1. Generate a random per-user or per-secret data encryption key (DEK).
2. Encrypt the API key with an authenticated cipher such as AES-256-GCM.
3. Protect/wrap the DEK with a separate key-encryption key (KEK) that is not stored beside the Firestore ciphertext.
4. Store only ciphertext + IV/nonce + wrapped DEK/key metadata in Firestore.
5. Rotate KEK/DEK versions without rewriting unrelated user data where possible.

Before implementation, compare a managed KMS-backed design against a Cloudflare-Worker-Secret/Web-Crypto design for security, zero-cost operation, rotation, recovery, and blast radius. Do not choose only for convenience.

## 4. Worker/runtime rule

The future Cloudflare Worker is a thin authenticated proxy, not a plaintext key database.

Required flow:

browser -> Firebase ID token verification -> user identity -> fetch encrypted key material -> just-in-time decrypt -> outbound Gemini/Suno request -> discard plaintext reference immediately after the request

Plaintext keys must never be cached in Worker global state, durable objects, KV, D1, R2, memory caches, logs, traces, or analytics.

## 5. Important technical limit

If Gemini/Suno requires the actual API key as request authentication, the proxy must obtain the plaintext value transiently in process memory long enough to place it in the outbound HTTPS request header. It is therefore technically incorrect to promise that plaintext can never exist in server memory at any instant.

The enforceable requirement is:

- no plaintext persistence,
- no plaintext cache,
- no plaintext logging/telemetry,
- decrypt only inside the authenticated request path,
- keep plaintext lifetime minimal,
- drop references immediately after use,
- prefer provider-native short-lived/token-exchange authentication later if it becomes available and removes the need to handle the long-lived key directly.

## 6. Access boundaries

- Browser must never receive a stored plaintext key back from the server after registration.
- Worker/Firebase service identities must use least privilege.
- Migration service accounts must not be reused as permanent Worker identities.
- API-key ciphertext access must be scoped to the authenticated user's key only.
- Admin/support interfaces must not expose plaintext keys.

## 7. Migration rule for current keys

Existing plaintext compatibility fields must not be deleted first.

Migration sequence:

1. build and test encryption/decryption path in Preview,
2. encrypt existing key into the new encrypted record,
3. verify real Gemini/Suno request succeeds using just-in-time decrypt,
4. verify key change/delete/rotation behavior,
5. verify no plaintext appears in browser, logs, traces, cache, or new database fields,
6. only then remove the old plaintext field in a separately approved cleanup step.

Until encrypted-key migration is fully verified, current key storage remains compatibility data and must not be silently rewritten during Backend V2 database migration.

## 8. Regional/provider validation gate

Before moving Gemini or Suno traffic to Worker, separately verify:

- provider-supported region and terms,
- Worker execution/placement behavior,
- real authenticated API request from the chosen deployment path,
- 403 regional restrictions,
- 401/403 authentication failures,
- 429 quota behavior,
- transient 5xx behavior,
- key rotation/deletion propagation,
- no hidden plaintext logging.

Do not retire the current Firebase Functions path until these Preview validations pass and the user explicitly approves the migration.
