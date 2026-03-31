import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

let s3Client = null;

function getS3Client() {
  if (!s3Client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return null;
    }

    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return s3Client;
}

export async function uploadToR2(buffer, key, mimeType) {
  const client = getS3Client();
  const bucketName = process.env.R2_BUCKET_NAME || 'petlife-uploads';

  if (!client) {
    // Dev/test fallback: return a mock URL
    console.log(`[STORAGE MOCK] Upload: ${key} (${mimeType}, ${buffer.length} bytes)`);
    const publicUrl = process.env.R2_PUBLIC_URL || 'https://cdn.petlife.app';
    return `${publicUrl}/${key}`;
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });

  await client.send(command);

  return getPublicUrl(key);
}

export function getPublicUrl(key) {
  const publicUrl = process.env.R2_PUBLIC_URL || 'https://cdn.petlife.app';
  return `${publicUrl}/${key}`;
}

// Allowed MIME types for uploads
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateUpload(mimeType, size) {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: `File type ${mimeType} is not allowed. Allowed: jpg, png, webp, pdf` };
  }

  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds maximum of 5MB` };
  }

  return { valid: true };
}

// For testing
export function setS3Client(client) {
  s3Client = client;
}
