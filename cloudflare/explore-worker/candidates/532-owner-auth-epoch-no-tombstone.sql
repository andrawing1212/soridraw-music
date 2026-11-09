-- APP532 SOURCE-ONLY alternative to APP531 permanent UID retirement journal.
-- Use the APP530 common columns/index/fallback before APP531 section, then
-- ONLY this extra nullable-enrollment column; NEVER apply APP531 tombstones.
-- No shared schema change is approved.
ALTER TABLE profile_stats
 ADD COLUMN owner_follow_auth_epoch_532 TEXT NOT NULL DEFAULT ''
 CHECK(owner_follow_auth_epoch_532='' OR length(owner_follow_auth_epoch_532)=32);
-- The 32-hex value must be generated once by a trusted server and bound to
-- the SAME Firebase Auth user's protected custom claim on enrollment.
-- Auth deletion discards that claim; same-UID recreation needs a new random
-- epoch. Missing/unbound epoch: fail closed, not fallback to UID/revision.
