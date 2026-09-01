from pathlib import Path

service_path = Path('src/services/playlistService.ts')
player_path = Path('src/components/GlobalPlayer.tsx')
service = service_path.read_text(encoding='utf-8')
player = player_path.read_text(encoding='utf-8')

old_import = "import { collection, doc, writeBatch, serverTimestamp, getDocs, setDoc, updateDoc, deleteDoc, query, where } from '../lib/firestoreMeasured';"
new_import = "import { collection, doc, writeBatch, serverTimestamp, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from '../lib/firestoreMeasured';"
if service.count(old_import) != 1:
    raise SystemExit(f'playlist import anchor count={service.count(old_import)}')
service = service.replace(old_import, new_import, 1)

anchor = """const isSamePlaylistSourceItem = (a: Partial<PlaylistItem> | any, b: Partial<PlaylistItem> | any) => {\n  const keyA = getPlaylistItemUniqueKey(a);\n  const keyB = getPlaylistItemUniqueKey(b);\n  return Boolean(keyA && keyB && keyA === keyB);\n};\n"""
helper = anchor + """

// 1006 — A playlist insert must stay O(1) as a folder grows. The old path read
// every item in the destination collection just to detect a duplicate and find
// max order, so saving one song could cost hundreds/thousands of reads. Query
// only the same source family (bounded) plus the single highest-order row.
const resolvePlaylistInsertOrder = async (itemsRef: any, itemData: Partial<PlaylistItem> | any): Promise<number> => {
  const sourceId = normalizeKeyPart(itemData?.sourceId || itemData?.trackId);
  const uniqueKey = getPlaylistItemUniqueKey(itemData);

  const duplicateSnap = sourceId
    ? await getDocs(query(itemsRef, where('sourceId', '==', sourceId), limit(8)))
    : await getDocs(query(itemsRef, where('playlistUniqueKey', '==', uniqueKey), limit(1)));

  let duplicate = false;
  duplicateSnap.forEach((entry) => {
    if (isSamePlaylistSourceItem(entry.data() as PlaylistItem, itemData)) duplicate = true;
  });
  if (duplicate) throw new Error('DUPLICATE');

  const tailSnap = await getDocs(query(itemsRef, orderBy('order', 'desc'), limit(1)));
  const highestOrder = tailSnap.empty ? 0 : Number((tailSnap.docs[0]?.data() as any)?.order || 0);
  return (Number.isFinite(highestOrder) ? highestOrder : 0) + 1;
};

// Saving from the global player only needs the fixed first Normal playlist.
// Resolve that one document directly instead of loading every Normal playlist.
export const getPrimaryNormalPlaylist = async (uid: string): Promise<Playlist | null> => {
  if (!uid) return null;
  const listsRef = collection(db, 'user_playlists', uid, 'lists');
  try {
    const snap = await getDocs(query(
      listsRef,
      where('type', '==', 'normal'),
      where('order', '==', 1),
      limit(1),
    ));
    const first = snap.docs[0];
    if (first) return { id: first.id, ...first.data() } as Playlist;
  } catch (error) {
    console.warn('[Playlist] Primary Normal lookup fell back to typed list query.', error);
  }
  const lists = await getPlaylistsByType(uid, 'normal');
  return lists[0] || null;
};
"""
if service.count(anchor) != 1:
    raise SystemExit(f'helper anchor count={service.count(anchor)}')
service = service.replace(anchor, helper, 1)

old_add = """export const addPlaylistItem = async (uid: string, playlistId: string, itemData: Omit<PlaylistItem, 'id' | 'addedAt' | 'updatedAt'>) => {\n  const itemsRef = collection(db, 'user_playlists', uid, 'lists', playlistId, 'items');\n  const itemsSnap = await getDocs(itemsRef);\n  \n  // Check for duplicates\n  let isDuplicate = false;\n  let maxOrder = 0;\n  \n  itemsSnap.forEach((doc) => {\n    const data = doc.data() as PlaylistItem;\n    if (isSamePlaylistSourceItem(data, itemData)) {\n      isDuplicate = true;\n    }\n    if (data.order > maxOrder) {\n      maxOrder = data.order;\n    }\n  });\n\n  if (isDuplicate) {\n    throw new Error('DUPLICATE');\n  }\n\n  const newOrder = maxOrder + 1;\n  const newItemRef = doc(itemsRef);\n  \n  await setDoc(newItemRef, {\n    ...itemData,\n    playlistUniqueKey: getPlaylistItemUniqueKey(itemData),\n    order: newOrder,\n    addedAt: serverTimestamp(),\n    updatedAt: serverTimestamp()\n  });\n\n  return newItemRef.id;\n};\n"""
new_add = """export const addPlaylistItem = async (uid: string, playlistId: string, itemData: Omit<PlaylistItem, 'id' | 'addedAt' | 'updatedAt'>) => {\n  const itemsRef = collection(db, 'user_playlists', uid, 'lists', playlistId, 'items');\n  const newOrder = await resolvePlaylistInsertOrder(itemsRef, itemData);\n  const newItemRef = doc(itemsRef);\n\n  await setDoc(newItemRef, {\n    ...itemData,\n    playlistUniqueKey: getPlaylistItemUniqueKey(itemData),\n    order: newOrder,\n    addedAt: serverTimestamp(),\n    updatedAt: serverTimestamp()\n  });\n\n  return newItemRef.id;\n};\n"""
if service.count(old_add) != 1:
    raise SystemExit(f'addPlaylistItem anchor count={service.count(old_add)}')
service = service.replace(old_add, new_add, 1)

old_move = """export const movePlaylistItem = async (uid: string, fromPlaylistId: string, toPlaylistId: string, item: PlaylistItem) => {\n  const toItemsRef = collection(db, 'user_playlists', uid, 'lists', toPlaylistId, 'items');\n  const toItemsSnap = await getDocs(toItemsRef);\n  \n  let isDuplicate = false;\n  let maxOrder = 0;\n  \n  toItemsSnap.forEach((doc) => {\n    const data = doc.data() as PlaylistItem;\n    if (isSamePlaylistSourceItem(data, item)) {\n      isDuplicate = true;\n    }\n    if (data.order > maxOrder) {\n      maxOrder = data.order;\n    }\n  });\n\n  if (isDuplicate) {\n    throw new Error('DUPLICATE');\n  }\n\n  const batch = writeBatch(db);\n  \n  // Add to new playlist\n  const newItemRef = doc(toItemsRef);\n  \n  if (!item.id) {\n    throw new Error(\"MISSING_ITEM_ID\");\n  }\n\n  const { id, ...itemWithoutId } = item;\n  const newItemData = {\n    ...itemWithoutId,\n    playlistUniqueKey: getPlaylistItemUniqueKey(itemWithoutId),\n    order: maxOrder + 1,\n    addedAt: serverTimestamp(),\n    updatedAt: serverTimestamp()\n  };\n"""
new_move = """export const movePlaylistItem = async (uid: string, fromPlaylistId: string, toPlaylistId: string, item: PlaylistItem) => {\n  const toItemsRef = collection(db, 'user_playlists', uid, 'lists', toPlaylistId, 'items');\n  const newOrder = await resolvePlaylistInsertOrder(toItemsRef, item);\n  const batch = writeBatch(db);\n\n  // Add to new playlist\n  const newItemRef = doc(toItemsRef);\n\n  if (!item.id) {\n    throw new Error(\"MISSING_ITEM_ID\");\n  }\n\n  const { id, ...itemWithoutId } = item;\n  const newItemData = {\n    ...itemWithoutId,\n    playlistUniqueKey: getPlaylistItemUniqueKey(itemWithoutId),\n    order: newOrder,\n    addedAt: serverTimestamp(),\n    updatedAt: serverTimestamp()\n  };\n"""
if service.count(old_move) != 1:
    raise SystemExit(f'movePlaylistItem anchor count={service.count(old_move)}')
service = service.replace(old_move, new_move, 1)
service_path.write_text(service, encoding='utf-8')

old_player_import = "import { ensureDefaultPlaylists, getPlaylistsByType, addPlaylistItem } from '../services/playlistService';"
new_player_import = "import { ensureDefaultPlaylists, getPrimaryNormalPlaylist, addPlaylistItem } from '../services/playlistService';"
if player.count(old_player_import) != 1:
    raise SystemExit(f'player import anchor count={player.count(old_player_import)}')
player = player.replace(old_player_import, new_player_import, 1)

old_lookup = """      await ensureDefaultPlaylists(user.uid);\n      const lists = await getPlaylistsByType(user.uid, 'normal');\n      const targetPlaylist = lists.find((p: any) => p?.id && !p?.isFallback) || lists[0];\n\n      if (!targetPlaylist?.id || (targetPlaylist as any).isFallback) {\n"""
new_lookup = """      // 1006 — Established users resolve only the one destination playlist.\n      // Default creation remains a one-time fallback for a genuinely empty account.\n      let targetPlaylist = await getPrimaryNormalPlaylist(user.uid);\n      if (!targetPlaylist?.id) {\n        await ensureDefaultPlaylists(user.uid);\n        targetPlaylist = await getPrimaryNormalPlaylist(user.uid);\n      }\n\n      if (!targetPlaylist?.id || (targetPlaylist as any).isFallback) {\n"""
if player.count(old_lookup) != 1:
    raise SystemExit(f'global player lookup anchor count={player.count(old_lookup)}')
player = player.replace(old_lookup, new_lookup, 1)
player_path.write_text(player, encoding='utf-8')
