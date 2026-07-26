'use client';

import { DetailedError, Upload } from 'tus-js-client';

const RESUMABLE_THRESHOLD_BYTES = 6 * 1024 * 1024;
const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

export function shouldUseResumableUpload(file: File) {
  return file.size > RESUMABLE_THRESHOLD_BYTES;
}

function uploadErrorMessage(error: Error | DetailedError) {
  if (error instanceof DetailedError) {
    const body = error.originalResponse?.getBody();
    if (body) {
      try {
        const parsed = JSON.parse(body) as { message?: string };
        if (parsed.message) return parsed.message;
      } catch {
        // Fall through to the safe error message below.
      }
    }
  }

  return error.message || 'The resumable upload could not be completed.';
}

export function uploadResumably({
  bucket,
  contentType,
  file,
  onProgress,
  path,
  token,
}: {
  bucket: string;
  contentType: string;
  file: File;
  onProgress: (percentage: number) => void;
  path: string;
  token: string;
}) {
  const projectUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  const projectRef = projectUrl.hostname.split('.')[0];
  const endpoint =
    `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;

  return new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint,
      chunkSize: TUS_CHUNK_SIZE_BYTES,
      headers: {
        'x-signature': token,
      },
      metadata: {
        bucketName: bucket,
        cacheControl: '3600',
        contentType,
        objectName: path,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      fingerprint: async () =>
        ['morphly', bucket, path, file.name, file.size, file.lastModified].join('-'),
      onError: (error) => reject(new Error(uploadErrorMessage(error))),
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress(Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100)));
      },
      onSuccess: () => {
        onProgress(100);
        resolve();
      },
    });

    upload.start();
  });
}
