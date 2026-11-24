import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const src=readFileSync('src/services/notifications/notificationPreviewHost022.ts','utf8');
const exports={};vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
const {canUseReleaseInbox,canUsePreviewInbox022,NOTIFICATION_PREVIEW_WORKER_022:p,NOTIFICATION_PRODUCTION_WORKER_RELEASE:d}=exports;
for(const h of ['preview.soridraw.com','soridraw-preview.web.app','soridraw-preview.firebaseapp.com']){
 assert(canUsePreviewInbox022(h,p));assert(canUseReleaseInbox(h,p));assert(!canUseReleaseInbox(h,d));
}
for(const h of ['soridraw.com','soridraw.web.app','soridraw.firebaseapp.com']){
 assert(!canUsePreviewInbox022(h,d));assert(canUseReleaseInbox(h,d));assert(!canUseReleaseInbox(h,p));
}
for(const h of ['test.soridraw.com','soridraw-test.web.app','localhost','soridraw.com.evil']){
 assert(!canUseReleaseInbox(h,p));assert(!canUseReleaseInbox(h,d));
}
console.log('FULL_RELEASE_NOTIFICATION_HOST_AND_API_SCOPE=PASS');
