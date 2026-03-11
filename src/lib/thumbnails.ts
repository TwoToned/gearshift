import sharp from "sharp";

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isImageMimeType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType);
}

export interface ThumbnailResult {
  thumbnail: Buffer;
  thumbnailMimeType: string;
  originalWidth: number;
  originalHeight: number;
}

export async function generateThumbnail(
  buffer: Buffer,
  mimeType: string
): Promise<ThumbnailResult | null> {
  if (!isImageMimeType(mimeType)) return null;

  const image = sharp(buffer).rotate(); // auto-rotate from EXIF
  const metadata = await image.metadata();
  const hasAlpha = metadata.hasAlpha || mimeType === "image/png" || mimeType === "image/webp";

  const resized = image.resize(300, 300, { fit: "inside", withoutEnlargement: true });

  // Preserve transparency for PNGs/WebPs, use JPEG for opaque images
  const thumbnail = hasAlpha
    ? await resized.png({ quality: 80 }).toBuffer()
    : await resized.jpeg({ quality: 80 }).toBuffer();

  return {
    thumbnail,
    thumbnailMimeType: hasAlpha ? "image/png" : "image/jpeg",
    originalWidth: metadata.width || 0,
    originalHeight: metadata.height || 0,
  };
}

/** File extension for thumbnail based on mime type */
export function thumbExtension(mimeType: string): string {
  return mimeType === "image/png" ? ".png" : ".jpg";
}
