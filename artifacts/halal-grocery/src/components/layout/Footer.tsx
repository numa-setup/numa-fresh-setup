import { useState } from "react";
import { Link } from "wouter";
import {
  Shield,
  Award,
  CheckCircle,
  Star,
  Leaf,
  Mail,
  Phone,
  MapPin,
  Instagram,
  Twitter,
  Facebook,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCms } from "@/lib/cms";
import { OtpModal } from "@/components/auth/OtpModal";
import { ContactUs } from "@/components/layout/ContactUs";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const CERT_ICONS = {
  shield: Shield,
  award: Award,
  check: CheckCircle,
  star: Star,
  leaf: Leaf,
} as const;

const FOOTER_LINKS = {
  account: [
    { label: "Sign In", href: "/login", requiresGuest: true },
    { label: "Create Account", href: "/signup", requiresGuest: true },
    { label: "My Orders", href: "/orders" },
    { label: "Addresses", href: "/account/addresses" },
  ],
  business: [
    { label: "List Your Store", href: "/seller" },
  ],
  support: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Contact Us", href: "#contact" },
  ],
};

export function Footer() {
  const { isAuthenticated } = useAuth();
  const cms = useCms();
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const accountLinks = FOOTER_LINKS.account.filter(
    (link) => !(link.requiresGuest && isAuthenticated),
  );
  const certBadges = cms["cms.footerCertificates"]
    .filter((c) => c.active)
    .slice(0, 6);
  return (
    <footer>
      {/* Main footer */}
      <div
        style={{
          background: "linear-gradient(135deg, #0D2D22 0%, #1A3D30 100%)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-8 sm:pb-10">
          {/* Top row: Brand + newsletter */}
          <div className="flex flex-col lg:flex-row gap-7 lg:gap-16 pb-8 sm:pb-12 border-b border-white/10">
            {/* Brand */}
            <div className="lg:max-w-xs shrink-0">
              <Link href="/" className="flex items-center gap-2.5 mb-4 group">
                <div className="w-10 h-10 rounded-xl hg-gradient-primary flex items-center justify-center shadow group-hover:shadow-md transition">
                  <span className="text-white font-bold text-sm font-serif">
                    حل
                  </span>
                </div>
                <div>
                  <span className="font-serif font-bold text-xl text-white leading-none block">
                    Numa Fresh
                  </span>
                  <span className="text-white/40 text-[10px] tracking-widest uppercase">
                    Halal Marketplace
                  </span>
                </div>
              </Link>
              <p className="text-white/60 text-sm leading-relaxed mb-5">
                America's trusted halal grocery marketplace. Fresh, certified,
                and delivered with care to Muslim families nationwide.
              </p>

              {/* Certifications (CMS-driven) */}
              {certBadges.length > 0 && (
                <div className="flex gap-3 flex-wrap">
                  {certBadges.map((badge) => {
                    const Icon = CERT_ICONS[badge.iconKey] || Shield;
                    const inner = (
                      <div className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                        <Icon className="w-4 h-4 text-[#D4AF37]" />
                        <span className="text-white text-[10px] font-bold leading-none">
                          {badge.label}
                        </span>
                        <span className="text-white/40 text-[9px]">
                          {badge.sub}
                        </span>
                      </div>
                    );
                    return badge.linkUrl ? (
                      <a
                        key={badge.id}
                        href={badge.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {inner}
                      </a>
                    ) : (
                      <div key={badge.id}>{inner}</div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Links grid: 2 columns mobile/tablet, 4 on desktop */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 flex-1">
              <div>
                <h4 className="text-white font-semibold text-sm mb-4">
                  My Account
                </h4>
                <ul className="space-y-2.5">
                  {accountLinks.map((link) =>
                    link.label === "Create Account" || link.label === "Sign In" ? (
                      <li key={link.label}>
                        <button
                          onClick={() => setShowOtpModal(true)}
                          className="min-h-[1.5rem] flex items-center text-white/55 text-sm hover:text-white transition-colors text-left"
                        >
                          {link.label}
                        </button>
                      </li>
                    ) : (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="min-h-[1.5rem] flex items-center text-white/55 text-sm hover:text-white transition-colors"
                        >
                          {link.label}
                        </Link>
                      </li>
                    )
                  )}
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm mb-4">
                  For Businesses
                </h4>
                <ul className="space-y-2.5">
                  {FOOTER_LINKS.business.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-white/55 text-sm hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm mb-4">
                  Support
                </h4>
                <ul className="space-y-2.5">
                  {FOOTER_LINKS.support.map((link) =>
                    link.label === "Contact Us" ? (
                      <li key={link.label}>
                        <button
                          onClick={() => setShowContactModal(true)}
                          className="min-h-[1.5rem] flex items-center text-white/55 text-sm hover:text-white transition-colors text-left"
                        >
                          {link.label}
                        </button>
                      </li>
                    ) : (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="min-h-[1.5rem] flex items-center text-white/55 text-sm hover:text-white transition-colors"
                        >
                          {link.label}
                        </Link>
                      </li>
                    )
                  )}
                </ul>
              </div>
              <div id="contact">
                <h4 className="text-white font-semibold text-sm mb-4">
                  Contact
                </h4>
                <ul className="space-y-2.5">
                  <li>
                    <a
                      href="mailto:numasetup@gmail.com"
                      className="min-h-[1.5rem] flex items-center gap-2 text-white/55 text-sm hover:text-white transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5 text-[#3FB196] shrink-0" />
                      <span>numasetup@gmail.com</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="tel:+15712645687"
                      className="min-h-[1.5rem] flex items-center gap-2 text-white/55 text-sm hover:text-white transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#3FB196] shrink-0" />
                      <span>+1 (571) 264-5687</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://maps.google.com/?q=4773+Charter+Ct,+Woodbridge,+VA"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[1.5rem] flex items-center gap-2 text-white/55 text-sm hover:text-white transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5 text-[#3FB196] shrink-0" />
                      <span>4773 Charter Ct, Woodbridge VA</span>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-white/40 text-xs">
              © {new Date().getFullYear()} Numa Fresh Inc. All rights reserved.
            </div>

            <div className="flex items-center gap-4">
              {/* Social icons */}
              <div className="flex items-center gap-2.5">
                {[
                  { icon: Instagram, href: "#", label: "Instagram" },
                  { icon: Facebook, href: "#", label: "Facebook" },
                  { icon: Twitter, href: "#", label: "Twitter" },
                ].map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    className="w-8 h-8 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15 transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </a>
                ))}
              </div>

              <div className="flex items-center gap-1 text-xs text-white/40">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3FB196] inline-block animate-pulse" />
                All products halal certified
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* OTP Login Modal */}
      <OtpModal open={showOtpModal} onClose={() => setShowOtpModal(false)} />

      {/* Contact Us Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="max-w-lg w-[calc(100vw-2rem)] p-0 overflow-y-auto max-h-[90dvh] rounded-3xl border-border/50">
          <ContactUs inModal />
        </DialogContent>
      </Dialog>
    </footer>
  );
}
