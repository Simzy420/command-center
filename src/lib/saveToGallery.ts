/** Save a generated clip into the phone photo gallery when the OS allows it. */

export type SaveToGalleryResult = 'shared' | 'downloaded';

export async function saveVideoToGallery(
  url: string,
  filename = 'become-the-character.mp4',
): Promise<SaveToGalleryResult> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch the clip (HTTP ${res.status}).`);
  const blob = await res.blob();
  const type = blob.type && blob.type.startsWith('video/') ? blob.type : 'video/mp4';
  const file = new File([blob], filename, { type });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title: 'Become the Character' });
    return 'shared';
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  return 'downloaded';
}
