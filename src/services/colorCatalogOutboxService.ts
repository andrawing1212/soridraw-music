// New color-only server outbox transport. OFF until independent shared-server
// release approval. The existing local-first UI and direct canonical save remain
// unchanged when this flag is absent.
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

export const isCanonicalColorOutboxClientEnabled =
  import.meta.env.VITE_COLOR_CATALOG_OUTBOX_V1 === '1';

type ColorRequest = {
  kind:'musicNote'|'library';
  documentId:string;
  field:'favoriteColorTag'|'colorTags'|'favoriteColorTags';
  color:string|null;
  index?:number;
};
type ColorResult = {ok:boolean;changed:boolean;pending:boolean};

export const commitCanonicalColorWithOutboxClient = async (request:ColorRequest):Promise<ColorResult> => {
  if (!isCanonicalColorOutboxClientEnabled) throw new Error('COLOR_OUTBOX_CLIENT_DISABLED');
  const region = getFunctions(getApp(),'asia-northeast3');
  const callable = httpsCallable<ColorRequest,ColorResult>(region,'commitCanonicalColorWithOutbox');
  const response = await callable(request);
  if (!response.data?.ok) throw new Error('COLOR_OUTBOX_CANONICAL_COMMIT_NOT_CONFIRMED');
  return response.data;
};
