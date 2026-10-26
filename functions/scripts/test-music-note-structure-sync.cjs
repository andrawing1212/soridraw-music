const assert = require('node:assert/strict');
const {
  hasMusicNoteStructureRelevantChange,
  getMusicNoteStructureSignalVersion,
} = require('../lib/musicNoteStructureSync.js');

assert.equal(hasMusicNoteStructureRelevantChange({ other: 1 }, { other: 2 }), false, 'unrelated structure fields must not signal');
assert.equal(hasMusicNoteStructureRelevantChange({ musicNoteFolders: { myNote: [] } }, { musicNoteFolders: { myNote: [{ id: 'x' }] } }), true, 'folder mutation must signal');
assert.equal(hasMusicNoteStructureRelevantChange({ musicNoteCardState: { items: {} } }, { musicNoteCardState: { items: { x: { liked: true } } } }), true, 'card-state mutation must signal');
assert.equal(hasMusicNoteStructureRelevantChange({ musicNoteFolders: { myNote: [] }, musicNoteCardState: { items: {} } }, { musicNoteFolders: { myNote: [] }, musicNoteCardState: { items: {} }, other: 1 }), false, 'identical relevant state must stay quiet');
assert.equal(getMusicNoteStructureSignalVersion({ musicNoteStructureVersion: 120 }, 130, 110), 120, 'fresh client mutation version is mirrored exactly');
assert.equal(getMusicNoteStructureSignalVersion({}, 130, 110), 130, 'legacy client event time produces a signal');
assert.equal(getMusicNoteStructureSignalVersion({ musicNoteStructureVersion: 120 }, 130, 140), 141, 'stale or concurrent client mutation advances the authority version');
console.log('Music Note structure signal contract: 7 cases PASS');

const { buildLegacyMusicNoteFolderRecovery, chooseLegacyMusicNoteFolderRecovery } =
  require('../lib/musicNoteStructureSync.js');
const originalFolders = {
  myNote: [{ id: 'default', title: 'My Note' }, { id: 'f', title: 'modern-stored' }],
  sharedNote: [{ id: 'default', title: 'Shared Note' }],
};
const modern = {
  musicNoteStructureWriterToken: 'client-100000-random-token',
  musicNoteStructureVersion: 100001,
  musicNoteFolders: originalFolders,
};
const oldClient = {
  ...modern,
  musicNoteStructureVersion: 100000,
  musicNoteFolders: { ...originalFolders,
    myNote: [{ id: 'default', title: 'My Note' }, { id: 'f', title: 'old-browser-edit' }] },
};
const conflicting = buildLegacyMusicNoteFolderRecovery(modern, oldClient);
assert.ok(conflicting);
assert.deepEqual(conflicting.changedModes, ['myNote']);
assert.equal(chooseLegacyMusicNoteFolderRecovery(conflicting, 'before').myNote[1].title, 'modern-stored');
assert.equal(chooseLegacyMusicNoteFolderRecovery(conflicting, 'after').myNote[1].title, 'old-browser-edit');
assert.equal(modern.musicNoteFolders.myNote[1].title, 'modern-stored');
assert.equal(oldClient.musicNoteFolders.myNote[1].title, 'old-browser-edit');
console.log('APP514_OLD_CLIENT_OVERWRITE_ARCHIVES_BOTH_EDIT_STATES=PASS');

assert.ok(buildLegacyMusicNoteFolderRecovery(modern, {
  ...oldClient, musicNoteStructureVersion: 900000000,
}), 'fast-clock old writer still detected even if its proposed version is higher');
assert.ok(buildLegacyMusicNoteFolderRecovery(modern, {
  ...oldClient, musicNoteStructureVersion: modern.musicNoteStructureVersion,
}), 'same-version old writer also detected');
console.log('APP514_OLD_FAST_CLOCK_AND_EQUAL_VERSION_RECOVERY=PASS');

const modernWrite = {
  ...oldClient, musicNoteStructureWriterToken: 'client-200000-new-token',
};
assert.equal(buildLegacyMusicNoteFolderRecovery(modern, modernWrite), null);
assert.equal(buildLegacyMusicNoteFolderRecovery(modern, {
  ...modern, musicNoteCardState: { items: { x: { liked: false } } },
}), null);
assert.equal(buildLegacyMusicNoteFolderRecovery({ ...modern, musicNoteStructureWriterToken: undefined }, oldClient), null);
assert.equal(buildLegacyMusicNoteFolderRecovery(modern, modern), null);
console.log('APP514_HEALTHY_NEW_CLIENT_AND_CARD_ONLY_W0_ARCHIVE=PASS');

const sharedEdited = {
  ...modern, musicNoteFolders: {
    ...originalFolders,
    sharedNote: [{ id: 'default', title: 'Shared changed by old app' }],
  },
};
const sharedRecord = buildLegacyMusicNoteFolderRecovery(modern, sharedEdited);
assert.deepEqual(sharedRecord.changedModes, ['sharedNote']);
assert.deepEqual(chooseLegacyMusicNoteFolderRecovery(sharedRecord, 'before'), {
  sharedNote: originalFolders.sharedNote,
});
assert.deepEqual(chooseLegacyMusicNoteFolderRecovery(sharedRecord, 'after'), {
  sharedNote: sharedEdited.musicNoteFolders.sharedNote,
});
assert.throws(() => chooseLegacyMusicNoteFolderRecovery({ ...sharedRecord, schemaVersion: 2 }, 'after'));
console.log('APP514_RECOVERY_ONLY_CHANGED_MODES_AND_EXPLICIT_CHOICE=PASS');

const indexSource = require('node:fs').readFileSync('src/index.ts', 'utf8');
assert.match(indexSource, /buildLegacyMusicNoteFolderRecovery\(before, after\)/);
assert.match(indexSource, /\.collection\("legacy_recovery"\)\.doc\(eventKey\)/);
assert.match(indexSource, /await recoveryRef\.create\(recoveryPayload\)/);
assert.match(indexSource, /if \(legacyRecovery\)/);
console.log('APP514_RECOVERY_CONFLICT_ONLY_IDEMPOTENT_WRITE_PATH=PASS');
