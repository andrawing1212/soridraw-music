// app518 SOURCE-ONLY replacement for the orphan migration-inspect Worker.
// It deliberately has no D1, R2, service, Durable Object, cron or auth.
// Until its *actual* active version loses SOURCE_DB, all account write
// budget cutovers remain blocked. Never redeploy/activate without approval.
const deny=()=>new Response('Diagnostic worker retired.',{
 status:410,headers:{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8'},
});
export default {
 fetch(){return deny()},
 scheduled(){return undefined},
};
