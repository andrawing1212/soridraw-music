import { DatabaseSync } from 'node:sqlite';
import { prove390 } from './lib/like-receipt-390-fixture.mjs';
const db = new DatabaseSync(':memory:');
try {
  await prove390(async (sql, params = []) => {
    const before = db.prepare('SELECT total_changes() n').get().n;
    const statement = db.prepare(sql);
    const results = statement.all(...params);
    const written = db.prepare('SELECT total_changes() n').get().n - before;
    return { success: true, results, meta: { rows_written: written } };
  });
} finally { db.close(); }
