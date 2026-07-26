export const ASSET_KINDS = ['source_image', 'source_video', 'avatar'] as const;
export type UploadAssetKind = (typeof ASSET_KINDS)[number];

const ALLOWED_MIME_TYPES = {
  'image/jpeg': { extension: 'jpg', family: 'image' },
  'image/png': { extension: 'png', family: 'image' },
  'image/webp': { extension: 'webp', family: 'image' },
  'video/mp4': { extension: 'mp4', family: 'video' },
  'video/quicktime': { extension: 'mov', family: 'video' },
  'video/webm': { extension: 'webm', family: 'video' },
} as const;

const IMAGE_LIMIT_BYTES = 15 * 1024 * 1024;
const AVATAR_LIMIT_BYTES = 5 * 1024 * 1024;
const VIDEO_LIMIT_BYTES = 200 * 1024 * 1024;

export function sanitizeOriginalName(value: string) {
  const cleaned = value
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._ -]/gu, '')
    .trim()
    .slice(0, 160);
  return cleaned || 'upload';
}

export function validateAssetMetadata({
  fileName,
  kind,
  mimeType,
  sizeBytes,
}: {
  fileName: string;
  kind: UploadAssetKind;
  mimeType: string;
  sizeBytes: number;
}) {
  const format = ALLOWED_MIME_TYPES[mimeType as keyof typeof ALLOWED_MIME_TYPES];

  if (!format) {
    return { error: 'Use a JPG, PNG, WebP, MP4, MOV, or WebM file.' } as const;
  }

  const expectedFamily = kind === 'source_video' ? 'video' : 'image';
  if (format.family !== expectedFamily) {
    return {
      error:
        expectedFamily === 'image'
          ? 'Select a supported image file.'
          : 'Select a supported video file.',
    } as const;
  }

  const sizeLimit =
    kind === 'source_video'
      ? VIDEO_LIMIT_BYTES
      : kind === 'avatar'
        ? AVATAR_LIMIT_BYTES
        : IMAGE_LIMIT_BYTES;

  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > sizeLimit) {
    return {
      error:
        kind === 'source_video'
          ? 'Source videos must be 200 MB or smaller.'
          : kind === 'avatar'
            ? 'Profile images must be 5 MB or smaller.'
            : 'Source images must be 15 MB or smaller.',
    } as const;
  }

  return {
    extension: format.extension,
    originalName: sanitizeOriginalName(fileName),
    sizeLimit,
  } as const;
}

export function matchesAssetSignature(mimeType: string, bytes: Uint8Array) {
  if (mimeType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === 'image/png') {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    );
  }

  if (mimeType === 'image/webp') {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    );
  }

  if (mimeType === 'video/webm') {
    return (
      bytes[0] === 0x1a &&
      bytes[1] === 0x45 &&
      bytes[2] === 0xdf &&
      bytes[3] === 0xa3
    );
  }

  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') {
    return String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp';
  }

  return false;
}
