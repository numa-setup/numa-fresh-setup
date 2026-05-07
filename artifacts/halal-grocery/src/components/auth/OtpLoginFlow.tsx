import { useState, useRef, useEffect, useCallback, type ReactNode, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';

export type OtpPortal = 'customer' | 'seller';

export interface OtpLoginFlowProps {
  portal: OtpPortal;
  title: string;
  subtitle: string;
  heroIcon: ReactNode;
  /** Outer page background gradient / colors */
  pageWrapperClass: string;
  /** Optional card border accent */
  cardBorderClass?: string;
  primaryButtonClass: string;
  /** Footer link to the other portal */
  alternatePortalLink?: { href: string; label: string };
}

type Step = 'email' | 'otp' | 'profile';

function parseNextPath(loc: string): string {
  const params = new URLSearchParams(loc.split('?')[1] || '');
  return params.get('next') || '/';
}

const OTP_LENGTH_FALLBACK = 6;

export function OtpLoginFlow({
  portal,
  title,
  subtitle,
  heroIcon,
  pageWrapperClass,
  cardBorderClass = 'border-border/50',
  primaryButtonClass,
  alternatePortalLink,
}: OtpLoginFlowProps) {
  const { user, establishSession, refreshUser } = useAuth();
  const [loc, setLocation] = useLocation();
  const { toast } = useToast();

  const nextPath = parseNextPath(loc);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(OTP_LENGTH_FALLBACK);
  const [otp, setOtp] = useState<string[]>(() => Array(OTP_LENGTH_FALLBACK).fill(''));
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [storeName, setStoreName] = useState('');

  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [resendReadyIn, setResendReadyIn] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpShake, setOtpShake] = useState(false);
  const verifyBusyRef = useRef(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  /** Google OAuth redirect: ?accessToken=&refreshToken=&googleAuth=1 */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const at = params.get('accessToken');
    const rt = params.get('refreshToken');
    if (at && rt) {
      sessionStorage.setItem('accessToken', at);
      sessionStorage.setItem('refreshToken', rt);
      void refreshUser();
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash || ''}`);
    }
  }, [refreshUser]);

  useEffect(() => {
    if (!user) return;
    if (step === 'profile') return;
    if (portal === 'customer') {
      if (user.role === 'ADMIN') {
        setLocation('/admin');
        return;
      }
      if (user.role === 'STORE_OWNER' || user.role === 'STORE_STAFF') {
        setLocation('/store-portal');
        return;
      }
      setLocation(nextPath);
      return;
    }
    if (user.role === 'ADMIN') {
      setLocation('/admin');
      return;
    }
    if (user.role === 'CUSTOMER') {
      setLocation('/');
      return;
    }
    setLocation('/store-portal');
  }, [user, portal, nextPath, setLocation, step]);

  const applyRedirect = useCallback(
    (u: User) => {
      if (portal === 'customer') {
        if (u.role === 'ADMIN') {
          setLocation('/admin');
          return;
        }
        if (u.role === 'STORE_OWNER' || u.role === 'STORE_STAFF') {
          setError('store_portal');
          return;
        }
        setLocation(nextPath);
        return;
      }
      if (u.role === 'ADMIN') {
        setLocation('/admin');
        return;
      }
      if (u.role === 'CUSTOMER') {
        setError('customer_portal');
        return;
      }
      setLocation('/store-portal');
    },
    [portal, nextPath, setLocation],
  );

  useEffect(() => {
    if (!expiresAt) {
      setRemainingSec(0);
      return;
    }
    const tick = () => {
      const sec = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setRemainingSec(sec);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    if (resendReadyIn <= 0) return;
    const id = window.setInterval(() => {
      setResendReadyIn((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendReadyIn]);

  const formatMmSs = (total: number) => {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const basicEmailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const sendCode = async () => {
    setError('');
    if (!basicEmailValid(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{
        success: boolean;
        isNewUser: boolean;
        expiresAt: string;
        otpLength: number;
      }>('/auth/send-otp', {
        email: email.trim(),
        portal,
      });
      const len =
        typeof res.otpLength === 'number' && res.otpLength >= 4 && res.otpLength <= 8
          ? res.otpLength
          : OTP_LENGTH_FALLBACK;
      setOtpDigits(len);
      setExpiresAt(new Date(res.expiresAt));
      setStep('otp');
      setOtp(Array(len).fill(''));
      setResendReadyIn(60);
      toast({ title: 'Check your inbox', description: 'We sent a verification code to your email.' });
      requestAnimationFrame(() => inputRefs.current[0]?.focus());
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpCode = async (code: string) => {
    if (code.length !== otpDigits || verifyBusyRef.current) return;
    verifyBusyRef.current = true;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{
        success: boolean;
        requiresProfile: boolean;
        user?: User;
        accessToken?: string;
        refreshToken?: string;
      }>('/auth/verify-otp', { email: email.trim(), otp: code, portal });

      if (res.requiresProfile) {
        setStep('profile');
        toast({ title: 'Email verified', description: 'Complete your profile to finish signing up.' });
        return;
      }

      if (res.user && res.accessToken && res.refreshToken) {
        establishSession(res.user, res.accessToken, res.refreshToken);
        toast({
          title: portal === 'seller' ? `Welcome, ${res.user.firstName}!` : `Welcome back, ${res.user.firstName}!`,
        });
        applyRedirect(res.user);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Connection error. Please check your internet and try again.';
      setError(msg);
      setOtpShake(true);
      setTimeout(() => setOtpShake(false), 450);
      setOtp(Array(otpDigits).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
      verifyBusyRef.current = false;
    }
  };

  const completeProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (portal === 'seller' && !storeName.trim()) {
      setError('Store name is required.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ user: User; accessToken: string; refreshToken: string }>('/auth/complete-profile', {
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
        portal,
        storeName: portal === 'seller' ? storeName.trim() : null,
      });
      establishSession(res.user, res.accessToken, res.refreshToken);
      toast({ title: `Welcome to Numa Fresh, ${res.user.firstName}!` });
      applyRedirect(res.user);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onOtpChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < otpDigits - 1) {
      inputRefs.current[index + 1]?.focus();
    }
    const code = next.join('');
    if (code.length === otpDigits && next.every((d) => d)) {
      void verifyOtpCode(code);
    }
  };

  const onOtpKeyDown = (index: number, ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const onOtpPaste = (ev: ClipboardEvent<HTMLInputElement>) => {
    ev.preventDefault();
    const raw = ev.clipboardData.getData('text').replace(/\D/g, '').slice(0, otpDigits);
    if (!raw) return;
    const next = Array(otpDigits).fill('');
    for (let i = 0; i < raw.length; i++) next[i] = raw[i]!;
    setOtp(next);
    const focusIdx = Math.min(raw.length, otpDigits - 1);
    inputRefs.current[focusIdx]?.focus();
    if (raw.length === otpDigits) void verifyOtpCode(raw);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center py-12 px-4 ${pageWrapperClass}`}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3 shadow">{heroIcon}</div>
          <h1 className="font-serif font-bold text-2xl">{title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
        </div>

        <div className={`bg-card rounded-3xl border ${cardBorderClass} p-6 shadow-lg`}>
          {step === 'email' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="otp-email">Email Address</Label>
                <Input
                  id="otp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="mt-1"
                  autoComplete="email"
                />
              </div>
              {error && error !== 'store_portal' && error !== 'customer_portal' && (
                <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 rounded-xl px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <Button
                type="button"
                className={`w-full h-11 ${primaryButtonClass}`}
                disabled={loading}
                onClick={() => void sendCode()}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Sending…
                  </>
                ) : (
                  <>
                    Send Verification Code
                    <ChevronRight className="w-4 h-4 ml-1 inline" />
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground leading-relaxed">
                We&apos;ll send a 6-digit code to verify your identity.
                <br />
                No account? One will be created automatically.
              </p>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="font-semibold text-lg">Check your email!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  We sent a code to:{' '}
                  <button
                    type="button"
                    className="text-primary font-medium underline-offset-2 hover:underline"
                    onClick={() => {
                      setStep('email');
                      setOtp(Array(otpDigits).fill(''));
                      setError('');
                    }}
                  >
                    {email}
                  </button>{' '}
                  <span className="text-xs">(Change)</span>
                </p>
              </div>

              <motion.div
                animate={otpShake ? { x: [0, -6, 6, -6, 6, 0] } : {}}
                transition={{ duration: 0.35 }}
                className="flex justify-center gap-2"
              >
                {otp.map((d, i) => (
                  <Input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={d}
                    onChange={(e) => onOtpChange(i, e.target.value)}
                    onKeyDown={(e) => onOtpKeyDown(i, e)}
                    onPaste={i === 0 ? onOtpPaste : undefined}
                    className={`w-10 h-12 text-center text-lg font-semibold rounded-md p-0 ${
                      error ? 'border-destructive ring-1 ring-destructive/30' : ''
                    }`}
                    aria-label={i === 0 ? 'First digit of verification code' : `Digit ${i + 1}`}
                  />
                ))}
              </motion.div>

              <div className="text-center text-sm">
                {remainingSec > 0 ? (
                  <p className={remainingSec <= 60 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                    Code expires in: {formatMmSs(remainingSec)}
                  </p>
                ) : (
                  <p className="text-destructive font-medium">Code expired — request a new code.</p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 rounded-xl px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="button"
                className={`w-full h-11 ${primaryButtonClass}`}
                disabled={loading || otp.join('').length !== otpDigits || remainingSec <= 0}
                onClick={() => void verifyOtpCode(otp.join(''))}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Verifying…
                  </>
                ) : (
                  'Verify Code'
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  disabled={resendReadyIn > 0 || loading}
                  className="text-sm text-primary font-medium disabled:text-muted-foreground disabled:cursor-not-allowed hover:underline"
                  onClick={() => void sendCode()}
                >
                  {resendReadyIn > 0 ? `Resend code in ${resendReadyIn}s` : 'Resend Code'}
                </button>
              </div>
            </div>
          )}

          {step === 'profile' && (
            <form onSubmit={(e) => void completeProfile(e)} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="font-semibold text-lg">Welcome to Numa Fresh! 🎉</h2>
                <p className="text-sm text-muted-foreground">Just a few more details</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="fn">First Name *</Label>
                  <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" required />
                </div>
                <div>
                  <Label htmlFor="ln">Last Name *</Label>
                  <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" required />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Phone Number (optional)</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
              </div>
              {portal === 'seller' && (
                <div>
                  <Label htmlFor="store">Store Name *</Label>
                  <Input
                    id="store"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Your halal market name"
                    className="mt-1"
                    required
                  />
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 rounded-xl px-3 py-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <Button type="submit" className={`w-full h-11 ${primaryButtonClass}`} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating…
                  </>
                ) : (
                  <>
                    Create My Account
                    <ChevronRight className="w-4 h-4 ml-1 inline" />
                  </>
                )}
              </Button>
            </form>
          )}

          {error === 'store_portal' && portal === 'customer' && (
            <div className="mt-4 flex items-start gap-2 text-destructive text-sm bg-destructive/10 rounded-xl px-3 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Store owners must sign in at the{' '}
                <a href="/seller" className="underline font-semibold">
                  Store Owner Portal →
                </a>
              </span>
            </div>
          )}
          {error === 'customer_portal' && portal === 'seller' && (
            <div className="mt-4 flex items-start gap-2 text-destructive text-sm bg-destructive/10 rounded-xl px-3 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Customers should sign in on the{' '}
                <a href="/login" className="underline font-semibold">
                  customer sign-in page →
                </a>
              </span>
            </div>
          )}
        </div>

        {alternatePortalLink && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            <a href={alternatePortalLink.href} className="text-primary font-medium hover:underline">
              {alternatePortalLink.label}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
