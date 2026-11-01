export type ImageGenModel = 'stills' | 'wan22' | 'wanExtend' | 'faceSwapExtend' | 'swapr' | 'swaprMix';

/** Unknown or missing values stay on stills so a bad saved key cannot blank the widget. */
export function normalizeImageGenModel(raw: unknown): ImageGenModel {
  if (
    raw === 'wan22' ||
    raw === 'wanExtend' ||
    raw === 'faceSwapExtend' ||
    raw === 'swapr' ||
    raw === 'swaprMix'
  ) {
    return raw;
  }
  return 'stills';
}
