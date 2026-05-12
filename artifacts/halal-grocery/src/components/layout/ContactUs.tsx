import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import emailjs from '@emailjs/browser';
import { toast } from 'sonner';

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;
const EMAILJS_CONFIGURED = !!(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);

async function sendContactEmail(params: { name: string; email: string; subject: string; message: string }) {
  if (EMAILJS_CONFIGURED) {
    await emailjs.send(
      EMAILJS_SERVICE_ID!,
      EMAILJS_TEMPLATE_ID!,
      {
        from_name: params.name,
        from_email: params.email,
        reply_to: params.email,
        subject: params.subject || 'Contact via Numa Fresh website',
        message: params.message,
      },
      EMAILJS_PUBLIC_KEY!
    );
  } else {
    const body = `Name: ${params.name}\nEmail: ${params.email}\n\n${params.message}`;
    window.location.href = `mailto:numasetup@gmail.com?subject=${encodeURIComponent(params.subject || 'Contact via Numa Fresh website')}&body=${encodeURIComponent(body)}`;
    await new Promise(r => setTimeout(r, 400));
  }
}

export function ContactUs({ inModal = false }: { inModal?: boolean }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await sendContactEmail({ name, email, subject, message });
      setSubmitted(true);
      setName(''); setEmail(''); setSubject(''); setMessage('');
      toast.success('Message sent! We\'ll get back to you soon.');
      setTimeout(() => setSubmitted(false), 5000);
    } catch {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (inModal) {
    return (
      <div className="p-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <p className="text-xs font-bold tracking-widest uppercase text-primary mb-1">Get In Touch</p>
          <h2 className="font-serif text-2xl font-bold mb-1">Contact Us</h2>
          <p className="text-muted-foreground text-sm">Have a question? Send us a note — we read every message.</p>
        </motion.div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-contact-name" className="text-xs font-semibold">Your Name</Label>
              <Input id="m-contact-name" required value={name} onChange={e => setName(e.target.value)} placeholder="Fatima Rahman" className="rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-contact-email" className="text-xs font-semibold">Email Address</Label>
              <Input id="m-contact-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="rounded-xl h-11" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-contact-subject" className="text-xs font-semibold">Subject</Label>
            <Input id="m-contact-subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="What can we help with?" className="rounded-xl h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-contact-message" className="text-xs font-semibold">Message</Label>
            <textarea id="m-contact-message" required value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell us what you need..." className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
          <Button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-11 gap-2 font-semibold">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : submitted ? <><CheckCircle className="w-4 h-4" /> Sent!</> : <><Send className="w-4 h-4" /> Send Message</>}
          </Button>
          {submitted && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-primary font-medium text-center">
              Message sent! We'll get back to you shortly.
            </motion.p>
          )}
        </form>
      </div>
    );
  }

  return (
    <section id="contact" className="bg-muted/30 border-t border-border/50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <p className="text-xs font-bold tracking-widest uppercase text-primary mb-2">Get In Touch</p>
          <h2 className="font-serif text-3xl md:text-4xl font-bold mb-2">Contact Us</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Have a question, feedback, or partnership idea? Send us a note — we read every message.
          </p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-card border border-border/60 rounded-3xl p-6 md:p-10 shadow-sm space-y-5"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name" className="text-xs font-semibold">Your Name</Label>
              <Input
                id="contact-name"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Fatima Rahman"
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-email" className="text-xs font-semibold">Email Address</Label>
              <Input
                id="contact-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-xl h-11"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-subject" className="text-xs font-semibold">Subject</Label>
            <Input
              id="contact-subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="What can we help with?"
              className="rounded-xl h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-message" className="text-xs font-semibold">Message</Label>
            <textarea
              id="contact-message"
              required
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Tell us a bit about what you need..."
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm min-h-[140px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              By sending, you agree to our <a href="/privacy" className="underline hover:text-foreground">privacy policy</a>.
            </p>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl h-11 px-6 gap-2 font-semibold w-full sm:w-auto"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
              ) : submitted ? (
                <><CheckCircle className="w-4 h-4" /> Sent</>
              ) : (
                <><Send className="w-4 h-4" /> Send Message</>
              )}
            </Button>
          </div>
          {submitted && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-primary font-medium text-center"
            >
              Message sent! We'll get back to you shortly.
            </motion.p>
          )}
        </motion.form>
      </div>
    </section>
  );
}
