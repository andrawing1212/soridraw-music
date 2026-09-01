const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.resolve(__dirname, '..', 'src', 'index.ts');
let source = fs.readFileSync(sourcePath, 'utf8');

const MARKER = '// SORIDRAW_SUNO_WAV_RESCUE_REUSE_ONLY_995';

if (!source.includes(MARKER)) {
  const bodyAnchor = "    const body = req.body && typeof req.body === 'object' ? req.body : {};\n";
  if (!source.includes(bodyAnchor)) {
    throw new Error('995 body anchor missing');
  }

  source = source.replace(
    bodyAnchor,
    bodyAnchor
      + "    const reuseOnly = body.reuseOnly === true || body.data?.reuseOnly === true;\n"
      + `    ${MARKER}\n`,
    1,
  );

  const createAnchor = "    if (!providerResult) {\n      const createResponse = await fetch('https://api.sunoapi.org/api/v1/wav/generate', {\n";
  if (!source.includes(createAnchor)) {
    throw new Error('995 create anchor missing');
  }

  source = source.replace(
    createAnchor,
    "    if (!providerResult && wavTaskId) {\n"
      + "      res.status(202).json({\n"
      + "        ok: false,\n"
      + "        pending: true,\n"
      + "        code: 'SUNO_RESCUE_EXISTING_TASK_PENDING',\n"
      + "        error: 'An existing WAV rescue task is still unavailable; a second paid rescue will not be started.',\n"
      + "        index,\n"
      + "        audioId,\n"
      + "        reuseOnly,\n"
      + "      });\n"
      + "      return;\n"
      + "    }\n\n"
      + "    if (!providerResult && reuseOnly) {\n"
      + "      res.status(404).json({\n"
      + "        ok: false,\n"
      + "        code: 'SUNO_RESCUE_NOT_PREVIOUSLY_RECOVERED',\n"
      + "        error: 'No existing recovered audio is available for this track.',\n"
      + "        index,\n"
      + "        audioId,\n"
      + "        reuseOnly: true,\n"
      + "      });\n"
      + "      return;\n"
      + "    }\n\n"
      + createAnchor,
    1,
  );

  fs.writeFileSync(sourcePath, source, 'utf8');
}

const verify = fs.readFileSync(sourcePath, 'utf8');
for (const expected of [
  MARKER,
  'reuseOnly = body.reuseOnly === true',
  "code: 'SUNO_RESCUE_EXISTING_TASK_PENDING'",
  'if (!providerResult && wavTaskId)',
  "code: 'SUNO_RESCUE_NOT_PREVIOUSLY_RECOVERED'",
  'if (!providerResult && reuseOnly)',
]) {
  if (!verify.includes(expected)) {
    throw new Error(`995 verification failed: ${expected}`);
  }
}

console.log('apply-suno-wav-rescue-reuse-only-995: no-new-credit reuse guard + one-paid-attempt guard applied');
