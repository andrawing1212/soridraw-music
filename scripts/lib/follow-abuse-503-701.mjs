// APP701 — exact ACTIVE PREVIEW follow guard compatibility repair.
// One module, no data migration, no new network reads/writes or like changes.
import {createHash} from 'node:crypto';
export const sourceHash701=s=>createHash('sha256').update(s).digest('hex');
function replaceOne(source,find,replacement,label){
 const i=source.indexOf(find);
 if(i<0||source.indexOf(find,i+find.length)>=0)throw Error('APP701_HOLD_'+label+'_NOT_UNIQUE');
 return source.slice(0,i)+replacement+source.slice(i+find.length);
}
export function patchFollowAbuse701(source){
 if(typeof source!=='string'||source.length<100_000||
  !source.includes('function socialAbusePolicy380(domain)')||
  !source.includes('function consumeSocialAbuse380(env, uid, domain, intents)'))
  throw Error('APP701_HOLD_ACTIVE_SOURCE_SHAPE');
 const start=source.indexOf('function socialAbusePolicy380(domain)');
 const end=source.indexOf('function consumeSocialAbuse380(env, uid, domain, intents)');
 if(start<0||end<=start)throw Error('APP701_HOLD_GUARD_ORDER');
 let policy=source.slice(start,end), rest=source.slice(end);
 policy=replaceOne(policy,'cooldowns: [3e4, 12e4, 6e5, 36e5]',
   'cooldowns: [0, 0, 0, 3e4]','POLICY');
 rest=replaceOne(rest,'row.nextAllowedAt !== row.at + policy.cooldowns[row.level]',
   '(row.nextAllowedAt !== row.at + policy.cooldowns[row.level] && (domain !== "follow" || row.nextAllowedAt !== row.at + [3e4, 12e4, 6e5, 36e5][row.level]))',
   'LEGACY_RECEIPT');
 rest=replaceOne(rest,'if (prior && prior.nextAllowedAt > now) blockedUntil = Math.max(blockedUntil, prior.nextAllowedAt);',
   'const allowedAt701 = prior && domain === "follow" ? prior.at + policy.cooldowns[prior.level] : prior?.nextAllowedAt || 0;\n      if (prior && allowedAt701 > now) blockedUntil = Math.max(blockedUntil, allowedAt701);',
   'LEGACY_COOLDOWN');
 rest=replaceOne(rest,'const level = prior ? Math.min(3, prior.level + 1) : 0;',
   'const level = prior && (domain !== "follow" || now - prior.at < 6e4) ? Math.min(3, prior.level + 1) : 0;',
   'LEVEL');
 const patched=source.slice(0,start)+policy+rest;
 if(patched===source||patched.length-source.length>1200||patched.length<source.length||
   patched.slice(0,start)!==source.slice(0,start)||
   !patched.includes('function socialAbuseLimited380(')||
   !patched.includes('if (domain === "like") return {'))
   throw Error('APP701_HOLD_REPLACEMENT_INVARIANTS');
 return patched;
}
