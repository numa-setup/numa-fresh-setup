import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  /** True for the seeded greeting — never sent as conversation context */
  seed?: boolean;
}

const STORAGE_KEY = 'numa-chat-history-v2';
const OPEN_KEY = 'numa-chat-open-v1';
const MAX_HISTORY = 20;

function makeGreeting(): ChatMessage {
  return {
    role: 'assistant',
    content: "Assalamu alaikum! 👋 I'm Numa, your halal grocery assistant. Ask me about Halal certifications, finding stores nearby, meal planning, Eid pre-orders — anything Numa Fresh!",
    ts: Date.now(),
    seed: true,
  };
}

const SUGGESTIONS = [
  'How do I know a store is truly halal?',
  'What is ISNA vs IFANCA certification?',
  'Help me plan Eid groceries',
  'How does the meal planner work?',
];

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [makeGreeting()]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load persisted state on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
      if (localStorage.getItem(OPEN_KEY) === '1') setOpen(true);
    } catch {}
  }, []);

  // Persist messages
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
    } catch {}
  }, [messages]);

  // Persist open state
  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? '1' : '0');
    } catch {}
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    setError(null);

    const userMsg: ChatMessage = { role: 'user', content: text, ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setSending(true);

    try {
      // Send last MAX_HISTORY non-seed turns as context (greeting is never sent)
      const context = next
        .slice(-MAX_HISTORY)
        .filter(m => !m.seed)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await api.post<{ reply: string }>('/ai/chat', { messages: context });
      setMessages(curr => [...curr, { role: 'assistant', content: res.reply, ts: Date.now() }]);
    } catch (e: any) {
      setError(e?.message || 'Sorry, I had trouble responding. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setMessages([makeGreeting()]);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, scale: 0.6, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 24 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-[60] group"
            aria-label="Open Numa AI Assistant"
          >
            <span
              className="absolute inset-0 rounded-full opacity-50 blur-md group-hover:opacity-75 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #1B4D3E 0%, #D4AF37 100%)' }}
            />
            <span
              className="relative flex items-center justify-center w-14 h-14 rounded-full shadow-xl border-2 border-white/30"
              style={{ background: 'linear-gradient(135deg, #0D3327 0%, #1B4D3E 50%, #D4AF37 110%)' }}
            >
              <MessageCircle className="w-6 h-6 text-white" />
              <motion.span
                animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full border-2 border-[#D4AF37]"
              />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D4AF37] border-2 border-white flex items-center justify-center">
                <Sparkles className="w-2 h-2 text-white" />
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed bottom-5 right-5 z-[60] w-[calc(100vw-2.5rem)] sm:w-[400px] max-h-[calc(100vh-2.5rem)] sm:max-h-[640px] flex flex-col bg-white border border-border/40 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div
              className="px-5 py-4 flex items-center justify-between text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #0D3327 0%, #1B4D3E 60%, #2A6B52 100%)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 border-2 border-[#D4AF37]/40 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div>
                  <div className="font-serif font-bold text-base leading-tight">Ask Numa</div>
                  <div className="text-[11px] text-white/70 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    AI Halal Assistant — online
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={reset}
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                  aria-label="New chat"
                  title="New chat"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-white" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#FAFAF7]">
              {messages.map((m, i) => (
                <motion.div
                  key={`${m.ts}-${i}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-primary text-white rounded-2xl rounded-br-md'
                        : 'bg-white border border-border/40 text-foreground rounded-2xl rounded-bl-md shadow-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                </motion.div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="bg-white border border-border/40 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1B4D3E] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1B4D3E] animate-bounce" style={{ animationDelay: '120ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1B4D3E] animate-bounce" style={{ animationDelay: '240ms' }} />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                  {error}
                </div>
              )}

              {/* Suggestions — only show if just the greeting */}
              {messages.length === 1 && !sending && (
                <div className="pt-2 space-y-2">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold px-1">Try asking</div>
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left px-3 py-2 text-xs rounded-xl border border-border/50 hover:border-primary hover:bg-primary/5 transition-colors text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={e => {
                e.preventDefault();
                send();
              }}
              className="border-t border-border/40 bg-white px-3 py-3 flex items-center gap-2 shrink-0"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask anything halal-related…"
                disabled={sending}
                maxLength={2000}
                className="flex-1 px-3.5 py-2.5 text-sm bg-muted/50 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                style={{ background: 'linear-gradient(135deg, #1B4D3E 0%, #0D3327 100%)' }}
                aria-label="Send"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>

            <div className="px-4 pb-2 text-[10px] text-muted-foreground text-center">
              AI responses are advisory — verify store info on each store page.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
