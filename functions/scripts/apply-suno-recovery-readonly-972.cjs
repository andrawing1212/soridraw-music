const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '../src/index.ts');
let text = fs.readFileSync(target, 'utf8');
const marker = '// SORIDRAW_SUNO_RECOVERY_READONLY_972';

if (text.includes(marker)) {
  console.log('apply-suno-recovery-readonly-972: already applied');
  process.exit(0);
}

function replaceOnce(oldText, newText, label) {
  if (!text.includes(oldText)) {
    throw new Error(`apply-suno-recovery-readonly-972: anchor not found: ${label}`);
  }
  text = text.replace(oldText, newText);
}

replaceOnce(
`    const trackData = trackSnap.data();
    if (trackData?.taskId !== taskId) {
      res.status(400).json({ error: "Task ID mismatch" });
      return;
    }

    try {`,
`    const trackData = trackSnap.data();
    if (trackData?.taskId !== taskId) {
      res.status(400).json({ error: "Task ID mismatch" });
      return;
    }

    ${marker}
    // Playback/download URL recovery is read-only. Normal status polling keeps the
    // legacy persistence path, so existing generation/status behavior is unchanged.
    const recoveryOnly = req.body?.recoveryOnly === true || req.body?.recoveryOnly === "true";

    try {`,
  'recoveryOnly flag'
);

replaceOnce(
`      await trackRef.update(updates);

      // Also update suno_shares snapshot if it exists
      const shareRef = db.collection('suno_shares').doc(trackId);
      const shareSnap = await shareRef.get();
      if (shareSnap.exists) {
        // If status completed, update snapshot fields
        const shareUpdate: any = {
          status: status,
          sunoData: sunoData,
          apiStatusResponse: data,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        if (finalAudioUrl) shareUpdate.audioUrl = finalAudioUrl;
        if (finalImageUrl) shareUpdate.imageUrl = finalImageUrl;
        if (duration) shareUpdate.duration = duration;

        await shareRef.update(shareUpdate);
      }
`,
`      if (!recoveryOnly) {
        await trackRef.update(updates);

        // Normal status polling keeps the legacy shared snapshot synchronization.
        const shareRef = db.collection('suno_shares').doc(trackId);
        const shareSnap = await shareRef.get();
        if (shareSnap.exists) {
          const shareUpdate: any = {
            status: status,
            sunoData: sunoData,
            apiStatusResponse: data,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          if (finalAudioUrl) shareUpdate.audioUrl = finalAudioUrl;
          if (finalImageUrl) shareUpdate.imageUrl = finalImageUrl;
          if (duration) shareUpdate.duration = duration;

          await shareRef.update(shareUpdate);
        }
      }
`,
  'skip persistence for recoveryOnly'
);

replaceOnce(
`        audioValidationStatus,
        sunoData: sunoData,
        apiStatusResponse: data
      });`,
`        audioValidationStatus,
        sunoData: sunoData,
        apiStatusResponse: data,
        recoveryOnly
      });`,
  'getSunoTrackStatus response recoveryOnly marker'
);

for (const required of [
  marker,
  'const recoveryOnly = req.body?.recoveryOnly === true',
  'if (!recoveryOnly) {',
  'apiStatusResponse: data,\n        recoveryOnly',
]) {
  if (!text.includes(required)) {
    throw new Error(`apply-suno-recovery-readonly-972 verification failed: ${required}`);
  }
}

fs.writeFileSync(target, text, 'utf8');
console.log('apply-suno-recovery-readonly-972: recoveryOnly skips track/share writes while preserving normal status polling');
