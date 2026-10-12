-- Stage416 additive server-only acceptance fence.
-- EMPTY operational table only: no backfill, no existing-row rewrite/delete.
CREATE TABLE IF NOT EXISTS explore_like_private_acceptance_416(
 user_uid TEXT PRIMARY KEY,
 version INTEGER NOT NULL CHECK(version>0),
 digest TEXT NOT NULL,
 accepted_at INTEGER NOT NULL,
 claim_token TEXT NOT NULL
);
