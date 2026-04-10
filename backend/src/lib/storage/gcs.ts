import { Storage } from "@google-cloud/storage";

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME || "pinpoint-ai-data-dev";

export async function generateUploadUrl(
  fileName: string,
  contentType: string,
  expiresInMinutes = 15
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);

  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + expiresInMinutes * 60 * 1000,
    contentType,
  });

  const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
  return { uploadUrl, publicUrl };
}

export async function uploadBuffer(
  fileName: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);

  await file.save(buffer, {
    contentType,
    resumable: false,
  });

  return `https://storage.googleapis.com/${bucketName}/${fileName}`;
}

export async function generateDownloadUrl(
  fileName: string,
  expiresInMinutes = 60
): Promise<string> {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  });

  return url;
}
