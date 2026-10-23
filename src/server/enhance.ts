import sharp from 'sharp';

/** Provider abstraction: swap in a hosted image service without touching the product code. */
export interface EnhanceProvider {
  readonly name: string;
  /** Returns an enhanced WebP. Must never remove detail that signals condition. */
  enhance(input: Buffer): Promise<{ data: Buffer; width: number; height: number }>;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Real, credential-free enhancement built on sharp:
 *  - auto-orient, grey-world white balance (bounded ±15%)
 *  - exposure via bounded histogram normalisation
 *  - fit into a 4:5 frame on a neutral background (padding, NOT cropping, so nothing is cut off)
 *  - resize + light unsharp mask
 * It does not inpaint, retouch, or remove anything.
 */
export class LocalSharpProvider implements EnhanceProvider {
  readonly name = 'local-sharp';

  async enhance(input: Buffer) {
    const oriented = await sharp(input).rotate().toBuffer();
    const stats = await sharp(oriented).stats();
    const [r, g, b] = stats.channels.map((c) => c.mean || 1);
    const avg = (r + g + b) / 3;
    const gain = [r, g, b].map((m) => clamp(avg / m, 0.85, 1.15));
    const balanced = await sharp(oriented)
      .recomb([[gain[0], 0, 0], [0, gain[1], 0], [0, 0, gain[2]]])
      .normalise({ lower: 2, upper: 98 })
      .toBuffer();
    const out = await sharp(balanced)
      .resize({ width: 1200, height: 1500, fit: 'contain', background: '#FAF8F5' })
      .sharpen({ sigma: 0.7, m1: 0.8, m2: 1.2 })
      .webp({ quality: 86 })
      .toBuffer({ resolveWithObject: true });
    return { data: out.data, width: out.info.width, height: out.info.height };
  }
}
