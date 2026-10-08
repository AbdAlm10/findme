import { snapshot } from "@/lib/groups"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params
  const data = snapshot(code)
  if (!data) return Response.json({ error: "المجموعة غير موجودة" }, { status: 404 })
  return Response.json(data, { headers: { "cache-control": "no-store" } })
}
