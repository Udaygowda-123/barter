import type { ClientSession } from 'mongoose';
import { AuditLog } from './models';

export const audit = (actorId: unknown, action: string, targetType?: string, targetId?: unknown, meta?: unknown, session?: ClientSession) =>
  AuditLog.create([{ actorId: actorId ?? null, action, targetType: targetType ?? null, targetId: targetId ? String(targetId) : null, meta }], { session });
