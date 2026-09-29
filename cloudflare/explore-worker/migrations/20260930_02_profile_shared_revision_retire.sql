-- SORIDRAW 250 profile shared-revision compatibility retirement.
-- Scope: remove only the legacy public_profiles -> explore_shared_revision global bump.
-- The current TEST/PRODUCTION Worker artifacts no longer call readSharedDataRevision031;
-- Feed synchronization is driven by the 032 derived cursor path, while public-profile
-- revalidation uses its own materialized/shared-R2 revision.
--
-- No table/index/user-row mutation. No Music Note/track/profile projection trigger change.

DROP TRIGGER IF EXISTS soridraw_shared_rev_public_profiles_au_051;
