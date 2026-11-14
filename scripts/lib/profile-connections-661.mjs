// APP661: update only the verified ACTIVE PREVIEW follow-list reader.
// A missing derived public-profile card must not erase a canonical edge.
// On misses, one bounded D1 public-profile SELECT; normal path adds no read.
import {createHash} from 'node:crypto';
export const hash661=s=>createHash('sha256').update(s).digest('hex');
export const ACTIVE_SHA661='1199074d7622681932c09a8923547e53bdae4fc7417df60b6b017b81d6a250a9';
const anchor=`    const items2 = (await Promise.all(
      visible2.map((row) => readSharedProfileConnection348(env, row.uid, row.followed_at, cutover, request).catch(() => null))
    )).filter(Boolean);`;
const body=`    const cards661 = await Promise.all(
      visible2.map((row) => readSharedProfileConnection348(env, row.uid, row.followed_at, cutover, request).catch(() => null))
    );
    const missing661 = visible2.filter((row,i)=>!cards661[i]);
    if(missing661.length){
      const ids661=[...new Set(missing661.map(row=>String(row.uid||"").trim()).filter(Boolean))].slice(0,30);
      if(ids661.length){
        // Only after an R2 miss: one indexed read, never per-card fanout.
        const placeholders661=ids661.map(()=>"?").join(",");
        const fallback661=await env.DB.prepare(\`
          SELECT p.uid,p.nickname,p.handle,p.avatar_url,p.bio,
            COALESCE(ps.follower_count,0) AS follower_count,
            COALESCE(ps.following_count,0) AS following_count
          FROM public_profiles p LEFT JOIN profile_stats ps ON ps.uid=p.uid
          WHERE p.is_public=1 AND p.uid IN (\${placeholders661}) LIMIT ?
        \`).bind(...ids661,ids661.length).all();
        const byUid661=new Map((fallback661.results||[]).map(row=>[String(row.uid||""),row]));
        for(let i=0;i<visible2.length;i++){
          if(cards661[i])continue;
          const p661=byUid661.get(String(visible2[i].uid||""));
          if(!p661)continue;
          cards661[i]={
            uid:String(p661.uid||""),nickname:String(p661.nickname||""),
            handle:String(p661.handle||"").replace(/^@+/,""),
            avatarUrl:String(p661.avatar_url||""),bio:String(p661.bio||""),
            followerCount:clampExploreSocialCount(p661.follower_count),
            followingCount:clampExploreSocialCount(p661.following_count),
            trackCount:0,followedAt:Number(visible2[i].followed_at||0)
          };
        }
      }
    }
    const unresolved661=cards661.some(card=>!card);
    const items2=cards661.filter(Boolean);`;
const pageOld=`      items: items2,
      nextCursor: hasMore2 && last2 ? encodeCursor({ followedAt: Number(last2.followed_at || 0), uid: String(last2.uid || "") }) : null`;
const pageNew=`      items: items2,
      nextCursor: hasMore2 && last2 ? encodeCursor({ followedAt: Number(last2.followed_at || 0), uid: String(last2.uid || "") }) : null,
      countComplete: !hasMore2 && !unresolved661,
      hasUnresolvedProfiles: unresolved661`;
const one=(s,a,b)=>{
 if(s.split(a).length!==2)throw Error('APP661_SOURCE_ANCHOR_DRIFT');
 return s.replace(a,b);
};
export function patchActiveProfileConnections661(source,expected=ACTIVE_SHA661){
 if(hash661(source)!==expected)throw Error('APP661_ACTIVE_SOURCE_SHA_DRIFT');
 const start=source.indexOf('async function handleProfileConnections(');
 const end=source.indexOf('\n__name(handleProfileConnections',start);
 if(start<0||end<start)throw Error('APP661_FUNCTION_BOUNDARY');
 let part=source.slice(start,end);
 part=one(part,anchor,body);
 part=one(part,pageOld,pageNew);
 return source.slice(0,start)+part+source.slice(end);
}
