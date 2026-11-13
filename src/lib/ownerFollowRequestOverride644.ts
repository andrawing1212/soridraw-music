// APP644: opt-in browser version selection for one approved owner only.
// This header is a routing selector, NEVER an authentication or authorization
// control. Cloudflare still validates Firebase Auth/AppCheck/canonical writes.
import { hasOwnerFollowCanaryOptIn634 } from './ownerFollowCanaryTab634';

const PREVIEW_HOST_644 = 'preview.soridraw.com';
const VERSION_644 = 'soridraw-explore-preview="6b13cde4-4a53-42d2-873f-361f7cf5a931"';
const HEADER_644 = 'Cloudflare-Workers-Version-Overrides';

export const ownerFollowOverrideHeaders644 = (
  hostname: string,
  search: string,
  sessionStorage: Pick<Storage,'getItem'> | null,
  targetUid: string,
  approvedOwnerUid: string,
): Record<string,string> => {
  // Follows by all other targets, all other hosts and all ordinary tabs
  // retain the exact original network path with NO new headers or requests.
  if (hostname !== PREVIEW_HOST_644 || !approvedOwnerUid ||
      targetUid !== approvedOwnerUid) return {};
  if (!hasOwnerFollowCanaryOptIn634(hostname, search, sessionStorage))
    return {};
  return { [HEADER_644]: VERSION_644 };
};
