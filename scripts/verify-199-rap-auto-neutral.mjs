import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const sectionSource = readFileSync('src/services/generation/v1/rules/sectionArrangementRoles.ts', 'utf8');
const geminiSource = readFileSync('src/services/geminiService.ts', 'utf8');

const compiled = (await transform(sectionSource, {
  loader: 'ts',
  format: 'cjs',
  target: 'es2022',
})).code;

const moduleBox = { exports: {} };
new Function('module', 'exports', compiled)(moduleBox, moduleBox.exports);
const { buildV1GuaranteedProducerDirectionMap } = moduleBox.exports;
assert.equal(typeof buildV1GuaranteedProducerDirectionMap, 'function');

const rawArrangement = [
  '88–98 BPM, laid-back G-Funk groove',
  'celesta chords and rain foley',
  'Pre-Chorus 1: add half-time drums and an analog synth counterline',
  'Final Chorus: fast hi-hats and full synths',
  'no rap',
].join('; ');

const baseContext = {
  tempo: '88–98 BPM',
  grooveHint: 'laid-back G-Funk groove',
  genre: 'G-Funk, urban groove',
  instruments: 'analog synth, celesta, drums',
  vocals: 'solo vocal',
  atmosphere: 'nervous tension',
  vocalMode: 'solo',
  isInstrumental: false,
};

const auto = buildV1GuaranteedProducerDirectionMap(rawArrangement, {
  ...baseContext,
  rapMode: 'auto',
  preserveNoRapConstraint: false,
});
assert.doesNotMatch(auto, /\bno\s+rap\b|\bwithout\s+rap\b|\brap[-\s]?free\b/i,
  'AUTO must not preserve a generated rap ban');

const autoDirectNoRap = buildV1GuaranteedProducerDirectionMap(rawArrangement, {
  ...baseContext,
  rapMode: 'auto',
  preserveNoRapConstraint: true,
});
assert.match(autoDirectNoRap, /\bno\s+rap\b/i,
  'AUTO must preserve an explicit user no-rap request');

const off = buildV1GuaranteedProducerDirectionMap(rawArrangement, {
  ...baseContext,
  rapMode: 'off',
  preserveNoRapConstraint: false,
});
assert.match(off, /\bno\s+rap\b/i, 'OFF must keep the rap ban');

const on = buildV1GuaranteedProducerDirectionMap(
  rawArrangement.replace(/; no rap$/i, '; rap section'),
  { ...baseContext, rapMode: 'on' },
);
assert.match(on, /\brap\s+section\b/i, 'ON behavior must remain intact');

assert.match(geminiSource,
  /RAP MODE: AUTO\.[^\n]+do NOT add "no rap", "without rap", "rap-free"/,
  'AUTO Gemini instruction must forbid invented rap-ban wording');
assert.doesNotMatch(geminiSource, /Rap: auto by genre\./,
  'retired AUTO-by-genre wording must not remain');
assert.match(geminiSource,
  /rapMode: getRapModeFromParams\(params\),\s*preserveNoRapConstraint: hasExplicitNoRapDirectorRequest\(params\)/,
  'first V1 arrangement boundary must receive AUTO/director context');
assert.match(geminiSource,
  /rapMode: getRapModeFromParams\(validationParams\),\s*preserveNoRapConstraint: hasExplicitNoRapDirectorRequest\(validationParams\)/,
  'final V1 arrangement boundary must receive AUTO/director context');
assert.match(geminiSource,
  /if \(rapMode === 'off' && !\/\\bno\\s\+rap\\b\/i\.test\(arrangement\)\)/,
  'OFF deterministic no-rap append must remain');
assert.match(geminiSource,
  /else if \(rapMode === 'on' && !\/\\brap\\b\/i\.test\(arrangement\)\)/,
  'ON deterministic rap-section append must remain');

console.log('APP199_RAP_AUTO_NEUTRAL_NO_FORCED_NO_RAP=PASS');
console.log('APP199_DIRECT_NO_RAP_AND_OFF_PRESERVED=PASS');
console.log('APP199_ON_AND_EXISTING_RAP_MODE_BOUNDARIES_PROTECTED=PASS');
