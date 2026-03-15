/**
 * Seed 100k users into MongoDB
 *
 * Performance strategy
 * ────────────────────
 * bcrypt at saltRounds=10 ≈ 100 ms/hash.  Hashing every user individually
 * would take ~2.8 hours for 100k users.  Instead we hash the seed password
 * ONCE and reuse the hash — all seed accounts share the same password so the
 * result is identical anyway.
 *
 * MongoDB insertMany with ordered:false lets the server pipeline writes
 * efficiently and skips duplicate-email errors without aborting the batch.
 *
 * Usage
 * ─────
 *   npx ts-node scripts/seed-users.ts
 *   npx ts-node scripts/seed-users.ts --count 50000
 *   npx ts-node scripts/seed-users.ts --count 100000 --batch 2000
 *   npx ts-node scripts/seed-users.ts --clear          # wipe seed users first
 *
 * Options
 * ───────
 *   --count  Total users to insert      (default: 100000)
 *   --batch  Documents per insertMany   (default: 1000)
 *   --clear  Delete existing seed users before inserting
 *   --uri    MongoDB URI                (default: MONGODB_URI env or localhost)
 */

import * as bcrypt from 'bcrypt';
import { MongoClient, ObjectId } from 'mongodb';

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, fallback: string) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};

const TOTAL   = parseInt(opt('count', '100000'), 10);
const BATCH   = parseInt(opt('batch', '1000'),   10);
const CLEAR   = flag('clear');
const MONGO_URI =
  opt('uri', '') ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/messaging-patterns';

const SEED_PASSWORD  = 'Seed@Password1';
const SEED_EMAIL_TAG = '@seed.test'; // marker so --clear can target only seeds

// ── Helpers ─────────────────────────────────────────────────────────────────
function pad(n: number, width = 6) {
  return String(n).padStart(width, '0');
}

function buildBatch(
  start: number,
  size: number,
  hashedPassword: string,
  now: Date,
): object[] {
  const docs: object[] = [];
  for (let i = start; i < start + size && i <= TOTAL; i++) {
    const idx = pad(i);
    docs.push({
      _id:              new ObjectId(),
      email:            `user_${idx}${SEED_EMAIL_TAG}`,
      password:         hashedPassword,
      name:             `Seed User ${idx}`,
      firstName:        `User`,
      lastName:         idx,
      role:             'admin',
      isActive:         true,
      isEmailVerified:  true,
      points:           0,
      createdAt:        now,
      updatedAt:        now,
    });
  }
  return docs;
}

function bar(done: number, total: number, width = 30): string {
  const pct   = done / total;
  const filled = Math.round(pct * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${(pct * 100).toFixed(1)}%`;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱 User Seed Script');
  console.log('─'.repeat(50));
  console.log(`  Target URI   : ${MONGO_URI}`);
  console.log(`  Total users  : ${TOTAL.toLocaleString()}`);
  console.log(`  Batch size   : ${BATCH.toLocaleString()}`);
  console.log(`  Clear first  : ${CLEAR}`);
  console.log('─'.repeat(50));

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db   = client.db();
  const coll = db.collection('users');

  // ── Optional: wipe existing seed accounts ──────────────────────────────
  if (CLEAR) {
    process.stdout.write('  Clearing existing seed users… ');
    const { deletedCount } = await coll.deleteMany({ email: { $regex: `${SEED_EMAIL_TAG}$` } });
    console.log(`deleted ${deletedCount.toLocaleString()}`);
  }

  // ── Ensure index (idempotent) ───────────────────────────────────────────
  await coll.createIndex({ email: 1 }, { unique: true, background: true });

  // ── Hash password ONCE — reuse for every document ───────────────────────
  process.stdout.write('\n  Hashing seed password (once)… ');
  const t0 = Date.now();
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);
  console.log(`done (${Date.now() - t0} ms)\n`);

  // ── Bulk insert ──────────────────────────────────────────────────────────
  const now        = new Date();
  let inserted     = 0;
  let skipped      = 0;
  const startTime  = Date.now();

  for (let start = 1; start <= TOTAL; start += BATCH) {
    const docs = buildBatch(start, BATCH, hashedPassword, now);

    try {
      const result = await coll.insertMany(docs as any[], { ordered: false });
      inserted += result.insertedCount;
    } catch (err: any) {
      // ordered:false — partial success when some emails already exist
      if (err.code === 11000 /* BulkWriteError: duplicate key */) {
        const ok  = err.result?.nInserted ?? 0;
        const dup = docs.length - ok;
        inserted += ok;
        skipped  += dup;
      } else {
        throw err;
      }
    }

    const done    = Math.min(start + BATCH - 1, TOTAL);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate    = Math.round(inserted / elapsed);
    process.stdout.write(
      `\r  ${bar(done, TOTAL)}  ${done.toLocaleString()}/${TOTAL.toLocaleString()}  ${rate.toLocaleString()} docs/s   `,
    );
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n');
  console.log('─'.repeat(50));
  console.log(`  ✅ Inserted : ${inserted.toLocaleString()}`);
  if (skipped > 0) {
    console.log(`  ⏭  Skipped  : ${skipped.toLocaleString()} (already existed)`);
  }
  console.log(`  ⏱  Time     : ${totalSec}s`);
  console.log(`  🔑 Password : ${SEED_PASSWORD}`);
  console.log('─'.repeat(50));
  console.log();

  await client.close();
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
