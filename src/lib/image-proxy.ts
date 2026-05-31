const OFF_IMAGE_HOST = "images.openfoodfacts.org";

export function proxiedOffImageUrl(url?: string | null) {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);

    if (parsed.hostname !== OFF_IMAGE_HOST) {
      return url;
    }

    return `/api/images?src=${encodeURIComponent(url)}`;
  } catch {
    return url;
  }
}
