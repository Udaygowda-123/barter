import { MongoMemoryReplSet } from 'mongodb-memory-server';

/** A throwaway single-node replica set (transactions need one) — your real database is never touched. */
export default async function setup() {
  const rs = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.TEST_MONGO_URI = rs.getUri();
  return async () => { await rs.stop(); };
}
