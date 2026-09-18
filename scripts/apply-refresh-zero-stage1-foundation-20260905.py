from pathlib import Path
import json

# RTDB rules: owner reads only their tiny control revision. Clients cannot write it.
rp = Path('database.rules.json')
data = json.loads(rp.read_text(encoding='utf-8'))
root = data.setdefault('rules', {})
if 'userControls' in root:
    raise SystemExit('userControls already exists; inspect before reapplying')
root['userControls'] = {
    '$uid': {
        '.read': 'auth != null && auth.uid === $uid',
        '.write': False,
        'revision': {'.validate': 'data.isString()'},
        'updatedAt': {'.validate': 'data.isNumber()'},
        'reason': {'.validate': 'data.isString() && data.val().length <= 64'},
        '$other': {'.validate': False},
    }
}
rp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Tiny client-only RTDB subscription. Stage1 intentionally does NOT wire auth bootstrap yet.
sp = Path('src/services/userControlRevisionService.ts')
if sp.exists():
    raise SystemExit('userControlRevisionService already exists')
sp.write_text("""import { onValue, ref, type Unsubscribe } from 'firebase/database';
import { realtimeDb } from '../firebase';

export type UserControlRevision = {
  revision: string;
  updatedAt: number;
  reason: string;
};

const STORAGE_PREFIX = 'soridraw_user_control_revision_v1_';
const storageKey = (uid: string) => `${STORAGE_PREFIX}${uid}`;

export const readSeenUserControlRevision = (uid: string): string => {
  if (!uid || typeof window === 'undefined') return '';
  try { return String(window.localStorage.getItem(storageKey(uid)) || ''); } catch { return ''; }
};

export const writeSeenUserControlRevision = (uid: string, revision: string) => {
  if (!uid || !revision || typeof window === 'undefined') return;
  try { window.localStorage.setItem(storageKey(uid), revision); } catch {}
};

const normalizeRevision = (raw: unknown): UserControlRevision | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const revision = String(value.revision || '').trim();
  if (!revision) return null;
  return {
    revision,
    updatedAt: Math.max(0, Number(value.updatedAt || 0) || 0),
    reason: String(value.reason || '').slice(0, 64),
  };
};

// SORIDRAW_USER_CONTROL_REVISION_STAGE1_20260905
// One tiny UID-scoped RTDB node only. Never read Firestore or any song collection here.
export const subscribeUserControlRevision = (
  uid: string,
  onRevision: (value: UserControlRevision | null) => void,
  onError?: (error: unknown) => void,
): Unsubscribe => {
  if (!uid) return () => undefined;
  return onValue(
    ref(realtimeDb, `userControls/${uid}`),
    (snapshot) => onRevision(normalizeRevision(snapshot.val())),
    (error) => onError?.(error),
  );
};
""", encoding='utf-8')

# Functions: one strict admin callable writes the tiny RTDB revision.
fp = Path('functions/src/index.ts')
s = fp.read_text(encoding='utf-8')
marker = 'SORIDRAW_USER_CONTROL_REVISION_STAGE1_20260905'
if marker in s:
    raise SystemExit('stage1 function marker already exists')
anchor = 'const requireAdminCaller = async (request: CallableRequestLike, requiredPermission?: AdminPermissionKey) => {'
if anchor not in s:
    raise SystemExit('requireAdminCaller anchor missing')
helper = '''// SORIDRAW_USER_CONTROL_REVISION_STAGE1_20260905
// Admin/security changes are rare. Publish only a tiny invalidation marker to RTDB.
// No profile payload and no song/list data is copied into this channel.
const writeUserControlRevision = async (targetUid: string, rawReason: string) => {
  const safeUid = String(targetUid || "").trim();
  if (!safeUid) throw new HttpsError("invalid-argument", "대상 회원 UID가 필요합니다.");
  const now = Date.now();
  const reason = String(rawReason || "control-change").slice(0, 64);
  const revision = `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await admin.database().ref(`userControls/${safeUid}`).set({ revision, updatedAt: now, reason });
  return { revision, updatedAt: now };
};

'''
s = s.replace(anchor, helper + anchor, 1)
insert = 'export const adminForceLogoutUser = onCall('
if insert not in s:
    raise SystemExit('adminForceLogoutUser anchor missing')
callable = '''export const adminSignalUserControlRevision = onCall(
  { region: "us-central1" },
  async (request) => {
    const { db, requesterUid } = await requireAdminCaller(request, "userManagement");
    const targetUid = String(request.data?.targetUid || "").trim();
    await assertManageableTarget(db, requesterUid, targetUid);
    const reason = String(request.data?.reason || "admin-user-settings").slice(0, 64);
    const signal = await writeUserControlRevision(targetUid, reason);
    return { ok: true, targetUid, ...signal };
  }
);

'''
s = s.replace(insert, callable + insert, 1)
fp.write_text(s, encoding='utf-8')

# Admin user management: emit parallel signal after real control/security actions.
ap = Path('src/pages/AdminUserManagementPage.tsx')
p = ap.read_text(encoding='utf-8')
old = """      await updateDoc(doc(db, 'users', selectedUser.uid), updates);\n      setSaveStatus('success');"""
new = """      const userControlChanged = editRole !== selectedUser.role || editStatus !== selectedUser.accountStatus;\n      await updateDoc(doc(db, 'users', selectedUser.uid), updates);\n      if (userControlChanged) {\n        const signalControlRevision = httpsCallable(functions, 'adminSignalUserControlRevision');\n        void signalControlRevision({ targetUid: selectedUser.uid, reason: 'admin-user-settings' }).catch((error) => {\n          console.warn('User control revision signal failed; Firestore listener fallback remains active.', error);\n        });\n      }\n      setSaveStatus('success');"""
if p.count(old) != 1:
    raise SystemExit(f'executeUpdate anchor count={p.count(old)}')
p = p.replace(old, new, 1)

old2 = """      const callable = httpsCallable(functions, functionName);\n      await callable(payload);\n      setActionResult({ success: true, message: successMessage });"""
new2 = """      const callable = httpsCallable(functions, functionName);\n      await callable(payload);\n      if (action === 'forceLogout' || action === 'resetEmail' || action === 'deleteUser') {\n        const signalControlRevision = httpsCallable(functions, 'adminSignalUserControlRevision');\n        void signalControlRevision({ targetUid: selectedUser.uid, reason: action }).catch((error) => {\n          console.warn('User control revision signal failed; Firestore listener fallback remains active.', error);\n        });\n      }\n      setActionResult({ success: true, message: successMessage });"""
if p.count(old2) != 1:
    raise SystemExit(f'runAdminCallable anchor count={p.count(old2)}')
p = p.replace(old2, new2, 1)

old3 = """        await callable({\n          targetUid: selectedUser.uid,\n          staffRole: promotedToAdmin ? 'admin' : null,\n          adminPermissions: promotedToAdmin ? { ...FULL_ADMIN_PERMISSIONS } : {},\n        });\n        const masterUid = auth.currentUser?.uid || '';"""
new3 = """        await callable({\n          targetUid: selectedUser.uid,\n          staffRole: promotedToAdmin ? 'admin' : null,\n          adminPermissions: promotedToAdmin ? { ...FULL_ADMIN_PERMISSIONS } : {},\n        });\n        const signalControlRevision = httpsCallable(functions, 'adminSignalUserControlRevision');\n        void signalControlRevision({ targetUid: selectedUser.uid, reason: 'admin-access' }).catch((error) => {\n          console.warn('Admin access revision signal failed; Firestore listener fallback remains active.', error);\n        });\n        const masterUid = auth.currentUser?.uid || '';"""
if p.count(old3) != 1:
    raise SystemExit(f'admin access anchor count={p.count(old3)}')
p = p.replace(old3, new3, 1)
ap.write_text(p, encoding='utf-8')

# Master permission page is a second real admin-access mutation entry point.
mp = Path('src/pages/MasterPermissionsPage.tsx')
m = mp.read_text(encoding='utf-8')
mold = """      const callable = httpsCallable(functions, 'masterSetAdminAccess');\n      await callable({ targetUid: user.uid, staffRole: 'admin', adminPermissions: permissions });\n      const nextAdmins: AppUserInfo[] = admins.map((item) => item.uid === user.uid"""
mnew = """      const callable = httpsCallable(functions, 'masterSetAdminAccess');\n      await callable({ targetUid: user.uid, staffRole: 'admin', adminPermissions: permissions });\n      const signalControlRevision = httpsCallable(functions, 'adminSignalUserControlRevision');\n      void signalControlRevision({ targetUid: user.uid, reason: 'admin-permissions' }).catch((error) => {\n        console.warn('Admin permission revision signal failed; Firestore listener fallback remains active.', error);\n      });\n      const nextAdmins: AppUserInfo[] = admins.map((item) => item.uid === user.uid"""
if m.count(mold) != 1:
    raise SystemExit(f'MasterPermissions anchor count={m.count(mold)}')
mp.write_text(m.replace(mold, mnew, 1), encoding='utf-8')

# Permanent static guard.
gp = Path('scripts/verify-user-control-revision-foundation.mjs')
gp.write_text("""import fs from 'node:fs';
const service = fs.readFileSync('src/services/userControlRevisionService.ts', 'utf8');
const rules = fs.readFileSync('database.rules.json', 'utf8');
const functions = fs.readFileSync('functions/src/index.ts', 'utf8');
const adminPage = fs.readFileSync('src/pages/AdminUserManagementPage.tsx', 'utf8');
const masterPage = fs.readFileSync('src/pages/MasterPermissionsPage.tsx', 'utf8');
if (!service.includes('SORIDRAW_USER_CONTROL_REVISION_STAGE1_20260905')) throw new Error('control service marker missing');
if (!service.includes('userControls/${uid}')) throw new Error('UID-scoped control path missing');
if (/collection\\(|getDocs\\(|onSnapshot\\(|firebase\\/firestore/.test(service)) throw new Error('control service must never touch Firestore/song collections');
if (!rules.includes('"userControls"') || !rules.includes('auth.uid === $uid')) throw new Error('owner-only control read rule missing');
if (!functions.includes('adminSignalUserControlRevision') || !functions.includes('admin.database().ref(`userControls/${safeUid}`)')) throw new Error('control writer missing');
if (!adminPage.includes("httpsCallable(functions, 'adminSignalUserControlRevision')")) throw new Error('admin page control signal missing');
if (!masterPage.includes("httpsCallable(functions, 'adminSignalUserControlRevision')")) throw new Error('master permission signal missing');
console.log('SORIDRAW USER CONTROL REVISION FOUNDATION: PASS');
console.log('Invariant: one tiny UID-scoped RTDB control marker only; no song collection access.');
""", encoding='utf-8')
