const n = (v: string | undefined, d: number) => (v ? Number(v) : d);
export const env = {
  get nodeEnv() { return process.env.NODE_ENV ?? 'development'; },
  get isProd() { return process.env.NODE_ENV === 'production'; },
  get jwtSecret() {
    const s = process.env.JWT_ACCESS_SECRET;
    if (!s || s.length < 32) throw new Error('JWT_ACCESS_SECRET must be set to at least 32 characters');
    return new TextEncoder().encode(s);
  },
  get accessTtl() { return n(process.env.ACCESS_TOKEN_TTL_SECONDS, 900); },
  get refreshDays() { return n(process.env.REFRESH_TOKEN_TTL_DAYS, 30); },
  get offerTtlHours() { return n(process.env.OFFER_TTL_HOURS, 72); },
  get rateScale() { return n(process.env.RATE_LIMIT_SCALE, 1); }, // tests set a big number
};
export const COOKIE = 'swapd_rt';
