import fs from 'node:fs';
const source=fs.readFileSync('src/lib/userDataEngine.ts','utf8');
for (const token of [
  'const hardRequiredRevision = knownRemoteRevision > 0',
  '&& (!local || knownRemoteRevision > local.revision)',
  'readRemoteCatalogSnapshot(kind, uid, hardRequiredRevision, local)',
  "headers['X-Soridraw-Require-Revision'] = String(hardMinimumRevision)",
  'canUseWarmCatalogWithoutRemote',
]) if(!source.includes(token)) throw new Error(`046 token missing: ${token}`);
if(source.includes('readRemoteCatalogSnapshot(kind, uid, 0, local)')) throw new Error('046 old stale-loop call still present');
console.log('CATALOG_STALE_REVISION_REBUILD_046=PASS');
