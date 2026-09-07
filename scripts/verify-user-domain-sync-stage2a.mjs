import fs from 'node:fs';

const service = fs.readFileSync('src/services/userDomainSyncService.ts', 'utf8');
const boundary = fs.readFileSync('src/data/v1MutationBoundary.ts', 'utf8');
const rules = fs.readFileSync('database.rules.json', 'utf8');
const main = fs.readFileSync('src/main.tsx', 'utf8');

if (!service.includes('SORIDRAW_USER_DOMAIN_SYNC_STAGE2A_20260905')) throw new Error('Stage2A service marker missing');
if (!service.includes('userSync/${uid}/${kind}')) throw new Error('UID-scoped RTDB sync path missing');
if (!service.includes('MAX_DOCUMENT_IDS = 10')) throw new Error('document ID cap missing');
if (/collection\(|getDocs\(|onSnapshot\(|firebase\/firestore/.test(service)) throw new Error('domain sync service must never read Firestore/song collections');
if (!service.includes('addV1MutationPostSuccessHook(publishSignal)')) throw new Error('mutation-only registration missing');
if (!boundary.includes('addV1MutationPostSuccessHook')) throw new Error('additive mutation hook missing');
if (!boundary.includes('legacyPostSuccessHook')) throw new Error('legacy shadow hook compatibility missing');
if (!rules.includes('"userSync"')) throw new Error('userSync rules missing');
if (!rules.includes('numChildren() <= 10')) throw new Error('RTDB ID bound missing');
if (!main.includes("import './services/userDomainSyncService';")) throw new Error('global domain sync registration missing');
if (/set\(ref\(realtimeDb/.test(main)) throw new Error('main bootstrap must not write domain sync');
console.log('SORIDRAW USER DOMAIN SYNC STAGE2A: PASS');
console.log('Invariant: reload/cache hydration performs no userSync write; only successful V1 mutations emit one bounded RTDB signal.');
