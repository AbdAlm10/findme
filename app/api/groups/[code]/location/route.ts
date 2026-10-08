import { updateLocation } from "@/lib/groups"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return Response.json({ error: "طلب غير مفهوم" }, { status: 400 })
  const result = updateLocation(code, body)
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status })
  return Response.json(result)
}
