// One-time physical journal-only proof. No Firebase imports/credentials,
// deployments, unlock, reset or replay. Only the exact approved genesis
// may receive a single idle metadata receipt via the dedicated App.
import {execFileSync} from 'node:child_process';
import {createHostingJournal} from './app738-hosting-writer-candidate.mjs';
const GENESIS='84893f8665bc17e16a16caaf28bf94f9eb4f4e9e';
const EMPTY='4b825dc642cb6eb9a060e54bf8d69288fbee4904';
function git(...args){return execFileSync('git',args,{encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']}).trim();}
try{
 if(process.env.GITHUB_REPOSITORY_ID!=='1188157610'||process.env.GITHUB_REF!=='refs/heads/main'||
    process.env.GITHUB_ACTOR_ID!=='268937716'||process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'||
    process.env.GITHUB_RUN_ATTEMPT!=='1'||!process.env.HOSTING_JOURNAL_APP_TOKEN)throw Error('JOURNAL_PROOF_CONTEXT');
 const journal=createHostingJournal({cwd:process.cwd(),pushToken:process.env.HOSTING_JOURNAL_APP_TOKEN});
 const before=journal.read();
 if(before.sha!==GENESIS||JSON.stringify(before.state)!=='{"schema":1,"phase":"idle"}'||
    git('rev-parse',before.sha+'^{tree}')!==EMPTY||git('rev-list','--parents','-n','1',before.sha)!==before.sha)
   throw Error('JOURNAL_PROOF_GENESIS_CHANGED');
 const sha=journal.compareAppend(before.sha,{schema:1,phase:'idle',proof:'APP738_JOURNAL_APP_AUTH_V1',genesis:GENESIS});
 const after=journal.read();
 if(after.sha!==sha||after.state.phase!=='idle'||after.state.proof!=='APP738_JOURNAL_APP_AUTH_V1'||
    git('rev-parse',sha+'^{tree}')!==EMPTY||git('rev-parse',sha+'^')!==GENESIS)throw Error('JOURNAL_PROOF_ACK_UNKNOWN');
 console.log('APP738_JOURNAL_APP_APPEND_PASS '+sha+'; HOSTING_WRITES=0; LIVE_DEPLOY=NOT_RUN');
}catch(e){console.error(String(e.message||'JOURNAL_PROOF_FAILED').replace(/(?:ghs_|ghp_)\S+/g,'[REDACTED]'));process.exitCode=2;}
