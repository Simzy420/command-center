export type ImageGenModel = 'stills' | 'wan22' | 'wanExtend';

/** Unknown or missing values stay on stills so a bad saved key cannot blank the widget. */
export function normalizeImageGenModel(raw: unknown): ImageGenModel {
  if (raw === 'wan22' || raw === 'wanExtend') return raw;
  return 'stills';
}
