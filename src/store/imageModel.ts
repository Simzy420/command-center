export type ImageGenModel = 'stills' | 'wan22' | 'wanExtend' | 'swapr';

/** Unknown or missing values stay on stills so a bad saved key cannot blank the widget. */
export function normalizeImageGenModel(raw: unknown): ImageGenModel {
  if (raw === 'wan22' || raw === 'wanExtend' || raw === 'swapr') return raw;
  return 'stills';
}
