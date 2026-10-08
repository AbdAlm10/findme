import { createGroup } from "@/lib/groups"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return Response.json({ error: "طلب غير مفهوم" }, { status: 400 })
  const result = createGroup(body.name, body.groupName)
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 })
  return Response.json(result)
}
