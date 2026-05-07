import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Users, RefreshCw, ChevronLeft, ChevronRight, X,
  CheckCircle, XCircle, Shield, User, Mail, Phone, ShoppingBag,
  Star, AlertTriangle, Download,
} from 'lucide-react';
import { api } from '@/lib/api';

type RoleFilter = '_all' | 'CUSTOMER' | 'STORE_OWNER' | 'STORE_STAFF' | 'ADMIN';

const ROLE_TABS: { key: RoleFilter; label: string }[] = [
  { key: '_all', label: 'All Users' },
  { key: 'CUSTOMER', label: 'Customers' },
  { key: 'STORE_OWNER', label: 'Store Owners' },
  { key: 'STORE_STAFF', label: 'Staff' },
  { key: 'ADMIN', label: 'Admins' },
];

const ROLE_BADGE: Record<string, string> = {
  CUSTOMER: 'bg-blue-100 text-blue-800',
  STORE_OWNER: 'bg-violet-100 text-violet-800',
  STORE_STAFF: 'bg-teal-100 text-teal-800',
  ADMIN: 'bg-slate-100 text-slate-800',
};

interface UserRow {
  id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; isVerified: boolean;
  loyaltyPoints: number; createdAt: string; phone: string; orderCount: number;
}

export default function AdminUsers() {
  const [role, setRole] = useState<RoleFilter>('_all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [roleModal, setRoleModal] = useState(false);
  const [newRole, setNewRole] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ role, page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const data = await api.get(`/admin/users?${params}`);
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {}
    setLoading(false);
  }, [role, page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [role, search]);

  const doSuspend = async (userId: string, suspend: boolean) => {
    setActionLoading('suspend' + userId);
    try {
      await api.patch(`/admin/users/${userId}/suspend`, { suspend });
      if (selected?.id === userId) setSelected(prev => prev ? { ...prev, isActive: !suspend } : null);
      await load();
    } catch {}
    setActionLoading(null);
  };

  const doRoleChange = async () => {
    if (!selected || !newRole) return;
    setActionLoading('role');
    try {
      await api.patch(`/admin/users/${selected.id}/role`, { role: newRole });
      setRoleModal(false);
      setSelected(prev => prev ? { ...prev, role: newRole } : null);
      await load();
    } catch {}
    setActionLoading(null);
  };

  return (
    <AdminLayout title="Users" subtitle={`${total} registered accounts`}>
      <div className="p-4 lg:p-6 space-y-4">
        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex bg-muted/50 rounded-xl p-1 gap-1 flex-wrap">
            {ROLE_TABS.map(tab => (
              <button key={tab.key} onClick={() => setRole(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${role === tab.key ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or email…" className="pl-8 h-9 text-sm rounded-xl w-52" />
            </div>
            <Button variant="outline" size="sm" onClick={load} className="rounded-xl h-9"><RefreshCw className="w-3.5 h-3.5" /></Button>
            <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5 text-xs" onClick={() => {
              if (!users.length) return;
              const rows = [
                ['Name', 'Email', 'Phone', 'Role', 'Orders', 'Status', 'Verified', 'Joined'],
                ...users.map(u => [
                  `${u.firstName} ${u.lastName}`, u.email, u.phone || '',
                  u.role, u.orderCount, u.isActive ? 'Active' : 'Suspended',
                  u.isVerified ? 'Yes' : 'No', new Date(u.createdAt).toLocaleDateString(),
                ]),
              ];
              const csv = rows.map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
              a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
            }}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Table */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-xl border border-border/50 overflow-hidden">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 border-b border-border/50 bg-muted/30 grid grid-cols-[1fr_auto_auto_auto] gap-3">
                <span>User</span><span>Role</span><span>Orders</span><span>Status</span>
              </div>
              {loading ? (
                Array(8).fill(0).map((_, i) => <div key={i} className="h-14 border-b border-border/30 animate-pulse bg-muted/10" />)
              ) : users.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No users found</p>
                </div>
              ) : users.map(user => (
                <div key={user.id} onClick={() => setSelected(user)}
                  className={`grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 border-b border-border/30 cursor-pointer hover:bg-muted/30 transition-colors ${selected?.id === user.id ? 'bg-primary/5' : ''}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate">{user.firstName} {user.lastName}</span>
                      {!user.isVerified && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                    <p className="text-[10px] text-muted-foreground/60">{new Date(user.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${ROLE_BADGE[user.role] ?? 'bg-muted'}`}>
                    {user.role?.replace('_', ' ')}
                  </span>
                  <span className="text-xs font-medium text-center">{user.orderCount}</span>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center ${user.isActive ? 'bg-green-100' : 'bg-red-100'}`}>
                    {user.isActive ? <CheckCircle className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                  </span>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-3">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-xl h-8 px-3">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-xl h-8 px-3">
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Detail Panel */}
          <div>
            <AnimatePresence>
              {selected ? (
                <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="bg-white rounded-xl border border-border/50 overflow-hidden sticky top-4">
                  <div className="flex items-start justify-between gap-2 px-4 py-3 bg-slate-900 text-white">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                        {selected.firstName[0]}{selected.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{selected.firstName} {selected.lastName}</p>
                        <p className="text-white/60 text-[11px]">{selected.role}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-white/50 hover:text-white mt-0.5">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Info */}
                    <div className="space-y-2">
                      {[
                        { icon: Mail, label: selected.email },
                        { icon: Phone, label: selected.phone || 'No phone' },
                        { icon: ShoppingBag, label: `${selected.orderCount} orders placed` },
                        { icon: Star, label: `${selected.loyaltyPoints} loyalty points` },
                      ].map(({ icon: Icon, label }) => (
                        <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Icon className="w-3.5 h-3.5 shrink-0" /><span className="break-all">{label}</span>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className={`rounded-lg p-2.5 text-center ${selected.isActive ? 'bg-green-50' : 'bg-red-50'}`}>
                        <p className={`text-xs font-semibold ${selected.isActive ? 'text-green-700' : 'text-red-700'}`}>
                          {selected.isActive ? 'Active' : 'Suspended'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Account</p>
                      </div>
                      <div className={`rounded-lg p-2.5 text-center ${selected.isVerified ? 'bg-blue-50' : 'bg-amber-50'}`}>
                        <p className={`text-xs font-semibold ${selected.isVerified ? 'text-blue-700' : 'text-amber-700'}`}>
                          {selected.isVerified ? 'Verified' : 'Unverified'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Email</p>
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground">Joined {new Date(selected.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

                    {/* Actions */}
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <Button size="sm" variant="outline" onClick={() => { setNewRole(selected.role); setRoleModal(true); }}
                        className="w-full rounded-xl h-8 text-xs gap-1.5">
                        <Shield className="w-3 h-3" /> Change Role
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => doSuspend(selected.id, selected.isActive)} disabled={!!actionLoading}
                        className={`w-full rounded-xl h-8 text-xs gap-1.5 ${selected.isActive ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                        {selected.isActive ? <><XCircle className="w-3 h-3" /> Suspend Account</> : <><CheckCircle className="w-3 h-3" /> Reactivate Account</>}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-white rounded-xl border border-dashed border-border/50 p-8 text-center text-muted-foreground text-sm">
                  <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Click a user to view details</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Role Change Modal */}
      <AnimatePresence>
        {roleModal && selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-xs mx-4 p-6">
              <h3 className="font-serif font-bold text-lg mb-1">Change Role</h3>
              <p className="text-sm text-muted-foreground mb-4">{selected.firstName} {selected.lastName}</p>
              <div className="space-y-2 mb-4">
                {['CUSTOMER', 'STORE_OWNER', 'STORE_STAFF', 'ADMIN'].map(r => (
                  <button key={r} onClick={() => setNewRole(r)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm border transition-all ${newRole === r ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border hover:bg-muted/30'}`}>
                    {r.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setRoleModal(false)} className="flex-1 rounded-xl">Cancel</Button>
                <Button onClick={doRoleChange} disabled={newRole === selected.role || !!actionLoading} className="flex-1 rounded-xl hg-gradient-primary">Save</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
