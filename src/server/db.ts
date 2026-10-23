import mongoose from 'mongoose';

const g = globalThis as unknown as { __mongo?: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } };
const cache = (g.__mongo ??= { conn: null, promise: null });

/** Cached connection: survives hot reloads in dev and warm serverless invocations on Vercel. */
export async function connectDb() {
  if (cache.conn) return cache.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  cache.promise ??= mongoose.connect(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 8000, autoIndex: process.env.NODE_ENV !== 'production' || process.env.MONGO_AUTO_INDEX === '1' });
  try { cache.conn = await cache.promise; } catch (e) { cache.promise = null; throw e; }
  return cache.conn;
}

/** Runs fn in a transaction (needs a replica set — Atlas always is). Transient conflicts are retried by the driver. */
export async function withTx<T>(fn: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const conn = await connectDb();
  return conn.connection.transaction(fn) as Promise<T>;
}
