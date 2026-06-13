import { NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set(["images.openfoodfacts.org", "static.openfoodfacts.org", "images.openfoodfacts.net"]);
const IMAGE_FETCH_TIMEOUT_MS = 8_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("src");

  if (!url) {
    return NextResponse.json({ ok: false, message: "src required" }, { status: 400 });
  }

  try {
    const parsed = new URL(url);

    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return NextResponse.json({ ok: false, message: "Host not allowed" }, { status: 400 });
    }

    parsed.protocol = "https:";

    const response = await fetchWithTimeout(parsed.toString());

    if (!response.ok) {
      return NextResponse.json({ ok: false, message: "Unable to fetch image", status: response.status }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const contentLength = Number(response.headers.get("content-length"));

    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ ok: false, message: "Image too large" }, { status: 413 });
    }

    const body = await response.arrayBuffer();

    if (body.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ ok: false, message: "Image too large" }, { status: 413 });
    }

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"
      }
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid image url" }, { status: 400 });
  }
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "EcoFoodStock/0.1.0"
      }
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
