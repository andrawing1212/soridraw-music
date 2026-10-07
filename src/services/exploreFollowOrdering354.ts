type Payload354 = { data?: Record<string, unknown> & { followProtocol?: number; followRevision?: number; revision?: number } };
type Request354 = (path: string, init?: RequestInit) => Promise<Payload354>;
type Pending354 = { following: boolean; id: string; revision: number };
const revisions354 = new Map<string, number>();
const pending354 = new Map<string, Pending354>();
const queues354 = new Map<string, Promise<unknown>>();

// Legacy retains its original single request and no extra body/read. Negotiate
// ordering only when the armed server explicitly rejects an unordered write.
// Serialize one pair on this device, retain an uncertain operation for retry,
// and never rebase a server revision conflict into a new write automatically.
export const requestOrderedExploreFollow354 = (
  viewerUid: string, targetUid: string, following: boolean, request: Request354,
): Promise<Payload354> => {
  const key = JSON.stringify([viewerUid, targetUid]);
  const path = `/v1/profiles/${encodeURIComponent(targetUid)}/follow`;
  const ordered = () => {
    const task = (queues354.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
      const send = async (operation: Pending354) => {
        try {
          const payload = await request(path, {
            method: operation.following ? 'PUT' : 'DELETE',
            body: JSON.stringify({ followOperationId: operation.id, followExpectedRevision: operation.revision }),
          });
          const revision = payload?.data?.revision;
          if (!Number.isSafeInteger(revision) || Number(revision) <= operation.revision) {
            throw new Error('팔로우 응답 순서를 확인하지 못했습니다. 다시 시도해 주세요.');
          }
          revisions354.set(key, Number(revision));
          pending354.delete(key);
          return payload;
        } catch (error) {
          if ((error as { code?: string })?.code === 'RATE_LIMITED') pending354.delete(key);
          if (['FOLLOW_REVISION_CONFLICT', 'FOLLOW_OPERATION_CONFLICT'].includes(String((error as { code?: string })?.code))) {
            pending354.delete(key);
            revisions354.delete(key);
          }
          throw error;
        }
      };
      const pending = pending354.get(key);
      if (pending) {
        const payload = await send(pending);
        if (pending.following === following) return payload;
      }
      if (!revisions354.has(key)) {
        const payload = await request(`/v1/profiles/${encodeURIComponent(targetUid)}/follow-state`);
        const revision = payload?.data?.followRevision;
        if (payload?.data?.followProtocol !== 354 || !Number.isSafeInteger(revision) || Number(revision) < 0) {
          throw new Error('팔로우 저장 정보를 확인하지 못했습니다. 다시 시도해 주세요.');
        }
        revisions354.set(key, Number(revision));
      }
      const operation = { following, id: crypto.randomUUID().replaceAll('-', '_'), revision: revisions354.get(key)! };
      pending354.set(key, operation);
      return send(operation);
    });
    queues354.set(key, task);
    void task.finally(() => { if (queues354.get(key) === task) queues354.delete(key); }).catch(() => {});
    return task;
  };
  if (!revisions354.has(key) && !pending354.has(key)) {
    return request(path, { method: following ? 'PUT' : 'DELETE' }).catch(error => {
      if ((error as { code?: string })?.code !== 'FOLLOW_ORDER_REQUIRED') throw error;
      return ordered();
    });
  }
  return ordered();
};
