import { updateProfile, type User } from 'firebase/auth';

// SORIDRAW_GLOBAL_PROFILE_AVATAR_AUTHORITY_216_20260928
// Display rule for every signed-in SORIDRAW surface:
// 1) SORIDRAW public-profile avatar, when one exists.
// 2) Google provider avatar.
// 3) Firebase Auth photoURL / no image.
// Keeping the effective value in Firebase Auth makes existing app surfaces that
// already render user.photoURL converge without adding Firestore/D1 reads.
export const SORIDRAW_PROFILE_AVATAR_EVENT = 'soridraw:profile-avatar-authority-updated';

export type SoridrawProfileAvatarSource = 'public-profile' | 'google' | 'auth' | 'none';

const clean = (value: unknown) => String(value || '').trim();

export const getSoridrawGoogleAvatarUrl = (user: User | null | undefined): string => {
  if (!user) return '';
  const google = user.providerData.find((entry) => entry.providerId === 'google.com');
  return clean(google?.photoURL);
};

export const resolveSoridrawProfileAvatar = (
  user: User | null | undefined,
  publicProfileAvatarUrl?: string | null,
): { url: string; source: SoridrawProfileAvatarSource } => {
  const publicUrl = clean(publicProfileAvatarUrl);
  if (publicUrl) return { url: publicUrl, source: 'public-profile' };

  const googleUrl = getSoridrawGoogleAvatarUrl(user);
  if (googleUrl) return { url: googleUrl, source: 'google' };

  const authUrl = clean(user?.photoURL);
  if (authUrl) return { url: authUrl, source: 'auth' };

  return { url: '', source: 'none' };
};

const emitAvatarAuthority = (
  user: User,
  url: string,
  source: SoridrawProfileAvatarSource,
) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SORIDRAW_PROFILE_AVATAR_EVENT, {
    detail: { uid: user.uid, url, source },
  }));
};

export const syncSoridrawProfileAvatarAuthority = async (
  user: User,
  publicProfileAvatarUrl?: string | null,
): Promise<{ url: string; source: SoridrawProfileAvatarSource; changed: boolean }> => {
  const resolved = resolveSoridrawProfileAvatar(user, publicProfileAvatarUrl);
  const current = clean(user.photoURL);
  const changed = current !== resolved.url;

  if (changed) {
    await updateProfile(user, { photoURL: resolved.url || null });
  }

  emitAvatarAuthority(user, resolved.url, resolved.source);
  return { ...resolved, changed };
};
