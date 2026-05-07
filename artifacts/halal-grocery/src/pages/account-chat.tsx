/* CHAT_REMOVED
 * This page is intentionally disabled. The live chat feature has been
 * removed from all portals. The database schema is preserved for data
 * retention. Remove this file when no longer needed.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare, Send, Clock, ChevronRight, RefreshCw, ArrowLeft, Package,
  Mail, ShoppingBag, ShieldCheck, Store as StoreIcon,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'wouter';
import { AccountSidebar } from '@/components/layout/AccountSidebar';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { connectForRole } from '@/lib/socket';
import { formatDistanceToNow } from 'date-fns';

function formatTime(dateStr?: string) {
  if (!dateStr) return '';
  try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true }); } catch { return ''; }
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending', STORE_CONFIRMED: 'Confirmed', IN_PREPARATION: 'Preparing',
  READY_FOR_PICKUP: 'Ready', OUT_FOR_DELIVERY: 'Delivering', COMPLETED: 'Delivered',
  CANCELLED: 'Cancelled',
};

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

/* ── Direct Messages Panel ──────────────────────────────────────────── */
function DirectMessagesPanel() {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: conversations = [], isLoading } = useQuery<DirectConv[]>({
    queryKey: ['account', 'direct-chat', 'convs'],
    queryFn: () => api.get<DirectConv[]>('/direct-chat/conversations'),
    refetchInterval: 20_000,
  });

  const { data: directMessages = [], refetch: refetchMessages } = useQuery<DirectMsg[]>({
    queryKey: ['account', 'direct-chat', 'messages', selectedConvId],
    queryFn: () => selectedConvId ? api.get<DirectMsg[]>(`/direct-chat/conversations/${selectedConvId}/messages`) : Promise.resolve([]),
    enabled: !!selectedConvId,
  });

  // Auto-select first conversation
  useEffect(() => {
    if (!selectedConvId && conversations.length > 0) setSelectedConvId(conversations[0].id);
  }, [conversations, selectedConvId]);

  // Live socket
  useEffect(() => {
    const handle = connectForRole('CUSTOMER');
    if (!handle) return;
    const onInbox = () => qc.invalidateQueries({ queryKey: ['account', 'direct-chat', 'convs'] });
    const onMsg = (msg: DirectMsg) => {
      if (msg.conversationId === selectedConvId) {
        qc.setQueryData<DirectMsg[]>(['account', 'direct-chat', 'messages', selectedConvId], (prev = []) => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
      qc.invalidateQueries({ queryKey: ['account', 'direct-chat', 'convs'] });
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
      qc.setQueryData<DirectMsg[]>(['account', 'direct-chat', 'messages', selectedConvId], (prev = []) => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      qc.invalidateQueries({ queryKey: ['account', 'direct-chat', 'convs'] });
    },
    onError: (e: any) => toast({ title: 'Failed to send', description: e.message, variant: 'destructive' }),
  });

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [directMessages]);

  const handleSend = () => {
    if (!message.trim() || !selectedConvId) return;
    sendMutation.mutate(message.trim());
  };

  const selectedConv = conversations.find(c => c.id === selectedConvId);

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
        <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading messages…</p>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center">
        <Mail className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
        <p className="font-medium text-sm text-muted-foreground">No direct messages yet</p>
        <p className="text-xs text-muted-foreground mt-1">Visit a store page to start a conversation</p>
      </div>
    );
  }

  const handleSelectConv = (id: string) => {
    setSelectedConvId(id);
    setMobileView('chat');
  };

  return (
    <div className="flex h-[calc(100vh-240px)] min-h-[480px] bg-card rounded-2xl border border-border/60 overflow-hidden">
      {/* Conv list — hidden on mobile when chat is open */}
      <div className={`${mobileView === 'chat' ? 'hidden md:flex' : 'flex'} md:flex w-full md:w-60 border-r border-border/50 flex-col flex-shrink-0`}>
        <div className="px-3 py-3 border-b border-border/50">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border/30">
          {conversations.map(conv => {
            const isAdmin = conv.type === 'admin_customer';
            return (
              <button key={conv.id} onClick={() => handleSelectConv(conv.id)}
                className={`w-full text-left px-3 py-3 hover:bg-muted/40 transition-colors ${selectedConvId === conv.id ? 'bg-primary/5 border-l-2 border-primary' : ''}`}>
                <div className="flex items-start gap-2.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${isAdmin ? 'hg-gradient-primary' : 'bg-blue-500'}`}>
                    {isAdmin ? <ShieldCheck className="w-4 h-4" /> : <StoreIcon className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-semibold truncate">{conv.counterpartyName}</p>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatTime(conv.lastMessageAt)}</span>
                    </div>
                    <p className="text-xs text-primary/70 mb-0.5">{isAdmin ? 'Numa Fresh Support' : 'Store'}</p>
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessageText || 'No messages yet'}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat — full screen on mobile when open */}
      {selectedConv ? (
        <div className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex'} md:flex flex-1 flex-col min-w-0`}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-muted/20">
            {/* Mobile back button */}
            <button
              className="md:hidden p-1.5 rounded-lg hover:bg-muted transition-colors mr-1"
              onClick={() => setMobileView('list')}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0 ${selectedConv.type === 'admin_customer' ? 'hg-gradient-primary' : 'bg-blue-500'}`}>
              {selectedConv.type === 'admin_customer' ? <ShieldCheck className="w-4 h-4" /> : <StoreIcon className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{selectedConv.counterpartyName}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                {selectedConv.type === 'admin_customer' ? 'Numa Fresh Support' : 'Store'}
              </p>
            </div>
            <Button size="sm" variant="outline" className="rounded-xl text-xs h-8 w-8 p-0" onClick={() => refetchMessages()}>
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {directMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No messages yet — say hi!</div>
            ) : directMessages.map(msg => {
              const isMe = msg.senderRole === 'customer';
              const otherIsAdmin = msg.senderRole === 'admin';
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold mt-0.5
                    ${isMe ? 'bg-secondary text-secondary-foreground' : (otherIsAdmin ? 'hg-gradient-primary' : 'bg-blue-500')}`}>
                    {isMe ? (user?.firstName?.[0] || 'U') : (otherIsAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <StoreIcon className="w-3.5 h-3.5" />)}
                  </div>
                  <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`rounded-2xl px-3 py-2.5 text-sm ${isMe ? 'bg-primary/10 rounded-tr-sm' : 'bg-muted/60 rounded-tl-sm'}`}>
                      {msg.content}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {isMe ? 'You' : selectedConv.counterpartyName} · {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="border-t border-border/50 px-3 py-3 flex items-center gap-2">
            <input
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              type="text"
              placeholder="Type a message…"
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <Button size="sm" onClick={handleSend} disabled={!message.trim() || sendMutation.isPending}
              className="hg-gradient-primary border-0 text-white rounded-xl h-10 w-10 p-0 flex items-center justify-center flex-shrink-0">
              {sendMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-xs text-muted-foreground">Select a conversation</div>
      )}
    </div>
  );
}

/* ── Order Chats Panel (existing behavior, preserved) ───────────────── */
function OrderChatsPanel() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['account', 'orders'],
    queryFn: () => api.get<any>('/orders?limit=20'),
    enabled: !!user,
  });
  const orders: any[] = ordersData?.orders || [];

  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['account', 'chat', 'messages', selectedOrderId],
    queryFn: () => selectedOrderId ? api.get<any[]>(`/chat/${selectedOrderId}/messages`) : Promise.resolve([]),
    enabled: !!selectedOrderId,
    refetchInterval: 10_000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => api.post<any>(`/chat/${selectedOrderId}/messages`, { content }),
    onSuccess: () => {
      setMessage('');
      qc.invalidateQueries({ queryKey: ['account', 'chat', 'messages', selectedOrderId] });
    },
    onError: (e: any) => toast({ title: 'Failed to send', description: e.message, variant: 'destructive' }),
  });

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages]);

  const handleSend = () => {
    if (!message.trim() || !selectedOrderId) return;
    sendMutation.mutate(message.trim());
  };

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  if (!selectedOrderId) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="font-serif font-bold text-lg mb-1">Order Conversations</h2>
          <p className="text-sm text-muted-foreground">Select an order to chat about it.</p>
        </div>
        {ordersLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-card rounded-2xl border border-border/50 animate-pulse" />
          ))
        ) : orders.length === 0 ? (
          <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center">
            <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="font-medium text-sm text-muted-foreground">No orders yet</p>
            <p className="text-xs text-muted-foreground mt-1">Place your first order to chat about it</p>
            <Link href="/shop">
              <Button className="mt-4 hg-gradient-primary border-0 text-white rounded-xl">Shop Now</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order: any) => (
              <button key={order.id} onClick={() => setSelectedOrderId(order.id)}
                className="w-full bg-card rounded-2xl border border-border/50 hover:border-primary/40 transition-colors p-4 flex items-center gap-4 text-left">
                <div className="w-10 h-10 rounded-xl hg-gradient-primary flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">Order #{order.orderNumber}</p>
                    <span className="text-xs text-muted-foreground">{formatTime(order.createdAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {STATUS_LABELS[order.status] || order.status} · ${Number(order.finalTotal || order.estimatedTotal || 0).toFixed(2)}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-260px)] min-h-[480px] bg-card rounded-2xl border border-border/60 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50 bg-muted/20">
        <button onClick={() => setSelectedOrderId(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="w-9 h-9 rounded-xl hg-gradient-primary flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Order #{selectedOrder?.orderNumber}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Numa Fresh Support
          </p>
        </div>
        <Button size="sm" variant="outline" className="rounded-xl text-xs h-8 gap-1" onClick={() => refetchMessages()}>
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
      <div className="flex-1 p-5 overflow-y-auto space-y-4">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full hg-gradient-primary flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-xs font-bold">NF</span>
          </div>
          <div className="max-w-xs lg:max-w-sm">
            <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3">
              <p className="text-sm">Assalam u Alaikum! 👋 How can we help you with order #{selectedOrder?.orderNumber}?</p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Support Team</p>
          </div>
        </div>
        {(messages as any[]).map((msg: any) => {
          const isMe = msg.senderRole === 'CUSTOMER';
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5
                ${isMe ? 'bg-secondary text-secondary-foreground' : 'hg-gradient-primary text-white'}`}>
                {isMe ? (user?.firstName?.[0] || 'U') : 'NF'}
              </div>
              <div className={`max-w-xs lg:max-w-sm flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm ${isMe ? 'bg-primary/10 rounded-tr-sm' : 'bg-muted/60 rounded-tl-sm'}`}>
                  {msg.content}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {isMe ? 'You' : msg.senderName} · {formatTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        {(messages as any[]).length === 0 && (
          <div className="flex flex-wrap gap-2 pl-11 mt-2">
            {['Track my order', 'Report an issue', 'Product question', 'Change delivery slot'].map(q => (
              <button key={q} onClick={() => setMessage(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition-colors">{q}</button>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t border-border/50 px-4 py-3 flex items-center gap-3">
        <input value={message} onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          type="text" placeholder="Type your message… (Enter to send)"
          className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        <Button size="sm" onClick={handleSend} disabled={!message.trim() || sendMutation.isPending}
          className="hg-gradient-primary border-0 text-white rounded-xl h-10 w-10 p-0 flex items-center justify-center">
          {sendMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────── */
export default function AccountChatPage() {
  const [tab, setTab] = useState<'direct' | 'orders'>('direct');

  return (
    <>
      <Helmet>
        <title>Live Chat | Numa Fresh</title>
      </Helmet>
      <div className="min-h-screen py-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 md:gap-8">
            <AccountSidebar active="chat" />
            <div className="flex-1 min-w-0">
              <Link href="/account" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 md:hidden">
                <ArrowLeft className="w-4 h-4" /> Back to Account
              </Link>

              <div className="flex bg-muted/50 rounded-xl p-1 gap-1 mb-4 w-fit">
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

              {tab === 'direct' ? <DirectMessagesPanel /> : <OrderChatsPanel />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
