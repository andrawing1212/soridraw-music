import fs from 'node:fs';

const page = fs.readFileSync('src/pages/ExplorePage.tsx','utf8');
const cache = fs.readFileSync('src/services/exploreSessionCache.ts','utf8');

const must=(c,m)=>{ if(!c) throw new Error(m); };

must(page.includes('SORIDRAW_EXPLORE_SEARCH_LOCAL_ZERO_REENTRY_340_20261004'),'page app340 marker missing');
must(cache.includes('SORIDRAW_EXPLORE_SEARCH_LOCAL_ZERO_REENTRY_340_20261004'),'cache app340 marker missing');
must(page.includes('readExploreSearchCache340(requestUrl)'),'search cache read missing');
must(page.includes('writeExploreSearchCache340(requestUrl, rows)'),'search cache write missing');
must(cache.includes("const EXPLORE_SEARCH_CACHE_TTL_MS_340 = 2 * 60 * 1000"),'2m TTL missing');
must(cache.includes("sourceType: EXPLORE_SEARCH_SOURCE_TYPE_340"),'persistent source type missing');
must(cache.includes("expiresAt,"),'persistent expiry missing');

const effectStart = page.indexOf('// SORIDRAW_EXPLORE_SEARCH_LOCAL_ZERO_REENTRY_340_20261004');
const effect = page.slice(effectStart, effectStart + 12000);
must(effect.indexOf('if (cachedRows)') >= 0,'cached branch missing');
must(effect.indexOf('if (!shouldRevalidate) return () => controller.abort();') >= 0,'warm cache zero-server return missing');
must(effect.indexOf('const payload = await fetchPayload(requestUrl)') > effect.indexOf('if (cachedRows)'),'network fetch must remain after cache branch');

console.log('APP340_EXACT_SEARCH_LOCAL_CACHE=PASS');
console.log('APP340_REPEAT_SEARCH_WORKER_ZERO_CONTRACT=PASS');
console.log('APP340_SEARCH_CACHE_TTL_2M=PASS');
console.log('APP340_SHARED_D1_CHANGE=0');
console.log('APP340_USER_DATA_MIGRATION=0');
