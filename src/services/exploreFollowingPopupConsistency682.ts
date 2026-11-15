// APP682: compare a viewer's verified own Following total against the exact
// persisted/list response. A stale list may contain more cards than the
// canonical count after a hard reload; a target profile revisit must NOT be
// required to correct it.
export type FollowingPage682={items:readonly {uid:string}[];nextCursor:string|null;countComplete?:boolean};
export const shouldHoldOwnFollowingPage682=(
  page:FollowingPage682|null|undefined,
  verifiedCount:number|null,
):boolean=>{
  if(!page||verifiedCount===null||!Number.isSafeInteger(verifiedCount)||verifiedCount<0)return false;
  const ids=page.items.map(item=>String(item?.uid||'').trim());
  if(ids.some(uid=>!uid)||new Set(ids).size!==ids.length)return true;
  // A complete first page MUST match the canonical actor count. Local patches
  // mark countComplete=false, so they are not sufficient proof after reload.
  if(!page.nextCursor)return page.countComplete!==true||ids.length!==verifiedCount;
  // A paginated page cannot be complete, but must not contain more unique
  // identities than the verified total.
  return ids.length>verifiedCount;
};
