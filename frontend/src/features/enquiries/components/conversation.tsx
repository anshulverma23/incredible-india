import { useEffect, useRef, useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { EnquiryMessage } from "@/features/enquiries/types"

const KIND_LABEL: Partial<Record<EnquiryMessage["kind"], string>> = {
  quotation: "Quotation",
  revision_request: "Change request",
  counter_offer: "Counter-offer",
  counter_response: "Counter-offer reply",
}

const time = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })

/** Chat timeline + composer. `viewer` decides which side "my" messages are on. */
export function Conversation({ messages, viewer, onSend, canSend = true, closedNote }: { messages: EnquiryMessage[]; viewer: "customer" | "admin"; onSend: (text: string) => Promise<void>; canSend?: boolean; closedNote?: string }) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" })
  }, [messages.length])

  const send = async () => {
    const value = text.trim()
    if (!value || sending) return
    setSending(true)
    try {
      await onSend(value)
      setText("")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-[420px] min-h-40 space-y-3 overflow-y-auto rounded-lg bg-muted/40 p-3" aria-live="polite">
        {messages.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No messages yet. {viewer === "customer" ? "Our team will write to you soon - or send the first message." : "Send the first message to start the discussion."}</p>}
        {messages.map((m, i) => {
          if (m.sender === "system" || m.kind === "status") {
            return <p key={i} className="text-center text-xs text-muted-foreground">{m.text} · {time(m.at)}</p>
          }
          const mine = m.sender === viewer
          const tag = KIND_LABEL[m.kind]
          return (
            <div key={i} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm", mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-card ring-1 ring-foreground/10")}>
                <p className={cn("mb-0.5 text-[11px] font-medium", mine ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {m.sender === "admin" ? (viewer === "admin" ? "You" : "Travel expert") : viewer === "admin" ? "Customer" : "You"}
                  {tag ? ` · ${tag}` : ""}
                </p>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>{time(m.at)}</p>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {canSend ? (
        <div className="flex items-end gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message..." maxLength={2000} className="min-h-12" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send() }} />
          <Button onClick={send} disabled={sending || !text.trim()} aria-label="Send message" className="bg-primary text-primary-foreground hover:bg-primary/90"><Send className="size-4" /></Button>
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">{closedNote || "This enquiry is closed."}</p>
      )}
    </div>
  )
}
