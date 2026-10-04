export const CHANNEL_MEDIA_BUCKET = 'channel-media';
export const MEDIA_CAPTION_LIMIT = 1024;

export function channelMediaSpec(contentType: string, size: number) {
  const type = contentType === 'video/mp4' ? 'video' : ['image/jpeg', 'image/png'].includes(contentType) ? 'photo' : null;
  const limit = (type === 'video' ? 20 : 5) * 1024 * 1024;
  if (!type || !Number.isSafeInteger(size) || size < 1 || size > limit) throw new Error('Choose a JPG or PNG photo up to 5 MB, or an MP4 video up to 20 MB.');
  return { type, contentType, size, extension: type === 'video' ? 'mp4' : contentType === 'image/png' ? 'png' : 'jpg' } as const;
}

export function channelMediaType(bytes: Uint8Array) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if ([137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return 'image/png';
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 16 && ascii(4,8) === 'ftyp' && ascii(8,12) !== 'qt  ') return 'video/mp4';
  throw new Error('This file is not a supported photo or MP4 video.');
}
