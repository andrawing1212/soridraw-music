// Exact, bounded extension of the existing curation publication path.
// This patch is also used on the pinned active PREVIEW bundle, not a stale rebuild.
export function patchCuratedDirectPublication(source) {
  const replace = (pattern, replacement) => {
    const matches = [...source.matchAll(pattern)];
    if (matches.length !== 1) throw Error('CURATED_DIRECT_PUBLICATION_ANCHOR_' + pattern.source);
    source = source.replace(pattern, replacement);
  };
  replace(/((?:const|let|var)\s+isPublicationBatch307\s*=\s*request\.method\s*===\s*['"]POST['"]\s*&&\s*url\.pathname\s*===\s*['"]\/v1\/me\/music-note-publications\/batch['"]\s*;)/g,
    '$1\n    const directPublicationBody20261128 = request.method === "POST" && url.pathname === "/v1/publications" ? await request.clone().json().catch(() => null) : null;\n    const isDirectMusicNotePublication20261128 = directPublicationBody20261128?.sourceType === "music_note" && typeof directPublicationBody20261128.sourceId === "string" && directPublicationBody20261128.sourceId.trim().length > 0;');
  replace(/\(isTrackVisibilityMutation307\s*\|\|\s*isPublicationBatch307\)(?=\s*\)\s*\{)/g,
    '(isTrackVisibilityMutation307 || isPublicationBatch307 || isDirectMusicNotePublication20261128)');
  replace(/((?:const|let|var)\s+candidates468\s*=\s*isTrackVisibilityMutation307\s*\?)/g,
    'let directCandidate20261128 = [];\n        if (isDirectMusicNotePublication20261128) {\n          const sourceId20261128 = directPublicationBody20261128.sourceId.trim();\n          if (memberIds468.some(id => id.startsWith("music_note_") && id.endsWith("_" + sourceId20261128))) {\n            if (!actor468) actor468 = await validateExploreAuth307(request, env, ctx);\n            if (!actor468.ok) return actor468.response;\n            directCandidate20261128 = ["music_note_" + actor468.uid + "_" + sourceId20261128];\n          }\n        }\n        $1');
  replace(/(\[\s*decodeURIComponent\(url\.pathname\.split\(['"]\/['"]\)\[3\]\s*\|\|\s*['"]{2}\)\s*\])\s*:\s*(\(await request\.clone\(\)\.json\(\)\.catch\(\(\)\s*=>\s*null\)\))/g,
    '$1 : isDirectMusicNotePublication20261128 ? directCandidate20261128 : $2');
  replace(/\(isTrackVisibilityMutation307\s*\|\|\s*isPublicationBatch307\)(?=\s*&&\s*response\.ok)/g,
    '(isTrackVisibilityMutation307 || isPublicationBatch307 || isDirectMusicNotePublication20261128)');
  replace(/trackId:\s*String\(mutationPayload307\?\.data\?\.trackId\s*\|\|\s*decodeURIComponent\(url\.pathname\.split\(['"]\/['"]\)\[3\]\s*\|\|\s*['"]{2}\)\)\.trim\(\)/g,
    'trackId: String(mutationPayload307?.data?.trackId || (isDirectMusicNotePublication20261128 ? "" : decodeURIComponent(url.pathname.split("/")[3] || ""))).trim()');
  replace(/status:\s*mutationPayload307\?\.data\?\.isPublic\s*===\s*true\s*\?\s*['"]public['"]\s*:\s*['"]private['"]/g,
    'status: isDirectMusicNotePublication20261128 || mutationPayload307?.data?.isPublic === true ? "public" : "private"');
  replace(/(generation:\s*Number\(payload468\.data\.generation\s*\|\|\s*0\))\s*,?/g,
    '$1,\n            directTrackId20261128: isDirectMusicNotePublication20261128 ? affected468[0] : null,');
  replace(/await syncCuratedPublicationResults307\(request,\s*env,\s*results307,\s*ctx\);/g,
    'if (isDirectMusicNotePublication20261128 && curatedRepairTicket468?.directTrackId20261128) {\n          const result20261128 = results307[0];\n          if (result20261128?.ok !== true || result20261128.trackId !== curatedRepairTicket468.directTrackId20261128 || String(result20261128.snapshotItem?.id || "").trim() !== result20261128.trackId)\n            throw Error("CURATED_DIRECT_CONFIRMED_RESULT_PENDING_20261128");\n        }\n        $&');
  replace(/(snapshotItem:\s*mutationPayload307\?\.data\?\.snapshotItem\s*\|\|\s*null)\s*,?/g,
    '$1,\n              directMetadata20261128: isDirectMusicNotePublication20261128,');
  // The canonical and bundled writers can use different local loop identifiers.
  const writerStart = source.indexOf('async function syncCuratedPublicationResults307(');
  const writerEnd = source.indexOf('async function reserveDirectCuratedRepair469(', writerStart);
  if (writerStart < 0 || writerEnd <= writerStart) throw Error('CURATED_DIRECT_WRITER_SCOPE');
  const writer = source.slice(writerStart, writerEnd);
  const rowMatches = [...writer.matchAll(/(?:const|let|var)\s+track\s*=\s*(result\d*)\?\.snapshotItem\s*;/g)];
  if (rowMatches.length !== 1) throw Error('CURATED_DIRECT_WRITER_ROW_IDENTIFIER');
  const rowIdentifier = rowMatches[0][1];
  replace(/((?:const|let|var)\s+previous\s*=\s*itemByTrackId\.get\(trackId\);)\s*itemByTrackId\.set\(trackId,\s*\{\s*track\s*,/g,
    '$1\n    let projectedTrack20261128 = track;\n    const previousCount20261128 = previous?.track?.likeCount ?? previous?.track?.stats?.likeCount;\n    if (' + rowIdentifier + '?.directMetadata20261128 === true && Number.isSafeInteger(previousCount20261128) && previousCount20261128 >= 0) {\n      projectedTrack20261128 = { ...track, likeCount: previousCount20261128 };\n      if (track.stats && typeof track.stats === "object" && !Array.isArray(track.stats)) projectedTrack20261128.stats = { ...track.stats, likeCount: previousCount20261128 };\n    }\n    itemByTrackId.set(trackId, {\n      track: projectedTrack20261128,');
  return source;
}
