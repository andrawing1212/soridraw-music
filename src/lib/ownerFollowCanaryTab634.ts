// APP634: Preserve only an explicitly entered, PREVIEW-only owner QA opt-in
// while SPA navigation replaces URL search parameters. This is tab-local;
// ordinary visitors, other environments and other account UIDs remain inert.
const PREVIEW_HOST_634='preview.soridraw.com';
const TAB_KEY_634='soridraw:owner-follow:explicit-tab-optin:634';
type CanRead634=Pick<Storage,'getItem'>;
type CanWrite634=Pick<Storage,'setItem'>;
export const captureOwnerFollowCanaryOptIn634=(
 hostname:string,search:string,storage:CanWrite634|null,
):boolean=>{
 if(hostname!==PREVIEW_HOST_634||
   new URLSearchParams(search).get('ownerFollowCanary')!=='1')return false;
 try{storage?.setItem(TAB_KEY_634,'1')}catch{/* The URL-only opt-in still works. */}
 return true;
};
export const hasOwnerFollowCanaryOptIn634=(
 hostname:string,search:string,storage:CanRead634|null,
):boolean=>{
 if(hostname!==PREVIEW_HOST_634)return false;
 if(new URLSearchParams(search).get('ownerFollowCanary')==='1')return true;
 try{return storage?.getItem(TAB_KEY_634)==='1'}
 catch{return false}
};

// APP658: passive RTDB listening is allowed for the one approved PREVIEW
// owner after PWA/browser relaunch; this never permits Auth enrollment writes.
export const mayListenToApprovedOwnerOnPreview658=(
 hostname:string,uid:string,approvedUid:string,
):boolean=>hostname.toLowerCase()==='preview.soridraw.com'&&
 approvedUid.length>0&&uid===approvedUid;

// APP659: source-stage general owner listener; never performs enrollment.
export const mayListenToPreviewOwnerGeneral659=(
 hostname:string,uid:string,enabled:boolean,
):boolean=>enabled&&hostname.toLowerCase()===PREVIEW_HOST_634&&
 /^[A-Za-z0-9_-]{1,128}$/.test(uid);
