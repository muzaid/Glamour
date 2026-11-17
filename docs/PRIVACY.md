# Privacy & safety design (implementation notes — legal review required)

| Data | Where it lives | Retention (proposal) |
|---|---|---|
| Live camera frames | Browser memory only; cleared on close/hide/unmount | Ephemeral |
| Uploaded photo (guest or signed-in) | Browser memory only — never uploaded in P0 | Ephemeral |
| Face landmarks | Browser memory only; never logged, stored or sent | Ephemeral |
| Saved look | `looks.recipe` (variant ids, region, opacity, lighting preset, engine version) | Until user deletes |
| Consent records | `photo_consents` (scope, policy version, granted) — no media | Account lifetime |
| Render outputs | Private storage, signed URLs ≤5 min | Per workspace policy |
| Orders | Immutable snapshots | Regulated retention per market |
| Audit events | No pixels, card data, secrets or prompts (key filter + size cap) | Per security policy |

Controls implemented: consent gate before camera/upload with 18+ attestation; illustrated synthetic demo face needs no consent; camera requested only on click; analytics props are coarse scalars; AI agents never receive images; account page offers export + deletion (looks, face media, carts) with an audit entry that contains counts only. Deletion copy does not claim instant backup erasure.

Not implemented yet: opted-in photo persistence (`persistImage` is pinned to `false` in the contract), public look sharing + moderation, minimum-age enforcement beyond attestation, cookie/analytics consent banner (market-dependent).
