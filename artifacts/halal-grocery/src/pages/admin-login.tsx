import { useState } from 'react';
import { useLocation } from 'wouter';
import { Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  if (user) {
    if (user.role === 'ADMIN') { setLocation('/admin'); return null; }
    if (user.role === 'STORE_OWNER') { setLocation('/store-portal'); return null; }
    setLocation('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser.role === 'STORE_OWNER') {
        setError('Store owner accounts must use the Store Owner Portal.');
        return;
      }
      if (loggedInUser.role === 'CUSTOMER') {
        setError('This is the Admin Panel. Customer accounts do not have access.');
        return;
      }
      toast({ title: `Welcome, ${loggedInUser.firstName}! Admin panel ready.` });
      setLocation('/admin');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 mb-3 shadow">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-serif font-bold text-2xl">Admin Panel</h1>
          <p className="text-muted-foreground text-sm mt-1">Restricted access — authorised personnel only</p>
        </div>

        <div className="bg-card rounded-3xl border border-slate-200/80 p-6 shadow-lg">
          {/* Demo credentials */}
          <div className="bg-slate-50 rounded-xl p-3 mb-5 text-xs border border-slate-200">
            <p className="font-semibold text-slate-600 mb-1">Demo Admin Credentials:</p>
            <p className="text-muted-foreground">admin@halalgrocery.com / Admin@123</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@halalgrocery.com"
                className="mt-1" required autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  className="pr-10" required autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-xl px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit"
              className="w-full bg-gradient-to-r from-slate-600 to-slate-800 border-0 text-white hover:opacity-90 h-11"
              disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Access Admin Panel'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
