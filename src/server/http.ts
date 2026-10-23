import { ZodError, ZodTypeAny, z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export const bad = (code: string, message: string, details?: unknown) => new HttpError(400, code, message, details);
export const forbidden = (code = 'FORBIDDEN', message = 'Not allowed') => new HttpError(403, code, message);
export const notFound = (code = 'NOT_FOUND', message = 'Not found') => new HttpError(404, code, message);
export const conflict = (code: string, message: string) => new HttpError(409, code, message);

export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data ?? {});
  if (!r.success) throw new HttpError(400, 'VALIDATION_FAILED', 'Some fields need attention', (r.error as ZodError).issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  return r.data;
}

/** Marks a non-JSON-default response (custom status, cookies, headers). */
export class Reply {
  constructor(public body: unknown, public status = 200, public headers: Record<string, string> = {}, public cookies: string[] = []) {}
}
export const reply = (body: unknown, status = 200, extra: { headers?: Record<string, string>; cookies?: string[] } = {}) => new Reply(body, status, extra.headers, extra.cookies);
