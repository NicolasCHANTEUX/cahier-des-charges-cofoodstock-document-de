import { NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set(["images.openfoodfacts.org", "static.openfoodfacts.org", "images.openfoodfacts.net"]);

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

    const response = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "EcoFoodStock/0.1.0"
      }
    });

    if (!response.ok) {
      return NextResponse.json({ ok: false, message: "Unable to fetch image", status: response.status }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const body = await response.arrayBuffer();

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
