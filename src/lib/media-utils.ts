type MediaItem = {
  isPrimary: boolean;
  type?: string;
  file: { thumbnailUrl?: string | null; url: string };
};

export function resolveModelPhotoUrl(
  model: { media?: MediaItem[] },
  preferThumbnail = false
): string | null {
  if (!model.media?.length) return null;
  const photos = model.media.filter((m) => m.type === "PHOTO");
  const primary = photos.find((m) => m.isPrimary) || photos[0];
  if (!primary) return null;
  return (preferThumbnail && primary.file.thumbnailUrl) || primary.file.url;
}

export function resolveAssetPhotoUrl(
  asset: {
    media?: MediaItem[];
    model?: { media?: MediaItem[] };
  },
  preferThumbnail = false
): string | null {
  // Check asset's own photos first
  if (asset.media?.length) {
    const photos = asset.media.filter((m) => m.type === "PHOTO");
    const primary = photos.find((m) => m.isPrimary) || photos[0];
    if (primary) {
      return (preferThumbnail && primary.file.thumbnailUrl) || primary.file.url;
    }
  }
  // Fall back to model photo
  if (asset.model) {
    return resolveModelPhotoUrl(asset.model, preferThumbnail);
  }
  return null;
}

export function resolveKitPhotoUrl(
  kit: { media?: MediaItem[] },
  preferThumbnail = false
): string | null {
  if (!kit.media?.length) return null;
  const photos = kit.media.filter((m) => m.type === "PHOTO");
  const primary = photos.find((m) => m.isPrimary) || photos[0];
  if (!primary) return null;
  return (preferThumbnail && primary.file.thumbnailUrl) || primary.file.url;
}

export function isAssetPhotoCustom(asset: {
  media?: MediaItem[];
}): boolean {
  if (!asset.media?.length) return false;
  return asset.media.some((m) => m.type === "PHOTO");
}
