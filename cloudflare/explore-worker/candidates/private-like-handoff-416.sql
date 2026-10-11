-- Stage416 source-only additive PREVIEW candidate. DO NOT APPLY to live
-- shared D1 until Worker/Functions/Rules all-environment approval and audit.
CREATE TABLE IF NOT EXISTS explore_like_private_acceptance_416(
 user_uid TEXT PRIMARY KEY,
 version INTEGER NOT NULL CHECK(version>0),
 digest TEXT NOT NULL,
 accepted_at INTEGER NOT NULL
);
