import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

const STORAGE_KEY = 'numa_cookie_consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1800);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, date: new Date().toISOString() }));
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: false, date: new Date().toISOString() }));
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[200] bg-card border border-border shadow-2xl rounded-2xl p-5"
        >
          <button
            onClick={decline}
            className="absolute top-3 right-3 p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Cookie className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-0.5">We use cookies</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We use strictly necessary cookies for authentication and aggregate analytics to improve your experience. We never sell your data.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mb-4 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>No advertising trackers · No third-party data sharing</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={decline}
              className="flex-1 rounded-xl text-xs h-9"
            >
              Decline
            </Button>
            <Button
              size="sm"
              onClick={accept}
              className="flex-1 hg-gradient-primary border-0 text-white rounded-xl text-xs h-9"
            >
              Accept All
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-2">
            <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
