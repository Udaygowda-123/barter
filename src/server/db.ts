import mongoose from 'mongoose';

/** Bump when indexes change; connect() syncs indexes once and records the version, so cold starts cost one tiny read. */
const INDEX_VERSION = 3;
type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const g = globalThis as unknown as { __mongo?: Cache };
const cache = (g.__mongo ??= { conn: null, promise: null });

async function ensureIndexes(conn: typeof mongoose) {
  const meta = conn.connection.db!.collection<{ _id: string; v: number }>('_meta');
  if ((await meta.findOne({ _id: 'indexes' }))?.v === INDEX_VERSION) return;
  await import('./models'); // registers every model
  await Promise.all(Object.values(conn.models).map((m) => m.syncIndexes()));
  await meta.updateOne({ _id: 'indexes' }, { $set: { v: INDEX_VERSION } }, { upsert: true });
}

/** Cached connection: survives hot reloads in dev and warm serverless invocations on Vercel. */
export async function connectDb() {
  if (cache.conn) return cache.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  cache.promise ??= mongoose.connect(uri, { maxPoolSize: 5, minPoolSize: 0, maxIdleTimeMS: 30_000, serverSelectionTimeoutMS: 6000, autoIndex: false, autoCreate: false })
    .then(async (c) => { await ensureIndexes(c).catch((e) => console.error('[db] index sync failed (continuing):', e?.message)); return c; });
  try { cache.conn = await cache.promise; } catch (e) { cache.promise = null; throw e; }
  return cache.conn;
}

/** Runs fn in a transaction (needs a replica set — Atlas always is). Transient conflicts are retried by the driver. */
export async function withTx<T>(fn: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const conn = await connectDb();
  return conn.connection.transaction(fn) as Promise<T>;
}
