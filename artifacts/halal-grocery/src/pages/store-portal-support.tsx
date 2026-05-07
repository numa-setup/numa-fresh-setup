/* CHAT_REMOVED
 * This page is intentionally disabled. The live chat / support feature has
 * been removed from all portals. The database schema is preserved for data
 * retention. Remove this file when no longer needed.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Send, CheckCircle, Clock, AlertTriangle, X, Plus,
  User, Headphones, Ticket, ChevronDown, Circle, Paperclip, Phone,
  Mail, RefreshCw, Star, LifeBuoy, Zap, FileText, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { connectForRole } from '@/lib/socket';
import { formatDistanceToNow } from 'date-fns';

interface DirectConv {
  id: string;
  type: 'admin_customer' | 'admin_store' | 'store_customer';
  lastMessageAt: string;
  lastMessageText: string | null;
  counterpartyName: string;
  counterpartyEmail?: string;
  counterpartyRole?: string;
}
interface DirectMsg {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderRole: 'admin' | 'store_owner' | 'customer';
  content: string | null;
  createdAt: string;
}
interface CustomerDir { id: string; firstName: string; lastName: string; email: string }

function formatTimeAgo(d?: string) {
  if (!d) return '';
  try { return formatDistanceToNow(new Date(d), { addSuffix: true }); } catch { return ''; }
}

/* ── New Customer Chat Dialog ───────────────────────────────────────── */
function NewCustomerDialog({ onClose, onStart }: { onClose: () => void; onStart: (userId: string) => void }) {
  const [search, setSearch] = useState('');
  const { data: customers = [], isLoading } = useQuery<CustomerDir[]>({
    queryKey: ['portal', 'direct-chat', 'customers', search],
    queryFn: () => api.get<CustomerDir[]>(`/direct-chat/store/customers?search=${encodeURIComponent(search)}`),
  });
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border/50 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div>
            <h3 className="font-semibold text-base">Message a Customer</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Customers who have ordered from your store</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…" className="pl-9 rounded-xl text-sm" autoFocus />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto border-t border-border/30">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
          ) : customers.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No customers yet</div>
          ) : customers.map(c => (
            <button key={c.id} onClick={() => onStart(c.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/20">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{c.firstName} {c.lastName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{c.email}</p>
              </div>
              <Send className="w-3.5 h-3.5 text-primary" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Types ─────────────────────────────────────────────────────────── */
type TicketStatus = 'open' | 'in_progress' | 'resolved';
type TicketPriority = 'urgent' | 'high' | 'medium' | 'low';

interface ChatMsg { from: 'store' | 'support'; text: string; time: string }
interface TicketReply { from: 'store' | 'support'; message: string; time: string }
interface SupportTicket {
  id: string; subject: string; status: TicketStatus; priority: TicketPriority;
  category: string; message: string; createdAt: string; replies: TicketReply[];
}

/* ── Demo ticket data (unchanged for tickets tab) ────────────────────── */
const _DEMO_CHATS_REMOVED: any[] = [
  {
    id: 'c1', name: 'Numa Fresh Support', avatar: 'حل', status: 'online', role: 'Platform Support',
    lastMsg: 'Your payout has been processed and will arrive within 2 business days.',
    lastTime: '10:42 AM', unread: 1,
    messages: [
      { from: 'store', text: 'Hi, I have a question about my payout schedule. When will this week\'s payout be processed?', time: '10:30 AM' },
      { from: 'support', text: 'Hi! Thank you for reaching out. Your payout for this week is scheduled to process tonight at midnight EST.', time: '10:35 AM' },
      { from: 'support', text: 'Your payout has been processed and will arrive within 2 business days.', time: '10:42 AM' },
    ],
  },
  {
    id: 'c2', name: 'Ahmed Hassan', avatar: 'AH', status: 'online', role: 'Customer',
    lastMsg: 'Can I change my pickup time to 5pm instead?',
    lastTime: '9:15 AM', unread: 2,
    messages: [
      { from: 'store', text: 'Hello Ahmed, your order #1042 is confirmed and will be ready by 3pm.', time: '9:00 AM' },
      { from: 'support', text: 'Thank you! Can I change my pickup time to 5pm instead?', time: '9:12 AM' },
      { from: 'support', text: 'Also, can you add extra coriander if possible? JazakAllah khair 🙏', time: '9:15 AM' },
    ],
  },
  {
    id: 'c3', name: 'Fatima Al-Rashid', avatar: 'FR', status: 'away', role: 'Customer',
    lastMsg: 'The lamb I ordered yesterday was absolutely perfect, thank you!',
    lastTime: 'Yesterday', unread: 0,
    messages: [
      { from: 'support', text: 'The lamb I ordered yesterday was absolutely perfect, thank you!', time: 'Yesterday 6:30 PM' },
      { from: 'store', text: 'Alhamdulillah! So glad to hear that Fatima. We\'ll make sure your next order is just as great.', time: 'Yesterday 6:45 PM' },
    ],
  },
  {
    id: 'c4', name: 'Onboarding Team', avatar: 'OT', status: 'online', role: 'Numa Fresh Team',
    lastMsg: 'Your store profile is 90% complete. Just add your halal certificate to finish!',
    lastTime: 'Mon', unread: 0,
    messages: [
      { from: 'support', text: 'Welcome to Numa Fresh! Your store is now live. Here are a few tips to get your first orders quickly.', time: 'Mon 9:00 AM' },
      { from: 'support', text: 'Your store profile is 90% complete. Just add your halal certificate to finish!', time: 'Mon 9:05 AM' },
      { from: 'store', text: 'Thank you! I\'ll upload the certificate today.', time: 'Mon 11:30 AM' },
    ],
  },
];

const DEMO_TICKETS: SupportTicket[] = [
  {
    id: 't1', subject: 'Payout not received for last week', status: 'in_progress',
    priority: 'high', category: 'Payouts',
    message: 'I have not received my payout for the week of April 1–7. The dashboard shows it was processed but it has not arrived in my bank account yet.',
    createdAt: '2026-04-07T10:00:00Z',
    replies: [
      { from: 'support', message: 'Hi there! We\'ve escalated this to our finance team. Please expect a response within 24 hours.', time: '2026-04-07T14:00:00Z' },
      { from: 'store', message: 'Thank you! Please check bank account ending in 4821.', time: '2026-04-07T14:30:00Z' },
    ],
  },
  {
    id: 't2', subject: 'Product images not uploading correctly', status: 'open',
    priority: 'medium', category: 'Products',
    message: 'When I try to upload images for my lamb chops product, the upload gets stuck at 90% and then fails. I\'ve tried Chrome and Safari.',
    createdAt: '2026-04-06T08:30:00Z',
    replies: [],
  },
  {
    id: 't3', subject: 'Customer left incorrect review — order was different store', status: 'open',
    priority: 'urgent', category: 'Reviews',
    message: 'A customer left a 1-star review on my store but they mentioned a completely different store name in their review. This review needs to be removed.',
    createdAt: '2026-04-05T15:20:00Z',
    replies: [
      { from: 'support', message: 'We\'re looking into this right away. We take incorrect reviews very seriously.', time: '2026-04-05T16:00:00Z' },
    ],
  },
  {
    id: 't4', subject: 'Request to update store hours for Ramadan', status: 'resolved',
    priority: 'low', category: 'Store Settings',
    message: 'Can you update our store hours to reflect our extended Ramadan schedule? New hours: 10am–11pm daily.',
    createdAt: '2026-03-28T09:00:00Z',
    replies: [
      { from: 'support', message: 'Done! Your store hours have been updated to 10am–11pm for the Ramadan period.', time: '2026-03-28T10:00:00Z' },
    ],
  },
];

/* ── Style helpers ──────────────────────────────────────────────────── */
const PRIORITY_BADGE: Record<TicketPriority, string> = {
  urgent: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-green-100 text-green-800 border-green-200',
};
const STATUS_BADGE: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-800 border-blue-200',
  in_progress: 'bg-purple-100 text-purple-800 border-purple-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
};
const STATUS_ICON: Record<TicketStatus, React.ReactNode> = {
  open: <Circle className="w-3 h-3" />,
  in_progress: <Clock className="w-3 h-3" />,
  resolved: <CheckCircle className="w-3 h-3" />,
};
const STATUS_DOT: Record<'online' | 'away' | 'offline', string> = {
  online: 'bg-green-500', away: 'bg-amber-400', offline: 'bg-muted-foreground/30',
};

/* ── New Ticket Modal ───────────────────────────────────────────────── */
function NewTicketModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (t: SupportTicket) => void }) {
  const [form, setForm] = useState({ subject: '', category: 'Orders', priority: 'medium' as TicketPriority, message: '' });

  const handleSubmit = () => {
    if (!form.subject.trim() || !form.message.trim()) return;
    const ticket: SupportTicket = {
      id: `t${Date.now()}`, subject: form.subject, status: 'open',
      priority: form.priority, category: form.category,
      message: form.message, createdAt: new Date().toISOString(), replies: [],
    };
    onSubmit(ticket);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        className="bg-card rounded-2xl border border-border/50 w-full max-w-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div>
            <h3 className="font-semibold text-base">Open a Support Ticket</h3>
            <p className="text-xs text-muted-foreground mt-0.5">We typically respond within 2–4 hours</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Subject</label>
            <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Brief description of the issue" className="rounded-xl text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-border/50 rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:border-primary">
                {['Orders', 'Payouts', 'Products', 'Reviews', 'Store Settings', 'Technical', 'Other'].map(c =>
                  <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TicketPriority }))}
                className="w-full border border-border/50 rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:border-primary">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Message</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Describe your issue in detail..."
              rows={4}
              className="w-full border border-border/50 rounded-xl px-3 py-2.5 text-sm bg-background resize-none focus:outline-none focus:border-primary" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.subject.trim() || !form.message.trim()}
            className="rounded-xl hg-gradient-primary border-0 text-white gap-2">
            <Send className="w-3.5 h-3.5" /> Submit Ticket
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────── */
export default function StorePortalSupport() {
  const [tab, setTab] = useState<'chat' | 'tickets'>('chat');

  /* Direct-chat state (real backend) */
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [convSearch, setConvSearch] = useState('');
  const [newMsg, setNewMsg] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: conversations = [], isLoading: convLoading } = useQuery<DirectConv[]>({
    queryKey: ['portal', 'direct-chat', 'convs'],
    queryFn: () => api.get<DirectConv[]>('/direct-chat/conversations'),
    refetchInterval: 20_000,
  });
  const { data: directMessages = [], refetch: refetchDirect } = useQuery<DirectMsg[]>({
    queryKey: ['portal', 'direct-chat', 'messages', activeConvId],
    queryFn: () => activeConvId ? api.get<DirectMsg[]>(`/direct-chat/conversations/${activeConvId}/messages`) : Promise.resolve([]),
    enabled: !!activeConvId,
  });

  // Default-select the first conversation (admin welcome) once loaded
  useEffect(() => {
    if (!activeConvId && conversations.length > 0) setActiveConvId(conversations[0].id);
  }, [conversations, activeConvId]);

  // Live socket subscription
  useEffect(() => {
    const handle = connectForRole('STORE_OWNER');
    if (!handle) return;
    const onInbox = () => qc.invalidateQueries({ queryKey: ['portal', 'direct-chat', 'convs'] });
    const onMsg = (msg: DirectMsg) => {
      if (msg.conversationId === activeConvId) {
        qc.setQueryData<DirectMsg[]>(['portal', 'direct-chat', 'messages', activeConvId], (prev = []) => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
      qc.invalidateQueries({ queryKey: ['portal', 'direct-chat', 'convs'] });
    };
    handle.socket.on('direct_message_inbox', onInbox);
    handle.socket.on('new_direct_message', onMsg);
    if (activeConvId) handle.socket.emit('join_conversation', activeConvId);
    return () => {
      handle.socket.off('direct_message_inbox', onInbox);
      handle.socket.off('new_direct_message', onMsg);
      handle.release();
    };
  }, [activeConvId, qc]);

  const sendDirectMutation = useMutation({
    mutationFn: (content: string) => api.post<DirectMsg>(`/direct-chat/conversations/${activeConvId}/messages`, { content }),
    onSuccess: (msg) => {
      setNewMsg('');
      qc.setQueryData<DirectMsg[]>(['portal', 'direct-chat', 'messages', activeConvId], (prev = []) => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      qc.invalidateQueries({ queryKey: ['portal', 'direct-chat', 'convs'] });
    },
    onError: (e: any) => toast({ title: 'Failed to send', description: e.message, variant: 'destructive' }),
  });

  const startCustomerMutation = useMutation({
    mutationFn: (recipientUserId: string) => api.post<{ id: string }>('/direct-chat/start', { recipientUserId }),
    onSuccess: (conv) => {
      setShowNewCustomer(false);
      qc.invalidateQueries({ queryKey: ['portal', 'direct-chat', 'convs'] });
      setActiveConvId(conv.id);
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const filteredConvs = useMemo(() => conversations.filter(c =>
    !convSearch || c.counterpartyName?.toLowerCase().includes(convSearch.toLowerCase()) ||
    c.lastMessageText?.toLowerCase().includes(convSearch.toLowerCase())
  ), [conversations, convSearch]);

  const activeConv = conversations.find(c => c.id === activeConvId) || null;

  /* Ticket state */
  const [tickets, setTickets] = useState<SupportTicket[]>(DEMO_TICKETS);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketReply, setTicketReply] = useState('');
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TicketStatus | '_all'>('_all');

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [directMessages, activeConvId]);

  const sendChat = () => {
    if (!newMsg.trim() || !activeConvId) return;
    sendDirectMutation.mutate(newMsg.trim());
  };

  const sendTicketReply = () => {
    if (!selectedTicket || !ticketReply.trim()) return;
    const reply: TicketReply = { from: 'store', message: ticketReply.trim(), time: new Date().toISOString() };
    const updated = { ...selectedTicket, replies: [...selectedTicket.replies, reply] };
    setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updated : t));
    setSelectedTicket(updated);
    setTicketReply('');
  };

  const filteredTickets = filterStatus === '_all' ? tickets : tickets.filter(t => t.status === filterStatus);

  return (
    <PortalLayout title="Support & Live Chat">
      <div className="space-y-4 max-w-7xl mx-auto">
        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Open Tickets', value: tickets.filter(t => t.status === 'open').length, icon: Ticket, color: 'bg-blue-100 text-blue-600' },
            { label: 'In Progress', value: tickets.filter(t => t.status === 'in_progress').length, icon: Clock, color: 'bg-purple-100 text-purple-600' },
            { label: 'Resolved', value: tickets.filter(t => t.status === 'resolved').length, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
            { label: 'Conversations', value: conversations.length, icon: MessageSquare, color: 'bg-primary/10 text-primary' },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-2xl border border-border/50 p-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
              </div>
              <div className="text-2xl font-bold tabular-nums">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tab Switch */}
        <div className="flex items-center gap-3">
          <div className="flex bg-muted/50 rounded-xl p-1 gap-1">
            {([
              { key: 'chat', label: 'Live Chat', icon: MessageSquare },
              { key: 'tickets', label: 'Support Tickets', icon: Ticket },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'tickets' && (
            <Button onClick={() => setShowNewTicket(true)} size="sm"
              className="ml-auto rounded-xl hg-gradient-primary border-0 text-white gap-1.5">
              <Plus className="w-3.5 h-3.5" /> New Ticket
            </Button>
          )}
          {tab === 'chat' && (
            <Button onClick={() => setShowNewCustomer(true)} size="sm"
              className="ml-auto rounded-xl hg-gradient-primary border-0 text-white gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Message Customer
            </Button>
          )}
        </div>

        {/* ── LIVE CHAT TAB ── */}
        {tab === 'chat' && (
          <div className="bg-card border border-border/50 rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 340px)', minHeight: 480 }}>
            <div className="flex h-full">
              {/* Thread list */}
              <div className="w-64 shrink-0 border-r border-border/50 flex flex-col">
                <div className="px-3 py-3 border-b border-border/50 space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Conversations</p>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input value={convSearch} onChange={e => setConvSearch(e.target.value)} placeholder="Search…" className="pl-8 rounded-lg text-xs h-8" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-border/30">
                  {convLoading ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">Loading…</div>
                  ) : filteredConvs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      <Mail className="w-6 h-6 mx-auto mb-2 opacity-30" />
                      No messages yet
                    </div>
                  ) : filteredConvs.map(conv => {
                    const isAdmin = conv.type === 'admin_store';
                    return (
                      <button key={conv.id} onClick={() => setActiveConvId(conv.id)}
                        className={`w-full text-left px-3 py-3 hover:bg-muted/40 transition-colors ${activeConvId === conv.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}>
                        <div className="flex items-start gap-2.5">
                          <div className="relative shrink-0">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${isAdmin ? 'hg-gradient-primary' : 'bg-blue-500'}`}>
                              {isAdmin ? 'NF' : (conv.counterpartyName || '?').slice(0, 2).toUpperCase()}
                            </div>
                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${STATUS_DOT.online}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <p className="text-xs font-semibold truncate">{conv.counterpartyName}</p>
                              <span className="shrink-0 text-[9px] text-muted-foreground">{formatTimeAgo(conv.lastMessageAt)}</span>
                            </div>
                            <p className="text-[10px] text-primary/70 mb-0.5">{isAdmin ? 'Numa Fresh Support' : 'Customer'}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{conv.lastMessageText || 'No messages yet'}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Chat window */}
              <div className="flex-1 flex flex-col min-w-0">
                {!activeConv ? (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="font-semibold text-sm text-muted-foreground">Select a conversation</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card">
                      <div className="relative">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${activeConv.type === 'admin_store' ? 'hg-gradient-primary' : 'bg-blue-500'}`}>
                          {activeConv.type === 'admin_store' ? 'NF' : (activeConv.counterpartyName || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${STATUS_DOT.online}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{activeConv.counterpartyName}</p>
                        <p className="text-[10px] text-muted-foreground">{activeConv.type === 'admin_store' ? 'Numa Fresh Support' : (activeConv.counterpartyEmail || 'Customer')}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => refetchDirect()} className="rounded-xl h-8 w-8 p-0">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      <AnimatePresence initial={false}>
                        {directMessages.map((msg) => {
                          const isMe = msg.senderRole === 'store_owner';
                          return (
                            <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                              className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${isMe ? 'bg-blue-500 text-white' : (msg.senderRole === 'admin' ? 'hg-gradient-primary text-white' : 'bg-muted text-muted-foreground')}`}>
                                {isMe ? 'Me' : (msg.senderRole === 'admin' ? 'NF' : (activeConv.counterpartyName || '?').slice(0, 2).toUpperCase())}
                              </div>
                              <div className={`flex flex-col max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${isMe ? 'bg-blue-500 text-white rounded-tr-sm' : (msg.senderRole === 'admin' ? 'hg-gradient-primary text-white rounded-tl-sm' : 'bg-muted/50 text-foreground rounded-tl-sm')}`}>
                                  {msg.content}
                                </div>
                                <span className="text-[9px] text-muted-foreground mt-1">{formatTimeAgo(msg.createdAt)}</span>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                      <div ref={msgEndRef} />
                    </div>

                    <div className="p-3 border-t border-border/50">
                      <div className="flex gap-2 items-center">
                        <button className="p-2 text-muted-foreground hover:text-foreground transition-colors shrink-0">
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <Input
                          value={newMsg}
                          onChange={e => setNewMsg(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                          placeholder="Type a message…"
                          className="rounded-xl text-sm flex-1"
                        />
                        <Button size="sm" onClick={sendChat} disabled={!newMsg.trim() || sendDirectMutation.isPending}
                          className="rounded-xl h-9 px-3 hg-gradient-primary border-0 text-white shrink-0">
                          {sendDirectMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {showNewCustomer && <NewCustomerDialog onClose={() => setShowNewCustomer(false)} onStart={(uid) => startCustomerMutation.mutate(uid)} />}

        {/* ── TICKETS TAB ── */}
        {tab === 'tickets' && (
          <div>
            {/* Filter bar */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex bg-muted/50 rounded-xl p-1 gap-1">
                {(['_all', 'open', 'in_progress', 'resolved'] as const).map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === s ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    {s === '_all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Ticket list */}
              <div className="lg:col-span-2 space-y-2">
                {filteredTickets.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Ticket className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No tickets found</p>
                    <p className="text-xs mt-1">Open a new ticket to get help</p>
                  </div>
                ) : filteredTickets.map(ticket => (
                  <motion.div key={ticket.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    onClick={() => setSelectedTicket(ticket)}
                    className={`bg-card rounded-xl border p-3.5 cursor-pointer hover:shadow-md transition-all ${selectedTicket?.id === ticket.id ? 'ring-2 ring-primary border-transparent' : 'border-border/50'}`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${PRIORITY_BADGE[ticket.priority]}`}>
                          {ticket.priority}
                        </span>
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${STATUS_BADGE[ticket.status]}`}>
                          {STATUS_ICON[ticket.status]}
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs font-semibold leading-snug mb-0.5">{ticket.subject}</p>
                    <p className="text-[11px] text-muted-foreground">{ticket.category}</p>
                    {ticket.replies.length > 0 && (
                      <p className="text-[10px] text-primary/60 mt-1.5 flex items-center gap-1">
                        <MessageSquare className="w-2.5 h-2.5" />
                        {ticket.replies.length} {ticket.replies.length === 1 ? 'reply' : 'replies'}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Ticket conversation */}
              <div className="lg:col-span-3">
                <AnimatePresence>
                  {selectedTicket ? (
                    <motion.div key={selectedTicket.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="bg-card rounded-xl border border-border/50 flex flex-col"
                      style={{ minHeight: 480, maxHeight: 'calc(100vh - 360px)' }}>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-border/50">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${PRIORITY_BADGE[selectedTicket.priority]}`}>
                              {selectedTicket.priority}
                            </span>
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${STATUS_BADGE[selectedTicket.status]}`}>
                              {STATUS_ICON[selectedTicket.status]}
                              {selectedTicket.status.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{selectedTicket.category}</span>
                          </div>
                          <p className="font-semibold text-sm">{selectedTicket.subject}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Opened {new Date(selectedTicket.createdAt).toLocaleDateString()}</p>
                        </div>
                        <button onClick={() => setSelectedTicket(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Messages */}
                      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                        {/* Original */}
                        <div className="flex gap-2.5">
                          <div className="w-7 h-7 rounded-full hg-gradient-primary flex items-center justify-center text-white text-[10px] font-bold shrink-0">Me</div>
                          <div className="flex-1">
                            <div className="bg-muted/30 rounded-xl rounded-tl-sm p-3">
                              <p className="text-xs leading-relaxed">{selectedTicket.message}</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Replies */}
                        {selectedTicket.replies.map((r, i) => (
                          <div key={i} className={`flex gap-2.5 ${r.from === 'store' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${r.from === 'store' ? 'hg-gradient-primary text-white' : 'bg-blue-100 text-blue-700'}`}>
                              {r.from === 'store' ? 'Me' : 'NF'}
                            </div>
                            <div className={`flex-1 flex flex-col ${r.from === 'store' ? 'items-end' : ''}`}>
                              <div className={`rounded-xl p-3 max-w-[85%] text-xs leading-relaxed ${r.from === 'store' ? 'hg-gradient-primary text-white rounded-tr-sm' : 'bg-muted/30 rounded-tl-sm'}`}>
                                {r.message}
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.time).toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Reply */}
                      {selectedTicket.status !== 'resolved' ? (
                        <div className="p-3 border-t border-border/50">
                          <div className="flex gap-2">
                            <Input value={ticketReply} onChange={e => setTicketReply(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendTicketReply()}
                              placeholder="Write a reply to support…" className="rounded-xl text-sm flex-1" />
                            <Button size="sm" onClick={sendTicketReply} disabled={!ticketReply.trim()}
                              className="rounded-xl h-9 px-3 hg-gradient-primary border-0 text-white">
                              <Send className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 border-t border-border/50">
                          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-xl px-3 py-2.5">
                            <CheckCircle className="w-3.5 h-3.5 shrink-0" /> This ticket has been resolved
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <div className="bg-card rounded-xl border border-dashed border-border/50 p-12 text-center text-muted-foreground flex flex-col items-center justify-center" style={{ minHeight: 480 }}>
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <LifeBuoy className="w-8 h-8 text-primary" />
                      </div>
                      <p className="font-semibold text-foreground mb-1">Select a ticket</p>
                      <p className="text-xs max-w-[200px] leading-relaxed">Click any ticket to read the conversation and send replies</p>
                      <Button onClick={() => setShowNewTicket(true)} size="sm"
                        className="mt-5 rounded-xl hg-gradient-primary border-0 text-white gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> Open New Ticket
                      </Button>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      <AnimatePresence>
        {showNewTicket && (
          <NewTicketModal
            onClose={() => setShowNewTicket(false)}
            onSubmit={t => { setTickets(prev => [t, ...prev]); setSelectedTicket(t); setTab('tickets'); }}
          />
        )}
      </AnimatePresence>
    </PortalLayout>
  );
}
