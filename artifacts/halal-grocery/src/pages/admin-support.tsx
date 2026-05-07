import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Send, CheckCircle, Clock, AlertTriangle, X, RefreshCw, User } from 'lucide-react';
import { api } from '@/lib/api';

type TicketStatus = '_all' | 'open' | 'in_progress' | 'resolved';

const STATUS_TABS: { key: TicketStatus; label: string }[] = [
  { key: '_all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-green-100 text-green-800',
};

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  resolved: 'bg-green-100 text-green-800',
};

interface Reply { from: string; message: string; time: string }
interface Ticket {
  id: string; subject: string; status: string; priority: string; category: string;
  customerName: string; email: string; orderId: string | null; message: string;
  createdAt: string; replies: Reply[];
}

export default function AdminSupport() {
  const [filterStatus, setFilterStatus] = useState<TicketStatus>('_all');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/admin/support/tickets?status=${filterStatus}`);
      setTickets(data.tickets ?? []);
      setTotal(data.total ?? 0);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterStatus]);

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const data = await api.post(`/admin/support/tickets/${selected.id}/reply`, { message: reply });
      setSelected(data.ticket);
      setTickets(prev => prev.map(t => t.id === selected.id ? data.ticket : t));
      setReply('');
    } catch {}
    setSending(false);
  };

  const resolve = async (ticketId: string) => {
    try {
      const data = await api.patch(`/admin/support/tickets/${ticketId}/resolve`, {});
      setTickets(prev => prev.map(t => t.id === ticketId ? data.ticket : t));
      if (selected?.id === ticketId) setSelected(data.ticket);
    } catch {}
  };

  return (
    <AdminLayout title="Support" subtitle={`${total} tickets`}>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-3">
          <div className="flex bg-muted/50 rounded-xl p-1 gap-1">
            {STATUS_TABS.map(tab => (
              <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === tab.key ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} className="rounded-xl h-9 ml-auto"><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Ticket list */}
          <div className="lg:col-span-2 space-y-2">
            {loading ? Array(4).fill(0).map((_, i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)
              : tickets.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No tickets found</p>
                </div>
              ) : tickets.map(ticket => (
                <div key={ticket.id} onClick={() => setSelected(ticket)}
                  className={`bg-white rounded-xl border p-3.5 cursor-pointer hover:shadow-md transition-all ${selected?.id === ticket.id ? 'ring-2 ring-primary border-transparent' : 'border-border/50'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${PRIORITY_BADGE[ticket.priority] ?? 'bg-muted'}`}>{ticket.priority}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${STATUS_BADGE[ticket.status] ?? 'bg-muted'}`}>{ticket.status.replace('_', ' ')}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs font-semibold leading-snug mb-0.5">{ticket.subject}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{ticket.customerName} · {ticket.category.replace('_', ' ')}</p>
                  {ticket.replies.length > 0 && <p className="text-[10px] text-muted-foreground/60 mt-1">{ticket.replies.length} {ticket.replies.length === 1 ? 'reply' : 'replies'}</p>}
                </div>
              ))}
          </div>

          {/* Conversation */}
          <div className="lg:col-span-3">
            <AnimatePresence>
              {selected ? (
                <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="bg-white rounded-xl border border-border/50 flex flex-col h-full" style={{ minHeight: '500px', maxHeight: 'calc(100vh - 200px)' }}>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-border/50">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${PRIORITY_BADGE[selected.priority]}`}>{selected.priority}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${STATUS_BADGE[selected.status]}`}>{selected.status.replace('_', ' ')}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">{selected.category.replace('_', ' ')}</span>
                      </div>
                      <p className="font-semibold text-sm">{selected.subject}</p>
                      <p className="text-xs text-muted-foreground">{selected.customerName} · {selected.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {selected.status !== 'resolved' && (
                        <Button size="sm" variant="outline" onClick={() => resolve(selected.id)}
                          className="rounded-xl h-7 text-xs gap-1 border-green-200 text-green-700 hover:bg-green-50">
                          <CheckCircle className="w-3 h-3" /> Resolve
                        </Button>
                      )}
                      <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                    {/* Original message */}
                    <div className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="bg-muted/30 rounded-xl rounded-tl-sm p-3">
                          <p className="text-xs leading-relaxed">{selected.message}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{new Date(selected.createdAt).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Replies */}
                    {selected.replies.map((r, i) => (
                      <div key={i} className={`flex gap-2.5 ${r.from === 'admin' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${r.from === 'admin' ? 'bg-primary' : 'bg-blue-100'}`}>
                          {r.from === 'admin'
                            ? <span className="text-white text-[10px] font-bold">A</span>
                            : <User className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                        <div className={`flex-1 ${r.from === 'admin' ? 'items-end' : ''} flex flex-col`}>
                          <div className={`rounded-xl p-3 max-w-[85%] ${r.from === 'admin' ? 'bg-primary text-white rounded-tr-sm' : 'bg-muted/30 rounded-tl-sm'}`}>
                            <p className="text-xs leading-relaxed">{r.message}</p>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.time).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reply input */}
                  {selected.status !== 'resolved' && (
                    <div className="p-3 border-t border-border/50">
                      <div className="flex gap-2">
                        <Input
                          value={reply}
                          onChange={e => setReply(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
                          placeholder="Type a reply…"
                          className="rounded-xl text-sm flex-1"
                        />
                        <Button size="sm" onClick={sendReply} disabled={!reply.trim() || sending} className="rounded-xl h-9 px-3 hg-gradient-primary">
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {selected.status === 'resolved' && (
                    <div className="p-3 border-t border-border/50">
                      <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2">
                        <CheckCircle className="w-3.5 h-3.5" /> This ticket has been resolved
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="bg-white rounded-xl border border-dashed border-border/50 p-12 text-center text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium mb-1">Select a ticket</p>
                  <p className="text-xs">Click on a support ticket to view the conversation</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
