#!/usr/bin/env node
'use strict';

/**
 * SORIDRAW Backend V2 read-only inventory tool.
 *
 * SAFETY CONTRACT
 * - This script never calls set/create/update/delete/batch/transaction writes.
 * - Default mode performs metadata discovery + aggregation counts only.
 * - Document sampling is OFF by default and must be explicitly enabled with --sample=N.
 * - Sample output never prints document values or document IDs; it prints only field names and approximate byte size.
 * - Secret/server-only collections are never sampled.
 * - Run only after the current daily Firestore usage baseline is checked.
 *
 * Usage:
 *   cd functions
 *   node scripts/inventory-readonly.cjs --project=soridraw-app-866a5
 *   node scripts/inventory-readonly.cjs --project=soridraw-app-866a5 --sample=1
 *
 * Authentication:
 *   Uses Firebase Admin / Application Default Credentials from the operator environment.
 *   The target project must be explicit in automated runs so credential-file project metadata
 *   cannot silently redirect the inventory to a different Firebase project.
 */

const admin = require('firebase-admin');

const args = process.argv.slice(2);
const sampleArg = args.find((value) => value.startsWith('--sample='));
const projectArg = args.find((value) => value.startsWith('--project='));
const sampleSize = Math.max(0, Math.min(3, Number(sampleArg?.split('=')[1] || 0) || 0));
const explicitProjectId = String(projectArg?.slice('--project='.length) || '').trim() || null;

const SECRET_OR_SERVER_ONLY = new Set([
  'user_api_keys',
  'gemini_request_guards',
  'admin_permission_audit',
]);

// Known nested collection groups from the current SORIDRAW schema.
// These are counted separately because top-level collection counts do not include subcollection documents.
const KNOWN_COLLECTION_GROUPS = [
  'tracks',
  'lists',
  'items',
  'bundles',
  'users',
];

const toSafeFieldList = (data) => Object.keys(data || {}).sort();

const approximateBytes = (data) => {
  try {
    const normalized = JSON.stringify(data, (_key, value) => {
      if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
      if (value && typeof value.path === 'string' && value.constructor?.name === 'DocumentReference') {
        return '[DocumentReference]';
      }
      if (Buffer.isBuffer(value)) return `[Buffer:${value.length}]`;
      return value;
    });
    return Buffer.byteLength(normalized || '', 'utf8');
  } catch {
    return null;
  }
};

const countQuery = async (query) => {
  const snapshot = await query.count().get();
  return Number(snapshot.data()?.count || 0);
};

const toSafeSample = (doc) => {
  const data = doc.data() || {};
  return {
    fieldNames: toSafeFieldList(data),
    approximateBytes: approximateBytes(data),
    valuesRedacted: true,
    documentIdRedacted: true,
  };
};

const sampleCollection = async (collectionRef, topLevelName) => {
  if (sampleSize <= 0 || SECRET_OR_SERVER_ONLY.has(topLevelName)) return [];
  const snapshot = await collectionRef.limit(sampleSize).get();
  return snapshot.docs.map(toSafeSample);
};

const sampleCollectionGroup = async (query) => {
  if (sampleSize <= 0) return [];
  const snapshot = await query.limit(sampleSize).get();
  return snapshot.docs.map(toSafeSample);
};

const main = async () => {
  if (admin.apps.length === 0) {
    admin.initializeApp(explicitProjectId ? { projectId: explicitProjectId } : undefined);
  }

  const db = admin.firestore();
  const projectId = admin.app().options.projectId
    || explicitProjectId
    || process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT
    || null;

  if (explicitProjectId && projectId !== explicitProjectId) {
    throw new Error(`Target project mismatch: expected ${explicitProjectId}, resolved ${projectId}`);
  }

  const startedAt = Date.now();
  const topLevelRefs = await db.listCollections();
  const topLevelCollections = [];

  for (const collectionRef of topLevelRefs.sort((a, b) => a.id.localeCompare(b.id))) {
    const count = await countQuery(collectionRef);
    const samples = await sampleCollection(collectionRef, collectionRef.id);
    topLevelCollections.push({
      name: collectionRef.id,
      documentCount: count,
      sensitive: SECRET_OR_SERVER_ONLY.has(collectionRef.id),
      samples,
    });
  }

  const collectionGroups = [];
  for (const groupName of KNOWN_COLLECTION_GROUPS) {
    try {
      const groupQuery = db.collectionGroup(groupName);
      const count = await countQuery(groupQuery);
      const samples = await sampleCollectionGroup(groupQuery);
      collectionGroups.push({ name: groupName, documentCount: count, samples });
    } catch (error) {
      collectionGroups.push({
        name: groupName,
        documentCount: null,
        samples: [],
        error: String(error?.message || error),
      });
    }
  }

  const report = {
    tool: 'SORIDRAW Backend V2 read-only inventory',
    safety: {
      databaseWrites: 0,
      databaseDeletes: 0,
      valuesPrinted: false,
      documentIdsPrinted: false,
      sampleSizePerCollection: sampleSize,
      note: 'Aggregation counts and optional sample reads still consume Firestore read quota. Capture the daily usage baseline first.',
    },
    projectId,
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    topLevelCollections,
    collectionGroups,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
};

main().catch((error) => {
  console.error('[inventory-readonly] failed:', error?.stack || error);
  process.exitCode = 1;
});
