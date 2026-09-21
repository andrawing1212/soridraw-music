# PREVIEW LIKE REAL-STATE READ-ONLY DIAGNOSTIC

No user identifiers or raw track IDs are included. This is a one-time read-only D1 inspection.

Affected public title match count: 0
Canonical public count sum: 0
Canonical likes relation rows: 0
Track owner has liked (sum): 0
Note: the logged-in viewer may not be the track owner; owner membership is not viewer membership.

Processor lease remaining seconds: 0
Queue q035: 0 batches, 0 pending mutations; oldest age seconds 0; newest age seconds 0
Queue q066: 0 batches, 0 pending mutations; oldest age seconds 0; newest age seconds 0
Queue q069: 7 batches, 14 pending mutations; oldest age seconds 8827; newest age seconds 2676
Query plan current: SEARCH t USING INDEX sqlite_autoindex_tracks_1 (id=?)
Query plan current: SEARCH l USING COVERING INDEX sqlite_autoindex_likes_1 (track_id=? AND user_uid=?)
Query plan indexed_candidate: CO-ROUTINE requested
Query plan indexed_candidate: SCAN 2 CONSTANT ROWS
Query plan indexed_candidate: SCAN r
Query plan indexed_candidate: SEARCH t USING INDEX sqlite_autoindex_tracks_1 (id=?)
Query plan indexed_candidate: SEARCH l USING COVERING INDEX sqlite_autoindex_likes_1 (track_id=? AND user_uid=?)

Diagnosis only; no data was altered.
