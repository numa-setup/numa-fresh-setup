import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Store, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

function parseNextPath(loc: string): string {
  const params = new URLSearchParams(loc.split('?')[1] || '');
  return params.get('next') || '/store-portal';
}

export default function StoreLoginPage() {
  const { login, user } = useAuth();
  const [loc, setLocation] = useLocation();
  const nextPath = parseNextPath(loc);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) {
    if (user.role === 'ADMIN') { setLocation('/admin'); return null; }
    if (user.role === 'STORE_OWNER' || user.role === 'STORE_STAFF') { setLocation(nextPath); return null; }
    setLocation('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    try {
      const loggedInUser = await login(email.trim(), password);
      if (loggedInUser.role === 'ADMIN') setLocation('/admin');
      else if (loggedInUser.role === 'STORE_OWNER' || loggedInUser.role === 'STORE_STAFF') setLocation(nextPath);
      else setError('This portal is for store owners only. Please use the customer login.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-background to-orange-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4 shadow-lg">
            <Store className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-serif font-bold text-2xl text-foreground">Store Owner Portal</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to manage your halal store</p>
        </div>

        <div className="bg-card border border-amber-200/60 rounded-2xl shadow-sm p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="owner@yourstore.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-amber-500 to-orange-600 border-0 text-white w-full mt-1 hover:opacity-90"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Customer?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">Sign in here →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
