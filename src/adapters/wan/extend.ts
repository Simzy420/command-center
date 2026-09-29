/** Public Hugging Face Space for Wan 2.2 Extend. Runpod stays behind the Space. */
export const WAN_EXTEND_SPACE_URL = 'https://simzy-wan22-extend.hf.space/';
export const WAN_EXTEND_EMBED_URL = 'https://simzy-wan22-extend.hf.space/?embed=true';

interface EmbedFrame {
  contentDocument: { location?: { href?: string } } | null;
  contentWindow: object | null;
}

/**
 * A framed Space that loaded cross-origin throws (or hides the document) when read.
 * A host that refuses the frame leaves an accessible about:blank document.
 */
export function embedFrameAccepted(frame: EmbedFrame): boolean {
  try {
    const doc = frame.contentDocument;
    if (doc == null) return frame.contentWindow != null;
    const href = doc.location?.href ?? '';
    return href !== '' && href !== 'about:blank';
  } catch {
    return true;
  }
}
