import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(1, "Enter a message").max(4000),
});

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSending(true);
    const { error } = await supabase.from("contact_submissions").insert({ ...parsed.data, phone: parsed.data.phone || null });
    setSending(false);
    if (error) return toast.error("We couldn't send your message. Please email us instead.");
    setSent(true);
    setForm({ name: "", email: "", phone: "", message: "" });
  };
  if (sent) return <p role="status" className="rounded-lg border border-border bg-card p-5 text-sm">Thanks — our team will get back to you shortly.</p>;
  const field = "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm";
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input aria-label="Your name" placeholder="Your name" required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
        <input aria-label="Your email" type="email" placeholder="Email" required maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
      </div>
      <input aria-label="Phone (optional)" placeholder="Phone (optional)" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
      <textarea aria-label="Message" placeholder="How can we help?" required maxLength={4000} rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={field} />
      <Button type="submit" disabled={sending}>{sending ? "Sending…" : "Send message"}</Button>
    </form>
  );
}
