import { PageMeta } from "@/components/common/page-meta"
import { pageTitle } from "@/lib/seo"
import { useState, type FormEvent, type ChangeEvent } from "react"
import { Mail, Phone, MapPin, Send } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert } from "@/components/ui/alert"

import { contactApi } from "@/features/site/api/contact.api"
import { ApiError } from "@/lib/axios"

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  })

  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle")

  const [errorMsg, setErrorMsg] = useState("")
  
  const update =
    (key: keyof typeof form) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({
        ...current,
        [key]: e.target.value,
      }))
    }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    setStatus("sending")
    setErrorMsg("")

    try {
      await contactApi.send(form)

      setStatus("sent")

      setForm({
        name: "",
        email: "",
        subject: "",
        message: "",
      })
    } catch (err) {
      setStatus("error")

      if (err instanceof ApiError) {
        setErrorMsg(err.message)
      } else {
        setErrorMsg(
          "Could not send your message. Please try again."
        )
      }
    }
  }

  return (
    <main className="min-h-screen pt-28 pb-20 bg-muted/20">
      <PageMeta title={pageTitle("Contact Us")} description="Get in touch with Incredible India Travel for help with hotels, tour packages and custom trips across India." canonical="/contact" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-accent font-medium text-sm uppercase tracking-widest mb-2">
            Get in Touch
          </p>

          <h1 className="font-manrope text-3xl md:text-4xl font-bold text-foreground">
            Contact Us
          </h1>

          <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
            Questions about a booking, or planning something custom?
            We&apos;d love to help.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">

          {/* Contact Information */}
          <div className="md:col-span-2 space-y-4">

            <Card className="p-5 flex items-start gap-3">
              <Mail className="size-5 text-primary shrink-0 mt-0.5" />

              <div>
                <p className="font-medium text-foreground text-sm">
                  Email
                </p>

                <p className="text-sm text-muted-foreground">
                  support@indiatravel.com
                </p>
              </div>
            </Card>

            <Card className="p-5 flex items-start gap-3">
              <Phone className="size-5 text-primary shrink-0 mt-0.5" />

              <div>
                <p className="font-medium text-foreground text-sm">
                  Phone
                </p>

                <p className="text-sm text-muted-foreground">
                  +91 98765 43210
                </p>
              </div>
            </Card>

            <Card className="p-5 flex items-start gap-3">
              <MapPin className="size-5 text-primary shrink-0 mt-0.5" />

              <div>
                <p className="font-medium text-foreground text-sm">
                  Office
                </p>

                <p className="text-sm text-muted-foreground">
                  Connaught Place, New Delhi, India
                </p>
              </div>
            </Card>

          </div>

          {/* Contact Form */}
          <Card className="md:col-span-3 p-6">

            {status === "sent" ? (
              <Alert variant="success">
                Thanks for reaching out! We&apos;ll get back to you
                within 24 hours.
              </Alert>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-4"
              >

                {status === "error" && (
                  <Alert variant="destructive">
                    {errorMsg}
                  </Alert>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div className="space-y-1.5">
                    <Label htmlFor="name">
                      Name
                    </Label>

                    <Input
                      id="name"
                      required
                      value={form.name}
                      onChange={update("name")}
                      placeholder="Your name"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">
                      Email
                    </Label>

                    <Input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={update("email")}
                      placeholder="you@example.com"
                    />
                  </div>

                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="subject">
                    Subject
                  </Label>

                  <Input
                    id="subject"
                    value={form.subject}
                    onChange={update("subject")}
                    placeholder="How can we help?"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message">
                    Message
                  </Label>

                  <Textarea
                    id="message"
                    required
                    rows={5}
                    value={form.message}
                    onChange={update("message")}
                    placeholder="Write your message..."
                  />
                </div>

                <Button
                  type="submit"
                  disabled={status === "sending"}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Send className="size-4 mr-2" />

                  {status === "sending"
                    ? "Sending..."
                    : "Send Message"}
                </Button>

              </form>
            )}

          </Card>
        </div>
      </div>
    </main>
  )
}