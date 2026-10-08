import { snapshot, subscribe } from "@/lib/groups"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params
  const initial = snapshot(code)
  if (!initial) return Response.json({ error: "المجموعة غير موجودة" }, { status: 404 })

  const encoder = new TextEncoder()
  let cleanup = () => {}
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: ReturnType<typeof snapshot>) => {
        try {
          if (!data) {
            controller.enqueue(encoder.encode("event: gone\ndata: {}\n\n"))
            controller.close()
            cleanup()
            return
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          cleanup()
        }
      }
      send(initial)
      const unsubscribe = subscribe(code, send)
      const pulse = setInterval(() => send(snapshot(code)), 10000)
      cleanup = () => {
        clearInterval(pulse)
        unsubscribe()
      }
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  })
}
