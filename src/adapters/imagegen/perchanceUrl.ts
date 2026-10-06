/** Official external entry for the same text-to-image plugin as ai-photo-generator. */
export const PERCHANCE_API_PAGE = 'https://perchance.org/perchance-ai-api';

const ALLOWED_HOSTS = new Set(['user.uploads.dev', 'user-uploads.perchance.org']);

export function perchanceGenerateUrl(prompt: string, id: string): string {
  const url = new URL(PERCHANCE_API_PAGE);
  url.searchParams.set('prompt', prompt);
  url.searchParams.set('resolution', '512x512');
  url.searchParams.set('format', 'json');
  url.searchParams.set('guidanceScale', '7');
  url.searchParams.set('seed', '-1');
  url.searchParams.set('id', id);
  return url.toString();
}

/** Pull a finished v1/image JSON payload out of the generator frame's text. */
export function parsePerchanceFrameText(text: string): { url: string } | null {
  const compact = text.replace(/\s+/g, ' ');
  if (!/"ok"\s*:\s*true/.test(compact)) return null;
  const match = compact.match(/"url"\s*:\s*"(https:\/\/[^"\\]+|data:image\/[^"\\]+)"/);
  if (!match) return null;
  const url = match[1].replace(/\\u0026/g, '&');
  return isPerchanceImageUrl(url) ? { url } : null;
}

export function isPerchanceImageUrl(url: string): boolean {
  if (url.startsWith('data:image/')) return url.length > 32 && url.length < 2_500_000;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}
