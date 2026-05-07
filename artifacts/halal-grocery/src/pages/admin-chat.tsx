/* CHAT_REMOVED
 * This page is intentionally disabled. The live chat feature has been
 * removed from all portals. The database schema is preserved for data
 * retention. Remove this file when no longer needed.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare, Send, Search, RefreshCw, ShieldCheck, Plus, X,
  Mail, User as UserIcon, Store as StoreIcon, ShoppingBag,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { connectForRole } from '@/lib/socket';
import { formatDistanceToNow } from 'date-fns';

function formatTime(dateStr?: string) {
  if (!dateStr) return '';
  try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true }); } catch { return ''; }
}

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

interface UserDir {
  id: string; firstName: string; lastName: string; email: string; role: string;
}

/* ── New Message Dialog ─────────────────────────────────────────────── */
function NewMessageDialog({ onClose, onStart }: { onClose: () => void; onStart: (userId: string) => void }) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const { data: users = [], isLoading } = useQuery<UserDir[]>({
    queryKey: ['admin', 'direct-chat', 'users', search, roleFilter],
    queryFn: () => api.get<UserDir[]>(`/direct-chat/admin/users?search=${encodeURIComponent(search)}${roleFilter ? `&role=${roleFilter}` : ''}`),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border/50 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div>
            <h3 className="font-semibold text-base">New Conversation</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Search a customer or store owner to message</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…" className="pl-9 rounded-xl text-sm" autoFocus />
          </div>
          <div className="flex gap-2">
            {[
              { v: '', l: 'All' },
              { v: 'CUSTOMER', l: 'Customers' },
              { v: 'STORE_OWNER', l: 'Store Owners' },
            ].map(r => (
              <button key={r.v} onClick={() => setRoleFilter(r.v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium ${roleFilter === r.v ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                {r.l}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto border-t border-border/30">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
          ) : users.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No users found</div>
          ) : users.map(u => (
            <button key={u.id} onClick={() => onStart(u.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/20">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                {u.role === 'STORE_OWNER' ? <StoreIcon className="w-4 h-4 text-muted-foreground" /> : <UserIcon className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{u.firstName} {u.lastName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{u.email} · {u.role.replace('_', ' ').toLowerCase()}</p>
              </div>
              <Send className="w-3.5 h-3.5 text-primary" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Direct Chat Panel ──────────────────────────────────────────────── */
function DirectChatPanel() {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [showNew, setShowNew] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: conversations = [], isLoading: convLoading } = useQuery<DirectConv[]>({
    queryKey: ['admin', 'direct-chat', 'convs'],
    queryFn: () => api.get<DirectConv[]>('/direct-chat/conversations'),
    refetchInterval: 20_000,
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<DirectMsg[]>({
    queryKey: ['admin', 'direct-chat', 'messages', selectedConvId],
    queryFn: () => selectedConvId ? api.get<DirectMsg[]>(`/direct-chat/conversations/${selectedConvId}/messages`) : Promise.resolve([]),
    enabled: !!selectedConvId,
  });

  // Live updates via socket
  useEffect(() => {
    const handle = connectForRole('ADMIN');
    if (!handle) return;
    const onInbox = () => qc.invalidateQueries({ queryKey: ['admin', 'direct-chat', 'convs'] });
    const onMsg = (msg: DirectMsg) => {
      if (msg.conversationId === selectedConvId) {
        qc.setQueryData<DirectMsg[]>(['admin', 'direct-chat', 'messages', selectedConvId], (prev = []) => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
      qc.invalidateQueries({ queryKey: ['admin', 'direct-chat', 'convs'] });
    };
    handle.socket.on('direct_message_inbox', onInbox);
    handle.socket.on('new_direct_message', onMsg);
    if (selectedConvId) handle.socket.emit('join_conversation', selectedConvId);
    return () => {
      handle.socket.off('direct_message_inbox', onInbox);
      handle.socket.off('new_direct_message', onMsg);
      handle.release();
    };
  }, [selectedConvId, qc]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => api.post<DirectMsg>(`/direct-chat/conversations/${selectedConvId}/messages`, { content }),
    onSuccess: (msg) => {
      setMessage('');
      // Optimistic-style: append immediately so admin sees their own message even before socket round-trip
      qc.setQueryData<DirectMsg[]>(['admin', 'direct-chat', 'messages', selectedConvId], (prev = []) => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      qc.invalidateQueries({ queryKey: ['admin', 'direct-chat', 'convs'] });
    },
    onError: (e: any) => toast({ title: 'Failed to send', description: e.message, variant: 'destructive' }),
  });

  const startMutation = useMutation({
    mutationFn: (recipientUserId: string) => api.post<{ id: string }>('/direct-chat/start', { recipientUserId }),
    onSuccess: (conv) => {
      setShowNew(false);
      qc.invalidateQueries({ queryKey: ['admin', 'direct-chat', 'convs'] });
      setSelectedConvId(conv.id);
    },
    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = () => {
    if (!message.trim() || !selectedConvId) return;
    sendMutation.mutate(message.trim());
  };

  const filtered = useMemo(() => conversations.filter(c =>
    !search || c.counterpartyName?.toLowerCase().includes(search.toLowerCase()) ||
    c.counterpartyEmail?.toLowerCase().includes(search.toLowerCase()) ||
    c.lastMessageText?.toLowerCase().includes(search.toLowerCase())
  ), [conversations, search]);

  const selectedConv = conversations.find(c => c.id === selectedConvId);

  return (
    <>
      <div className="flex h-[calc(100vh-200px)] min-h-[500px] bg-card rounded-2xl border border-border/60 overflow-hidden">
        {/* Sidebar */}
        <div className="w-72 border-r border-border/50 flex flex-col">
          <div className="p-4 border-b border-border/50 space-y-3">
            <Button size="sm" onClick={() => setShowNew(true)}
              className="w-full hg-gradient-primary border-0 text-white rounded-xl gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" /> New Message
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search…" className="pl-9 rounded-xl text-sm h-9" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {convLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3 border-b border-border/30">
                  <div className="h-3 bg-muted rounded animate-pulse mb-2 w-3/4" />
                  <div className="h-2.5 bg-muted rounded animate-pulse w-1/2" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">
                <Mail className="w-6 h-6 mx-auto mb-2 opacity-30" />
                No direct messages yet.<br />Click "New Message" to start one.
              </div>
            ) : filtered.map(conv => (
              <button key={conv.id} onClick={() => setSelectedConvId(conv.id)}
                className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/20
                  ${selectedConvId === conv.id ? 'bg-primary/5 border-r-2 border-r-primary' : ''}`}>
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground mt-0.5">
                  {conv.counterpartyRole === 'STORE_OWNER' ? <StoreIcon className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-semibold text-xs truncate">{conv.counterpartyName}</p>
                    <span className="text-[9px] text-muted-foreground flex-shrink-0">{formatTime(conv.lastMessageAt)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{conv.lastMessageText || 'No messages yet'}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full mt-1 inline-block
                    ${conv.type === 'admin_customer' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                    {conv.type === 'admin_customer' ? 'customer' : 'store owner'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        {selectedConvId && selectedConv ? (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50 bg-muted/20">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
                {selectedConv.counterpartyRole === 'STORE_OWNER' ? <StoreIcon className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
              </div>
              <div>
                <p className="font-semibold text-sm">{selectedConv.counterpartyName}</p>
                <p className="text-xs text-muted-foreground">{selectedConv.counterpartyEmail}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => refetchMessages()} className="ml-auto rounded-xl text-xs h-8 gap-1.5">
                <RefreshCw className="w-3 h-3" /> Refresh
              </Button>
            </div>
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  No messages yet. Type below to send the first one.
                </div>
              ) : messages.map(msg => {
                const isMe = msg.senderRole === 'admin';
                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5
                      ${isMe ? 'hg-gradient-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                      {isMe ? <ShieldCheck className="w-4 h-4" /> : (selectedConv.counterpartyRole === 'STORE_OWNER' ? <StoreIcon className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />)}
                    </div>
                    <div className={`max-w-sm flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-2xl px-4 py-3 text-sm ${isMe ? 'bg-primary/10 rounded-tr-sm' : 'bg-muted/60 rounded-tl-sm'}`}>
                        {msg.content}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {isMe ? 'You' : selectedConv.counterpartyName} · {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="border-t border-border/50 px-4 py-3 flex items-center gap-3">
              <input value={message} onChange={e => setMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                type="text" placeholder="Type a reply… (Enter to send)"
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              <Button size="sm" onClick={handleSend} disabled={!message.trim() || sendMutation.isPending}
                className="hg-gradient-primary border-0 text-white rounded-xl h-10 w-10 p-0 flex items-center justify-center">
                {sendMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <Mail className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="font-semibold text-sm text-muted-foreground">Select a conversation</p>
              <p className="text-xs text-muted-foreground mt-1">Or click "New Message" to start one with any user</p>
            </div>
          </div>
        )}
      </div>
      {showNew && <NewMessageDialog onClose={() => setShowNew(false)} onStart={(userId) => startMutation.mutate(userId)} />}
    </>
  );
}

/* ── Order Chat Panel (existing behavior, preserved) ────────────────── */
function OrderChatPanel() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: conversations = [], isLoading: convLoading, refetch: refetchConvos } = useQuery<any[]>({
    queryKey: ['admin', 'chat', 'conversations'],
    queryFn: () => api.get<any[]>('/chat/admin/conversations'),
    refetchInterval: 15_000,
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<any[]>({
    queryKey: ['admin', 'chat', 'messages', selectedOrderId],
    queryFn: () => selectedOrderId ? api.get<any[]>(`/chat/${selectedOrderId}/messages`) : Promise.resolve([]),
    enabled: !!selectedOrderId,
    refetchInterval: 8_000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => api.post<any>(`/chat/${selectedOrderId}/messages`, { content }),
    onSuccess: () => {
      setMessage('');
      qc.invalidateQueries({ queryKey: ['admin', 'chat', 'messages', selectedOrderId] });
      qc.invalidateQueries({ queryKey: ['admin', 'chat', 'conversations'] });
    },
    onError: (e: any) => toast({ title: 'Failed to send', description: e.message, variant: 'destructive' }),
  });

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = () => {
    if (!message.trim() || !selectedOrderId) return;
    sendMutation.mutate(message.trim());
  };

  const filtered = (conversations as any[]).filter((c: any) =>
    !search || c.orderId?.toLowerCase().includes(search.toLowerCase()) ||
    c.lastMessage?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[500px] bg-card rounded-2xl border border-border/60 overflow-hidden">
      <div className="w-72 border-r border-border/50 flex flex-col">
        <div className="p-4 border-b border-border/50 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="pl-9 rounded-xl text-sm h-9" />
          </div>
          <Button size="sm" variant="outline" className="w-full rounded-xl h-8 gap-1.5 text-xs" onClick={() => refetchConvos()}>
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-border/30">
                <div className="h-3 bg-muted rounded animate-pulse mb-2 w-3/4" />
                <div className="h-2.5 bg-muted rounded animate-pulse w-1/2" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              <ShoppingBag className="w-6 h-6 mx-auto mb-2 opacity-30" />
              No order chats yet
            </div>
          ) : filtered.map((conv: any) => (
            <button key={conv.orderId} onClick={() => setSelectedOrderId(conv.orderId)}
              className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/20
                ${selectedOrderId === conv.orderId ? 'bg-primary/5 border-r-2 border-r-primary' : ''}`}>
              <div className="w-8 h-8 rounded-full hg-gradient-primary flex items-center justify-center flex-shrink-0 text-white text-xs font-bold mt-0.5">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-xs truncate">Order #{conv.orderId?.slice(-8).toUpperCase()}</p>
                  {conv.lastAt && <span className="text-[9px] text-muted-foreground ml-1 flex-shrink-0">{formatTime(conv.lastAt)}</span>}
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{conv.lastMessage || 'No messages'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
      {selectedOrderId ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50 bg-muted/20">
            <div className="w-9 h-9 rounded-full hg-gradient-primary flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm">Order #{selectedOrderId.slice(-8).toUpperCase()}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Active chat
              </p>
            </div>
            <Button size="sm" variant="outline" className="ml-auto rounded-xl text-xs h-8 gap-1.5" onClick={() => refetchMessages()}>
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
          </div>
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No messages in this conversation yet</div>
            ) : messages.map((msg: any) => {
              const isAdmin = msg.senderRole === 'ADMIN';
              return (
                <div key={msg.id} className={`flex gap-3 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5
                    ${isAdmin ? 'hg-gradient-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    {isAdmin ? <ShieldCheck className="w-4 h-4" /> : (msg.senderName?.[0] || 'U')}
                  </div>
                  <div className={`max-w-sm flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                    <div className={`rounded-2xl px-4 py-3 text-sm ${isAdmin ? 'bg-primary/10 rounded-tr-sm' : 'bg-muted/60 rounded-tl-sm'}`}>
                      {msg.content}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{msg.senderName} · {formatTime(msg.createdAt)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="border-t border-border/50 px-4 py-3 flex items-center gap-3">
            <input value={message} onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              type="text" placeholder="Type a reply… (Enter to send)"
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <Button size="sm" onClick={handleSend} disabled={!message.trim() || sendMutation.isPending}
              className="hg-gradient-primary border-0 text-white rounded-xl h-10 w-10 p-0 flex items-center justify-center">
              {sendMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="font-semibold text-sm text-muted-foreground">Select an order chat</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function AdminChatPage() {
  const [tab, setTab] = useState<'direct' | 'orders'>('direct');

  return (
    <AdminLayout title="Live Chat" subtitle="Direct messages and order conversations">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex bg-muted/50 rounded-xl p-1 gap-1">
          {([
            { k: 'direct', l: 'Direct Messages', icon: Mail },
            { k: 'orders', l: 'Order Chats', icon: ShoppingBag },
          ] as const).map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${tab === t.k ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.l}
            </button>
          ))}
        </div>
      </div>
      {tab === 'direct' ? <DirectChatPanel /> : <OrderChatPanel />}
    </AdminLayout>
  );
}
