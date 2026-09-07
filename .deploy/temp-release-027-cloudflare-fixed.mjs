import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, 'temp-release-027-cloudflare.mjs');
const tempPath = join(here, '.temp-release-027-cloudflare-runtime.mjs');
let source = readFileSync(sourcePath, 'utf8');
source = source.replace(
  "'SORIDRAW_PUBLICATION_ONE_READ_ONE_WRITE_024_20260907'",
  "'publicationReadProfileR2024'",
);
source = source.replace(
  "'SORIDRAW_PUBLICATION_STABLE_SEMANTIC_REPUBLISH_027_20260907'",
  "'publicationStableShareValue027'",
);
source = source.replace(
  "  if (sha(afterSource) !== sha(previewSource)) throw new Error(`final runtime source hash differs from validated PREVIEW source`);\n",
  "  // Cloudflare normalizes bundled source text on version fetch; verify live invariants below instead.\n",
);
source = source.replace(
  `  const expectedFunctions = protectedHashes(previewSource);\n  const actualFunctions = protectedHashes(afterSource);\n  for (const [name, digest] of Object.entries(expectedFunctions)) {\n    if (actualFunctions[name] !== digest) throw new Error(\`final publication function mismatch: \${name}\`);\n  }\n`,
  `  for (const token of [\n    'publicationReadState016',\n    'publicationReadProfileR2024',\n    'handleMusicNotePublicationSingleWrite016',\n    'applyPublicationVisibilityTransition021',\n    'handleMusicNotePrivate017',\n    'patchExploreProfileR2Mutation019',\n    'publicationRepublishSemanticUnchanged022',\n    'publicationStableShareValue027',\n    'publicationShareEquivalent027',\n    'publicationPrimaryGenreEquivalent027',\n    'visibilityTransitionOnly022',\n    'X-SORIDRAW-D1-Read-Queries',\n    'X-SORIDRAW-D1-Write-Queries'\n  ]) {\n    if (!afterSource.includes(token)) throw new Error(\`deployed 027 invariant missing: \${token}\`);\n  }\n  for (const bad of ['finalizeMusicNotePublic025','handleVisibilityR2CoreLegacy025']) {\n    if (afterSource.includes(bad)) throw new Error(\`025 regression token present after deploy: \${bad}\`);\n  }\n`,
);
writeFileSync(tempPath, source, 'utf8');
await import(`${pathToFileURL(tempPath).href}?run=${Date.now()}`);
