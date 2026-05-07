import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Link, useLocation } from 'wouter';
import {
  User, MapPin, Bell, Package, ChevronRight,
  LogOut, Shield, Edit2, Phone, Mail, Check, X, Download, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useUpdateProfile } from '@/hooks/useUser';
import { toast } from 'sonner';
import { AccountSidebar } from '@/components/layout/AccountSidebar';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { getApiUrl } from '@/lib/api';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ACCOUNT_LINKS = [
  {
    href: '/account/addresses',
    icon: MapPin,
    label: 'Saved Addresses',
    desc: 'Manage delivery addresses',
    color: 'from-primary to-emerald-600',
    badge: null,
  },
  {
    href: '/account/notifications',
    icon: Bell,
    label: 'Notifications',
    desc: 'Email, push & SMS settings',
    color: 'from-violet-500 to-purple-600',
    badge: null,
  },
  {
    href: '/orders',
    icon: Package,
    label: 'My Orders',
    desc: 'Order history & tracking',
    color: 'from-slate-500 to-slate-700',
    badge: null,
  },
];

export default function AccountPage() {
  const { user, updateUser, logout } = useAuth();
  const updateProfile = useUpdateProfile();
  const [, setLocation] = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
  });
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [doNotSell, setDoNotSell] = useState(false);
  const [limitSensitiveData, setLimitSensitiveData] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    fetch(getApiUrl('/users/me/privacy-preferences'), {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : null).then(data => {
      if (data) { setDoNotSell(data.doNotSell); setLimitSensitiveData(data.limitSensitiveData); }
    }).catch(() => {});
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl hg-gradient-primary flex items-center justify-center mx-auto mb-4">
            <User className="w-7 h-7 text-white" />
          </div>
          <h2 className="font-serif font-bold text-2xl mb-2">Sign in to your account</h2>
          <p className="text-muted-foreground text-sm mb-4">Access orders, saved addresses, and more.</p>
          <div className="flex gap-2 justify-center">
            <Link href="/login"><Button className="hg-gradient-primary border-0 text-white">Sign In</Button></Link>
            <Link href="/signup"><Button variant="outline">Create Account</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    try {
      const updated = await updateProfile.mutateAsync(form);
      updateUser(updated);
      toast.success('Profile updated!');
      setEditing(false);
    } catch (err: any) {
      toast.error('Failed to update profile', { description: err.message });
    }
  };

  const handleCancel = () => {
    setForm({ firstName: user.firstName, lastName: user.lastName, phone: user.phone || '' });
    setEditing(false);
  };

  const handleLogout = async () => {
    logout();
    setLocation('/login');
    toast.success('Signed out successfully');
  };

  const handlePrivacyToggle = async (field: 'doNotSell' | 'limitSensitiveData', value: boolean) => {
    setPrivacyLoading(true);
    if (field === 'doNotSell') setDoNotSell(value);
    else setLimitSensitiveData(value);
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(getApiUrl('/users/me/privacy-preferences'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [field]: value }),
      });
      toast.success('Privacy preference updated');
    } catch {
      toast.error('Failed to update privacy preference');
    } finally {
      setPrivacyLoading(false);
    }
  };

  const handleDataExport = async () => {
    setExportLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(getApiUrl('/users/me/export'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `numa-fresh-data-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch {
      toast.error('Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(getApiUrl('/users/me'), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Account deleted. You will be signed out.');
      setTimeout(() => { logout(); setLocation('/'); }, 1500);
    } catch {
      toast.error('Failed to delete account');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirm(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>My Account | Numa Fresh</title>
        <meta name="description" content="Manage your Numa Fresh account, orders, loyalty points, and preferences." />
      </Helmet>

      <div className="min-h-screen py-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 md:gap-8">
            <AccountSidebar active="profile" />

            <div className="flex-1 min-w-0">
              {/* Profile Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-3xl border border-border/50 p-6 mb-6"
              >
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="text-xl font-bold hg-gradient-primary text-white">
                        {user.firstName[0]}{user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h1 className="font-serif font-bold text-xl">{user.firstName} {user.lastName}</h1>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  {!editing && (
                    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setEditing(true)}>
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </Button>
                  )}
                </div>

                {editing ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">First Name</Label>
                        <Input
                          className="mt-1"
                          value={form.firstName}
                          onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Last Name</Label>
                        <Input
                          className="mt-1"
                          value={form.lastName}
                          onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</Label>
                      <Input
                        className="mt-1"
                        value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+1 (416) 555-0000"
                      />
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
                      <Input className="mt-1 opacity-60" value={user.email} disabled />
                      <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                    </div>
                    <div className="flex gap-2">
                      <Button className="hg-gradient-primary border-0 text-white gap-1.5" onClick={handleSave} disabled={updateProfile.isPending} size="sm">
                        <Check className="w-3.5 h-3.5" />
                        {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCancel}>
                        <X className="w-3.5 h-3.5" /> Cancel
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="space-y-2">
                    {user.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{user.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="capitalize text-muted-foreground">{user.role?.toLowerCase()} account</span>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Quick Nav Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {ACCOUNT_LINKS.map(({ href, icon: Icon, label, desc, color, badge }, i) => {
                  const badgeText = badge && typeof badge !== 'function' ? badge : null;
                  return (
                    <motion.div
                      key={href}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <Link href={href}>
                        <div className="group bg-card rounded-2xl border border-border/50 p-4 flex items-center gap-4 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{label}</p>
                              {badgeText && (
                                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                                  {badgeText}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{desc}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              {/* Data Privacy (CCPA) */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-card rounded-3xl border border-border/50 p-6 mb-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Data Privacy</h3>
                    <p className="text-xs text-muted-foreground">Your CCPA/CPRA privacy rights</p>
                  </div>
                </div>

                {/* CCPA Opt-Out Toggles */}
                <div className="space-y-3 mb-4">
                  {[
                    { field: 'doNotSell' as const, label: 'Do Not Sell or Share My Personal Information', desc: 'Opt out of any sale or sharing of your data (CCPA)', value: doNotSell },
                    { field: 'limitSensitiveData' as const, label: 'Limit Use of My Sensitive Personal Information', desc: 'Restrict use of your contact info & order data to order fulfillment only (CPRA)', value: limitSensitiveData },
                  ].map(({ field, label, desc, value }) => (
                    <div key={field} className="flex items-start justify-between gap-3 py-2.5 border-b border-border/40 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium leading-snug">{label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                      <Switch
                        checked={value}
                        onCheckedChange={v => handlePrivacyToggle(field, v)}
                        disabled={privacyLoading}
                        className="shrink-0 mt-0.5"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 flex-1"
                    onClick={handleDataExport}
                    disabled={exportLoading}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {exportLoading ? 'Exporting…' : 'Export My Data'}
                  </Button>
                  {!deleteConfirm ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setDeleteConfirm(true)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete My Account
                    </Button>
                  ) : (
                    <div className="flex gap-2 flex-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={handleDeleteAccount}
                        disabled={deleteLoading}
                      >
                        {deleteLoading ? 'Deleting…' : 'Yes, delete permanently'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteConfirm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-3">
                  Data export downloads a JSON file of all your account data. Account deletion is permanent and cannot be undone.{' '}
                  <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                </p>
              </motion.div>

              {/* Sign Out — mobile only (desktop uses sidebar) */}
              <div className="md:hidden">
                <Button
                  variant="outline"
                  className="w-full gap-2 text-muted-foreground"
                  onClick={() => setShowLogoutConfirm(true)}
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </div>

              {/* Logout confirmation dialog */}
              <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sign out?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You'll be signed out of your Numa Fresh account. Any unsaved changes will be lost.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={handleLogout}
                    >
                      Sign Out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
