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
