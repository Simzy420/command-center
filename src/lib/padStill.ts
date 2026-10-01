/** Geometry for padding a tight still so Wan Animate does not crop the head. */

export const WAN_ANIMATE_FRAME = { width: 832, height: 480 } as const;
export const WAN_ANIMATE_ASPECT = WAN_ANIMATE_FRAME.width / WAN_ANIMATE_FRAME.height;

export type StillPadPlan = {
  /** Final canvas size before downscale (exact target aspect). */
  canvasWidth: number;
  canvasHeight: number;
  /** Where the source pixels are drawn. */
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
  padTop: number;
  padBottom: number;
  padLeft: number;
  padRight: number;
};

export type StillPadOptions = {
  /** Extra space above the still, as a fraction of source height. Default 0.28. */
  topFrac?: number;
  /** Extra space on each side, as a fraction of source width. Default 0.14. */
  sideFrac?: number;
  /** Extra space below the still, as a fraction of source height. Default 0.12. */
  bottomFrac?: number;
  /** Output aspect (width / height). Default 832/480. */
  targetAspect?: number;
};

/**
 * Plan a padded canvas that keeps the whole still visible at the Runpod
 * landscape aspect. Extra headroom is biased to the top so a close-up face
 * survives the cover-style framing Wan Animate applies to driving clips.
 */
export function planStillPad(
  sourceWidth: number,
  sourceHeight: number,
  options: StillPadOptions = {},
): StillPadPlan {
  const srcW = Math.max(1, Math.round(sourceWidth));
  const srcH = Math.max(1, Math.round(sourceHeight));
  const topFrac = options.topFrac ?? 0.28;
  const sideFrac = options.sideFrac ?? 0.14;
  const bottomFrac = options.bottomFrac ?? 0.12;
  const targetAspect = options.targetAspect ?? WAN_ANIMATE_ASPECT;

  let padTop = Math.round(srcH * topFrac);
  let padBottom = Math.round(srcH * bottomFrac);
  let padLeft = Math.round(srcW * sideFrac);
  let padRight = padLeft;

  let canvasWidth = srcW + padLeft + padRight;
  let canvasHeight = srcH + padTop + padBottom;
  const aspect = canvasWidth / canvasHeight;

  if (aspect < targetAspect) {
    const needW = Math.max(canvasWidth, Math.round(canvasHeight * targetAspect));
    const extra = needW - canvasWidth;
    const addLeft = Math.floor(extra / 2);
    const addRight = extra - addLeft;
    padLeft += addLeft;
    padRight += addRight;
    canvasWidth = needW;
  } else if (aspect > targetAspect) {
    const needH = Math.max(canvasHeight, Math.round(canvasWidth / targetAspect));
    const extra = needH - canvasHeight;
    // Prefer headroom when expanding vertically.
    const addTop = Math.round(extra * 0.7);
    const addBottom = extra - addTop;
    padTop += addTop;
    padBottom += addBottom;
    canvasHeight = needH;
  }

  return {
    canvasWidth,
    canvasHeight,
    drawX: padLeft,
    drawY: padTop,
    drawWidth: srcW,
    drawHeight: srcH,
    padTop,
    padBottom,
    padLeft,
    padRight,
  };
}

function sampleEdgeFill(ctx: CanvasRenderingContext2D, width: number, height: number): string {
  try {
    const points = [
      [2, 2],
      [width - 3, 2],
      [2, height - 3],
      [width - 3, height - 3],
      [Math.floor(width / 2), 2],
    ] as const;
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (const [x, y] of points) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      r += pixel[0];
      g += pixel[1];
      b += pixel[2];
      n += 1;
    }
    if (!n) return '#1a1a1e';
    return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
  } catch {
    return '#1a1a1e';
  }
}

/**
 * Re-encode a phone still with headroom padding into a JPEG sized for Runpod.
 * Falls back to the original file if canvas encoding is unavailable.
 */
export async function padStillForAnimate(file: File, maxEdge = 1280): Promise<File> {
  if (!file || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const plan = planStillPad(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxEdge / Math.max(plan.canvasWidth, plan.canvasHeight));
    const outW = Math.max(2, Math.round(plan.canvasWidth * scale));
    const outH = Math.max(2, Math.round(plan.canvasHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (typeof bitmap.close === 'function') bitmap.close();
      return file;
    }

    // Temporary draw of the source alone to sample edge color for fill.
    const probe = document.createElement('canvas');
    probe.width = Math.max(2, Math.round(bitmap.width * Math.min(1, 64 / bitmap.width)));
    probe.height = Math.max(2, Math.round(bitmap.height * Math.min(1, 64 / bitmap.height)));
    const probeCtx = probe.getContext('2d');
    const fill = probeCtx
      ? (probeCtx.drawImage(bitmap, 0, 0, probe.width, probe.height), sampleEdgeFill(probeCtx, probe.width, probe.height))
      : '#1a1a1e';

    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(
      bitmap,
      0,
      0,
      bitmap.width,
      bitmap.height,
      Math.round(plan.drawX * scale),
      Math.round(plan.drawY * scale),
      Math.round(plan.drawWidth * scale),
      Math.round(plan.drawHeight * scale),
    );
    if (typeof bitmap.close === 'function') bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return file;
    return new File([blob], 'photo-padded.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
