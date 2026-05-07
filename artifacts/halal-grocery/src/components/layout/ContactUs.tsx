import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ContactUs() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const body = `Name: ${name}\nEmail: ${email}\n\n${message}`;
    const url = `mailto:numasetup@gmail.com?subject=${encodeURIComponent(subject || 'Contact via Numa Fresh website')}&body=${encodeURIComponent(body)}`;
    try { window.location.href = url; } catch { /* noop */ }
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setName(''); setEmail(''); setSubject(''); setMessage('');
      setTimeout(() => setSubmitted(false), 5000);
    }, 600);
  };

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
              Your email client should have opened with the message ready to send.
            </motion.p>
          )}
        </motion.form>
      </div>
    </section>
  );
}
