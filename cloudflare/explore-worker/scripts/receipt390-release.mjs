import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const receiptMigration390 = '20261008_01_like_intake_receipt_390_additive.sql';
const candidate = readFileSync(new URL('../candidates/390-like-acceptance-receipt.sql',import.meta.url),'utf8');
if (createHash('sha256').update(candidate).digest('hex') !== '9dce709548e56188cfd7906be89053a207f3b04663c4fa00ffa75d99ba099f96') {
  throw new Error('receipt390 measured SQL identity drifted');
}
export const receiptObjects390 = [
  {type:'table',name:'explore_like_intake_receipts_390'},
  {type:'trigger',name:'explore_like_receipt_insert_390'},
  {type:'trigger',name:'explore_like_receipt_update_390'},
];
const statements = candidate.match(/CREATE TABLE[\s\S]+?;\n|CREATE TRIGGER[\s\S]+?\nEND;/g);
if (statements?.length !== 3) throw new Error('receipt390 exact source must have exactly three objects');
receiptObjects390.forEach((object,index)=>object.statement=statements[index]);
const normalize = sql => {
  // sqlite_schema omits IF NOT EXISTS. Normalize formatting/SQL keywords only;
  // preserve string literals so 'OPEN' or 'o pen' cannot pass the 'open' fence.
  const tokens = String(sql||'').match(/'(?:''|[^'])*'|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|--[^\r\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_][A-Za-z_0-9]*|\d+|[^\s]/g) || [];
  const normalized = [];
  for(let index=0;index<tokens.length;index++) {
    const token=tokens[index];
    if(token.startsWith('--') || token.startsWith('/*')) continue;
    if(token.toUpperCase()==='IF' && tokens[index+1]?.toUpperCase()==='NOT' &&
      tokens[index+2]?.toUpperCase()==='EXISTS') {index+=2;continue;}
    normalized.push(/^[A-Za-z_]/.test(token)?token.toLowerCase():token);
  }
  while(normalized.at(-1)===';') normalized.pop();
  return normalized.join(' ');
};
export const receiptSchemaQuery390 = "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name IN ('explore_like_intake_receipts_390','explore_like_receipt_insert_390','explore_like_receipt_update_390')";
export function verifyReceiptMigration390(sql) {
  if (sql !== candidate) throw new Error('receipt390 migration SQL must exactly equal measured candidate');
  // The three fixed DDL bodies alone are allowed; the generic additive mode
  // remains unchanged. SQL cannot add a fourth object, seed or redefine a table.
  return receiptObjects390;
}
export function verifyReceiptSchema390(rows,{allowAbsent=false}={}) {
  if (!Array.isArray(rows)) throw new Error('receipt390 schema query unavailable');
  if (allowAbsent && rows.length===0) return false;
  if (rows.length!==3) throw new Error('receipt390 schema missing/partial; activation blocked');
  for(const object of receiptObjects390) {
    const row=rows.find(row=>row.name===object.name);
    if (!row || row.type!==object.type || row.tbl_name!=='explore_like_intake_receipts_390' ||
        normalize(row.sql)!==normalize(object.statement)) throw new Error('receipt390 schema drift: '+object.name);
  }
  return true;
}
export function verifySocialConfig380(config,environment) {
  if (!['preview','test','production'].includes(environment) || config?.vars?.SORIDRAW_ENVIRONMENT!==environment) {
    throw new Error('app380 explicit environment identity mismatch');
  }
  const media=(config.r2_buckets||[]).filter(row=>row.binding==='PROFILE_MEDIA');
  const rates=(config.ratelimits||[]).filter(row=>row.name==='LIKE_RATE_LIMITER');
  if (media.length!==1 || media[0].bucket_name!=='soridraw-profile-media' || rates.length!==1 ||
      String(rates[0].namespace_id)!=='91054' || rates[0].simple?.limit!==60 || rates[0].simple?.period!==60) {
    throw new Error('app380 PROFILE_MEDIA/LIKE_RATE_LIMITER binding missing or drifted');
  }
}
export function assertReceiptReady390(configPath,run) {
  const cli=fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url));
  const invoke=run || (args=>{
    const result=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
    if(result.status!==0 || result.error) throw new Error('receipt390 read-only preflight failed');
    return result.stdout;
  });
  const data=JSON.parse(invoke(['d1','execute','DB','--remote','--config',configPath,'--command',receiptSchemaQuery390,'--json']));
  if (!Array.isArray(data) || data.length!==1 || data[0].success!==true) throw new Error('receipt390 query failed');
  verifyReceiptSchema390(data[0].results);
}

// DDL application has an explicit compensation path even if the remote import
// commits only a prefix. Compensation is restricted to a NEW, EMPTY dormant
// operational table; an existing receipt or activated Worker is never dropped.
export async function applyReceiptSchema390(query,ensureDormant) {
  await ensureDormant();
  const present=verifyReceiptSchema390(await query(receiptSchemaQuery390),{allowAbsent:true});
  if(present) return;
  try {
    for(const object of receiptObjects390) await query(object.statement);
    verifyReceiptSchema390(await query(receiptSchemaQuery390));
  } catch(error) {
    await ensureDormant();
    const after=await query(receiptSchemaQuery390);
    for(const row of after) {
      const object=receiptObjects390.find(item=>item.name===row.name);
      if(!object || row.type!==object.type || normalize(row.sql)!==normalize(object.statement)) {
        throw new Error('receipt390 partial failure with schema drift: preserve objects; manual audit required',{cause:error});
      }
    }
    if(after.some(row=>row.type==='table') && (await query('SELECT 1 AS present FROM explore_like_intake_receipts_390 LIMIT 1')).length) {
      throw new Error('receipt390 is populated: preserve acceptance proofs; manual audit required',{cause:error});
    }
    for(const object of [...receiptObjects390].reverse()) {
      if(after.some(row=>row.name===object.name)) await query(`DROP ${object.type.toUpperCase()} IF EXISTS ${object.name}`);
    }
    if((await query(receiptSchemaQuery390)).length) throw new Error('receipt390 partial-schema cleanup failed');
    throw error;
  }
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [action,path,environment]=process.argv.slice(2);
  if(action==='preflight') {
    verifySocialConfig380(JSON.parse(readFileSync(path,'utf8')),environment);
    assertReceiptReady390(path);
    console.log('RECEIPT390_READONLY_ACTIVATION_PREFLIGHT=PASS');
  } else if(action==='verify-source') {
    const sql=readFileSync(path,'utf8');verifyReceiptMigration390(sql);
    console.log('RECEIPT390_EXACT_SOURCE_SHA256='+createHash('sha256').update(sql).digest('hex'));
  } else throw new Error('usage: receipt390-release.mjs <preflight config environment|verify-source migration>');
}
