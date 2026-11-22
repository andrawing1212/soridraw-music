// Pinned PR #528 APP518 schema preflight. No SQL execution or cloud adapter.
// The controller may only pass statements loaded from the immutable candidate
// tree after a signed QA account/D1 admission.
import {assertQaProof518} from './qaGate518.mjs';

export const APP518_QA_MIGRATIONS=Object.freeze([
 '518_music_note_catalog_daily_write_budget.sql',
 '518_music_note_catalog_first_change_index.sql',
 '518_music_note_catalog_outbox.sql',
]);
const tables=[
 'music_note_catalog_daily_budget_518',
 'music_note_catalog_index_meta_518',
 'music_note_catalog_member_518',
 'music_note_catalog_paged_stage_518',
 'music_note_catalog_outbox_518',
];
const indexes=[
 'idx_music_note_catalog_member_518_generation',
 'idx_music_note_catalog_outbox_518_due',
];
const fail=code=>{throw new Error(code);};
const sorted=x=>[...x].sort().join('|');
export function buildQaD1SchemaPlan518({proof,files,existingTableNames,nowMs=Date.now()}={}){
  assertQaProof518(proof,nowMs);
  if(!files||Array.isArray(files)||typeof files!=='object'
    ||sorted(Object.keys(files))!==sorted(APP518_QA_MIGRATIONS)
    ||!Array.isArray(existingTableNames)
    ||existingTableNames.some(x=>typeof x!=='string'||x.length>128))
    fail('HOLD_QA_D1_SCHEMA_INPUT');
  if(existingTableNames.some(x=>
    /^music_note_catalog_.*_518$/i.test(x)||/^idx_music_note_catalog_.*_518/i.test(x)))
    fail('HOLD_QA_D1_MIGRATION_ALREADY_OR_PARTIALLY_PRESENT');
  const namesT=[],namesI=[],statements=[];
  for(const file of APP518_QA_MIGRATIONS){
    const raw=files[file];
    if(typeof raw!=='string'||raw.length<100||raw.length>16000)
      fail('HOLD_QA_D1_MIGRATION_MISSING_OR_OVERSIZED');
    // The original pinned migrations contain only SQL line comments and
    // CREATE TABLE / CREATE INDEX IF NOT EXISTS. Never accept other DDL.
    const clean=raw.replace(/^\s*--[^\n]*(?:\n|$)/gm,'').trim();
    if(/\/[*]|[*]\/|--|\b(?:DROP|ALTER|TRUNCATE|DELETE|UPDATE|INSERT|REPLACE|ATTACH|DETACH|PRAGMA|VACUUM|WITH)\b/i.test(clean))
      fail('HOLD_QA_D1_MUTATING_OR_UNKNOWN_SQL');
    for(const sql of clean.split(';').map(s=>s.trim()).filter(Boolean)){
      const t=/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-z0-9_]+)\s*\(/i.exec(sql);
      const i=/^CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+([a-z0-9_]+)\s+ON\s+([a-z0-9_]+)\s*\(/i.exec(sql);
      if(t){
        if(!tables.includes(t[1]))fail('HOLD_QA_D1_FOREIGN_TABLE');
        namesT.push(t[1]);
      }else if(i){
        if(!indexes.includes(i[1])||!tables.includes(i[2]))
          fail('HOLD_QA_D1_FOREIGN_INDEX');
        namesI.push(i[1]);
      }else fail('HOLD_QA_D1_UNKNOWN_STATEMENT');
      if(sql.length>5000)fail('HOLD_QA_D1_SQL_TOO_LARGE');
      statements.push(Object.freeze({migration:file,sql}));
    }
  }
  if(statements.length!==7||sorted(namesT)!==sorted(tables)
    ||sorted(namesI)!==sorted(indexes)
    ||new Set(namesT).size!==tables.length
    ||new Set(namesI).size!==indexes.length)
    fail('HOLD_QA_D1_REQUIRED_SCHEMA_INCOMPLETE');
  return Object.freeze({
    code:'QA518_EXACT_PINNED_SCHEMA_PLAN_ONLY',
    d1Id:proof.d1Id,
    statements:Object.freeze(statements),
    tableNames:Object.freeze([...tables]),
    indexNames:Object.freeze([...indexes]),
    cloudMutations:0,
  });
}
