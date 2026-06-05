const OFF_IMAGE_HOSTS = new Set(["images.openfoodfacts.org", "static.openfoodfacts.org", "images.openfoodfacts.net"]);

export function proxiedOffImageUrl(url?: string | null) {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);

    if (!OFF_IMAGE_HOSTS.has(parsed.hostname)) {
      return url;
    }

    parsed.protocol = "https:";
    return `/api/images?src=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return url;
  }
}
