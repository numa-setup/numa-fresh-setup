import { Helmet } from 'react-helmet-async';
import { Shield, Lock, Eye, Trash2, Download, Mail, ChevronRight, Ban, Fingerprint } from 'lucide-react';
import { Link } from 'wouter';

const Section = ({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) => (
  <section className="mb-10" id={id}>
    <h2 className="font-serif font-bold text-xl mb-3 text-foreground">{title}</h2>
    <div className="text-muted-foreground text-sm leading-relaxed space-y-3">{children}</div>
  </section>
);

export default function PrivacyPage() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy — Numa Fresh</title>
        <meta name="description" content="Numa Fresh Privacy Policy — CCPA/CPRA compliant. Learn how we collect, use, and protect your personal information." />
      </Helmet>

      <div className="min-h-screen py-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span>Privacy Policy</span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-serif font-bold text-3xl">Privacy Policy</h1>
                <p className="text-sm text-muted-foreground">Last updated: April 2026 · Version 2.0 · CCPA/CPRA Compliant</p>
              </div>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-foreground">
              <strong>Summary:</strong> We collect only what we need, we <strong>never sell your data</strong>, and you can delete your account and all associated personal data at any time. Your payment information is handled exclusively by Stripe — we never see or store card details. This policy is aligned with the California Consumer Privacy Act (CCPA), California Privacy Rights Act (CPRA), and the federal CAN-SPAM Act.
            </div>
          </div>

          {/* Quick Rights — 6 cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
            {[
              { icon: Eye,         label: 'Right to Know',         desc: 'Access all data we hold' },
              { icon: Trash2,      label: 'Right to Delete',       desc: 'Full erasure on request' },
              { icon: Download,    label: 'Data Portability',      desc: 'Download your data as JSON' },
              { icon: Ban,         label: 'Do Not Sell',           desc: 'Opt out in account settings' },
              { icon: Fingerprint, label: 'Limit Sensitive Use',   desc: 'CPRA opt-out available' },
              { icon: Mail,        label: 'Unsubscribe',           desc: 'Every email has a link' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="bg-card border border-border/50 rounded-xl p-3 text-center">
                <Icon className="w-5 h-5 text-primary mx-auto mb-1.5" />
                <p className="font-semibold text-xs mb-0.5">{label}</p>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          <div className="prose-like">
            <Section title="1. Who We Are">
              <p>Numa Fresh Inc. ("Numa Fresh", "we", "us", or "our") operates the Numa Fresh Marketplace — a halal grocery platform connecting Muslim consumers with certified halal stores across the United States.</p>
              <p><strong>Contact:</strong> privacy@numafresh.com · 4773 Charter Ct, Woodbridge, VA 22192, USA · +1 (571) 264-5687</p>
            </Section>

            <Section title="2. Information We Collect">
              <p><strong>Account information:</strong> Name, email address, phone number, password (hashed with bcrypt — never stored in plain text).</p>
              <p><strong>Order information:</strong> Delivery/pickup addresses, order history, item selections, special instructions, vehicle info for curbside orders.</p>
              <p><strong>Payment information:</strong> We do not store payment card details. All card processing is handled by Stripe (PCI-compliant). We only receive confirmation tokens and transaction IDs.</p>
              <p><strong>Usage data:</strong> Pages visited, search queries, device type, browser, and IP address for security and analytics.</p>
              <p><strong>Location:</strong> Approximate location (city/state) when you search for nearby stores. We do not track your precise GPS location without explicit permission.</p>
              <p><strong>Sensitive personal information (CPRA):</strong> We do not collect government IDs, financial account numbers, racial/ethnic origin, health data, or biometric data. The only potentially sensitive data we hold is your email address, phone number, and order history, which we use solely to fulfill your orders.</p>
            </Section>

            <Section title="3. How We Use Your Information">
              <p><strong>To fulfill orders:</strong> We share your name, phone number, and pickup details with the store processing your order.</p>
              <p><strong>To communicate:</strong> Order confirmations, status updates, and receipts via email and SMS. Marketing emails only with your explicit consent, with a clear unsubscribe link in every email (CAN-SPAM Act compliant).</p>
              <p><strong>To improve the platform:</strong> Aggregate analytics to understand which features are used and fix bugs. We do not sell or share individual-level data for advertising.</p>
              <p><strong>For security:</strong> IP logging for rate limiting and fraud prevention. Admin actions are permanently logged in an audit trail.</p>
            </Section>

            <Section title="4. Data Sharing — We Do Not Sell Your Personal Information">
              <p>Numa Fresh does <strong>not sell your personal data</strong> and does <strong>not share your personal data for cross-context behavioral advertising</strong>. We share data only in these limited cases:</p>
              <ul className="list-disc pl-4 space-y-1.5">
                <li><strong>Stores:</strong> Name, phone, and order details shared with the halal store fulfilling your order — limited to what is strictly necessary for order fulfillment.</li>
                <li><strong>Stripe:</strong> Payment processing. Stripe operates under their own privacy policy and PCI DSS compliance program.</li>
                <li><strong>Twilio:</strong> SMS delivery provider for time-sensitive order notifications only.</li>
                <li><strong>Legal requirements:</strong> If required by law, court order, or to protect the rights and safety of our users.</li>
              </ul>
              <p>Even though we do not sell data, CCPA requires we provide an opt-out mechanism. You can exercise this right in your <Link href="/account" className="text-primary hover:underline">Account Settings → Privacy Preferences</Link>.</p>
            </Section>

            <Section title="5. Data Retention">
              <p><strong>Financial transaction / order records:</strong> Retained for up to <strong>7 years</strong> for tax and accounting purposes, consistent with Internal Revenue Service (IRS) guidelines. This data cannot be deleted on request but will be de-identified where possible.</p>
              <p><strong>Account personal data:</strong> Retained while your account is active. Upon account deletion request, personal information (name, email, phone) is anonymized within 30 days. The anonymized shell record is retained to preserve order financial records.</p>
              <p><strong>Loyalty transaction history:</strong> Retained for up to 7 years for accounting. Points expire after 12 months of account inactivity.</p>
              <p><strong>Usage logs / IP addresses:</strong> Retained for up to 90 days for security monitoring, then deleted.</p>
            </Section>

            <Section title="6. Your CCPA / CPRA Privacy Rights">
              <p>Under the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA), California residents — and as a matter of policy, <strong>all US residents</strong> — have the following rights:</p>
              <ul className="list-disc pl-4 space-y-2">
                <li><strong>Right to Know / Access:</strong> Request disclosure of the categories and specific pieces of personal information we have collected, used, disclosed, or sold. Download from <Link href="/account" className="text-primary hover:underline">Account → Export My Data</Link>.</li>
                <li><strong>Right to Delete:</strong> Request deletion of your personal information. Go to <Link href="/account" className="text-primary hover:underline">Account → Delete My Account</Link>. Financial records required by IRS are excluded per law.</li>
                <li><strong>Right to Correct:</strong> Request correction of inaccurate personal information. Update directly in <Link href="/account" className="text-primary hover:underline">Account Settings</Link>.</li>
                <li><strong>Right to Opt Out of Sale or Sharing:</strong> Although we do not sell data, you can formally record your opt-out in <Link href="/account" className="text-primary hover:underline">Account → Privacy Preferences</Link>.</li>
                <li><strong>Right to Limit Use of Sensitive Personal Information (CPRA):</strong> Direct us to limit use of sensitive personal information to necessary purposes. See <Link href="/account" className="text-primary hover:underline">Account → Privacy Preferences</Link>.</li>
                <li><strong>Right to Data Portability:</strong> Receive your data in a portable JSON format via <Link href="/account" className="text-primary hover:underline">Account → Export My Data</Link>.</li>
                <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising any privacy right. All features remain available regardless of opt-out choices.</li>
              </ul>
              <p>To exercise any right, email <a href="mailto:privacy@numafresh.com" className="text-primary hover:underline">privacy@numafresh.com</a> or use the self-service tools in your account. We will respond within <strong>45 days</strong> as required by CCPA.</p>
            </Section>

            <Section title='7. Do Not Sell or Share My Personal Information' id="do-not-sell">
              <p>As stated above, Numa Fresh does not sell or share your personal information for cross-context behavioral advertising. This right is guaranteed to all users regardless of state of residence.</p>
              <p>To formally record your "Do Not Sell or Share" preference, visit <Link href="/account" className="text-primary hover:underline">Account → Privacy Preferences</Link> and toggle <strong>"Do Not Sell or Share My Personal Information"</strong>. Your preference is stored in our system and honored immediately.</p>
              <p>California residents may also submit a request by emailing <a href="mailto:privacy@numafresh.com" className="text-primary hover:underline">privacy@numafresh.com</a> with subject line "Do Not Sell My Personal Information".</p>
            </Section>

            <Section title="8. Limit Use of My Sensitive Personal Information (CPRA)">
              <p>Under the CPRA, you have the right to direct us to limit the use and disclosure of your sensitive personal information to only what is necessary to provide the services you requested.</p>
              <p>To exercise this right, go to <Link href="/account" className="text-primary hover:underline">Account → Privacy Preferences</Link> and enable <strong>"Limit Use of My Sensitive Personal Information"</strong>. When enabled, we limit use of your contact information and order details strictly to order fulfillment — no analytics, no aggregation, no optional communications.</p>
            </Section>

            <Section title="9. Cookies & Tracking">
              <p>We use strictly necessary cookies for authentication (session tokens). We use <strong>no third-party advertising trackers</strong>. Analytics are privacy-preserving and aggregate-only. A cookie consent banner is displayed on first visit per CCPA guidelines. You can clear cookies in your browser settings at any time.</p>
            </Section>

            <Section title="10. Security Measures">
              <p>We implement reasonable security measures to protect personal data, including:</p>
              <ul className="list-disc pl-4 space-y-1.5">
                <li><strong>Encryption in transit:</strong> All data transmitted over HTTPS/TLS.</li>
                <li><strong>Password hashing:</strong> bcrypt with appropriate cost factor — passwords are never stored in plain text.</li>
                <li><strong>Security headers:</strong> Helmet.js enforces HSTS, X-Frame-Options, CSP, and other headers.</li>
                <li><strong>Rate limiting:</strong> API endpoints rate-limited to prevent brute force and abuse.</li>
                <li><strong>Input sanitization:</strong> All inputs validated and sanitized against SQL injection and XSS.</li>
                <li><strong>Audit trail:</strong> All admin actions permanently logged with IP, action, and timestamp.</li>
                <li><strong>PCI compliance:</strong> Card details handled exclusively by Stripe — we are PCI DSS compliant by design.</li>
              </ul>
              <p>In the event of a data breach affecting your personal information, we will notify you within <strong>72 hours</strong> of becoming aware of it.</p>
            </Section>

            <Section title="11. CAN-SPAM Act Compliance">
              <p>All marketing and promotional emails sent by Numa Fresh comply with the CAN-SPAM Act:</p>
              <ul className="list-disc pl-4 space-y-1.5">
                <li>Every marketing email includes a clear, working <strong>unsubscribe link</strong> in the footer.</li>
                <li>Our physical mailing address is included in every email: 4773 Charter Ct, Woodbridge, VA 22192, USA.</li>
                <li>Unsubscribe requests are honored within <strong>10 business days</strong>.</li>
                <li>We do not use deceptive subject lines or misleading sender information.</li>
                <li>Manage your email preferences at any time in <Link href="/account/notifications" className="text-primary hover:underline">Account → Notifications</Link>.</li>
              </ul>
            </Section>

            <Section title="12. Children's Privacy">
              <p>The Numa Fresh platform is not directed at children under 13. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a child, contact us immediately at privacy@numafresh.com.</p>
            </Section>

            <Section title="13. Changes to This Policy">
              <p>We will notify you of material changes to this Privacy Policy by email at least <strong>14 days</strong> before the changes take effect. Continued use of the platform after that date constitutes acceptance. The current version is always at numafresh.com/privacy.</p>
            </Section>

            <Section title="14. Contact & Authorized Agent Requests">
              <p>To exercise any privacy right, submit an authorized agent request, or ask privacy-related questions:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Email: <a href="mailto:privacy@numafresh.com" className="text-primary hover:underline">privacy@numafresh.com</a></li>
                <li>Phone: +1 (571) 264-5687</li>
                <li>Mail: Numa Fresh Inc., 4773 Charter Ct, Woodbridge, VA 22192, USA</li>
              </ul>
              <p className="mt-2">We will verify your identity before processing any request. Authorized agents must provide signed permission from the consumer and a copy of the consumer's ID.</p>
            </Section>
          </div>

          <div className="border-t border-border/50 pt-6 mt-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Numa Fresh Inc. · <Link href="/terms" className="hover:text-foreground">Terms of Service</Link> · <Link href="/privacy" className="text-primary">Privacy Policy</Link> · <a href="mailto:privacy@numafresh.com" className="hover:text-foreground">privacy@numafresh.com</a>
          </div>

          <div className="h-10" />
        </div>
      </div>
    </>
  );
}
