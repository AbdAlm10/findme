import { leaveGroup } from "@/lib/groups"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null
  const result = leaveGroup(code, body?.token)
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status })
  return Response.json(result)
}
