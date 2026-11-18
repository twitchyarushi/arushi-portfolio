import { NextResponse } from "next/server";
import { API_BASE, REVALIDATE_SECONDS } from "../../../components/f1/config";
import { buildF1Data } from "../../../components/f1/mapF1";

// The hourly refresh comes from the per-fetch cache below; the route itself runs per request,
// so a failed upstream call is never cached as a 502.
export const dynamic = "force-dynamic";

async function getJson(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const [drivers, constructors, next] = await Promise.all([
    getJson("/current/driverStandings/"),
    getJson("/current/constructorStandings/"),
    getJson("/current/next/"),
  ]);

  if (drivers === null && constructors === null && next === null) {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }
  return NextResponse.json(buildF1Data({ drivers, constructors, next }));
}
