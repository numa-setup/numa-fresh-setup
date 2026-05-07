import { Helmet } from 'react-helmet-async';
import { Link } from 'wouter';
import { ChevronLeft, Shield } from 'lucide-react';

const SECTIONS = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    content: `By accessing or using the Numa Fresh platform ("Platform"), including our website, mobile applications, and related services, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Platform. We reserve the right to update these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the revised Terms.`,
  },
  {
    id: 'services',
    title: '2. Description of Services',
    content: `Numa Fresh is a halal grocery marketplace that connects customers with certified halal grocery stores and vendors. Our services include browsing and purchasing halal-certified products, store discovery, order management, delivery coordination, and customer support. We act as an intermediary platform between buyers and sellers and are not responsible for the direct fulfillment of orders, which is handled by individual store owners.`,
  },
  {
    id: 'eligibility',
    title: '3. Eligibility & Account Registration',
    content: `You must be at least 18 years of age to create an account on Numa Fresh. By registering, you represent that all information you provide is accurate, current, and complete. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Notify us immediately at numasetup@gmail.com if you suspect any unauthorized use of your account.`,
  },
  {
    id: 'halal',
    title: '4. Halal Certification',
    content: `Numa Fresh makes good-faith efforts to list only products and stores that are halal-certified by recognized certification bodies (e.g., ISNA, IFANCA, HFSAA). However, Numa Fresh does not independently verify the halal status of every product. Customers are encouraged to review certification details on product pages. Numa Fresh disclaims liability for any errors or misrepresentations made by store owners regarding halal certification.`,
  },
  {
    id: 'orders',
    title: '5. Orders & Payments',
    content: `All orders placed through the Platform are subject to acceptance by the relevant store. Pricing is set by individual store owners and may change without notice. Payment is processed securely through our payment partners. By placing an order, you authorize us to charge the payment method provided. Numa Fresh is not responsible for pricing errors made by stores; in such cases, the order may be canceled and a full refund issued.`,
  },
  {
    id: 'refunds',
    title: '6. Refunds & Cancellations',
    content: `Refund and cancellation policies vary by store. General platform-level refunds may be issued at Numa Fresh's discretion in cases of order non-fulfillment, significant quality issues, or technical errors. To request a refund, contact our support team at numasetup@gmail.com within 48 hours of receiving your order. Perishable goods may have limited refund eligibility. Store-level disputes should first be raised with the store directly through the Platform's messaging feature.`,
  },
  {
    id: 'store-owners',
    title: '7. Store Owner Obligations',
    content: `Store owners who list products on Numa Fresh agree to: (a) provide accurate product descriptions and pricing; (b) maintain valid halal certifications for listed products; (c) fulfill orders in a timely manner; (d) comply with all applicable food safety, labeling, and commerce laws; and (e) not engage in fraudulent, deceptive, or misleading practices. Numa Fresh reserves the right to suspend or terminate store accounts for violations.`,
  },
  {
    id: 'conduct',
    title: '8. Prohibited Conduct',
    content: `You agree not to: (a) use the Platform for any unlawful purpose; (b) post false, misleading, or defamatory reviews or content; (c) attempt to gain unauthorized access to any part of the Platform or another user's account; (d) use automated tools to scrape, crawl, or extract data from the Platform; (e) interfere with the normal operation of the Platform; or (f) impersonate another person or entity. Violations may result in immediate account termination.`,
  },
  {
    id: 'reviews',
    title: '9. User Reviews & Content',
    content: `By submitting reviews, ratings, or other content on the Platform, you grant Numa Fresh a non-exclusive, royalty-free, perpetual license to use, reproduce, and display such content. You represent that your submissions are honest, based on genuine experiences, and do not violate any third-party rights. Numa Fresh reserves the right to remove any content that violates these Terms or our community standards.`,
  },
  {
    id: 'intellectual-property',
    title: '10. Intellectual Property',
    content: `All content on the Platform, including logos, graphics, text, software, and design elements, is the property of Numa Fresh Inc. or its licensors and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works from Platform content without prior written permission from Numa Fresh Inc.`,
  },
  {
    id: 'privacy',
    title: '11. Privacy',
    content: `Your use of the Platform is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the Platform, you consent to the collection, use, and sharing of your information as described in our Privacy Policy. We are committed to protecting your personal data in accordance with applicable laws, including GDPR and CCPA where applicable.`,
  },
  {
    id: 'disclaimers',
    title: '12. Disclaimers & Limitation of Liability',
    content: `THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. NUMA FRESH DOES NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES. TO THE MAXIMUM EXTENT PERMITTED BY LAW, NUMA FRESH SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE PLATFORM OR ANY PRODUCTS PURCHASED THROUGH IT.`,
  },
  {
    id: 'indemnification',
    title: '13. Indemnification',
    content: `You agree to indemnify, defend, and hold harmless Numa Fresh Inc., its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising from your use of the Platform, your violation of these Terms, or your infringement of any third-party rights.`,
  },
  {
    id: 'governing-law',
    title: '14. Governing Law & Dispute Resolution',
    content: `These Terms are governed by the laws of the Commonwealth of Virginia, United States, without regard to conflict of law principles. Any disputes arising under these Terms shall first be attempted to be resolved through good-faith negotiation. If unresolved, disputes shall be submitted to binding arbitration in Woodbridge, Virginia, in accordance with the rules of the American Arbitration Association, except that either party may seek injunctive relief in a court of competent jurisdiction.`,
  },
  {
    id: 'contact',
    title: '15. Contact Us',
    content: `If you have questions about these Terms of Service, please contact us at:\n\nNuma Fresh Inc.\n4773 Charter Ct, Woodbridge VA, USA\nEmail: numasetup@gmail.com\nPhone: +1 (571) 264-5687`,
  },
];

export default function TermsPage() {
  return (
    <>
      <Helmet>
        <title>Terms of Service — Numa Fresh</title>
        <meta name="description" content="Read the Terms of Service for Numa Fresh, America's halal grocery marketplace." />
      </Helmet>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0D2D22 0%, #1A3D30 100%)' }} className="pt-16 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#3FB196]" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold text-white">Terms of Service</h1>
              <p className="text-white/50 text-sm mt-0.5">Numa Fresh Inc.</p>
            </div>
          </div>
          <p className="text-white/60 text-sm">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Intro */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 mb-8">
          <p className="text-sm text-foreground/80 leading-relaxed">
            Welcome to Numa Fresh. Please read these Terms of Service carefully before using our platform. These Terms govern your access to and use of our halal grocery marketplace services. By using Numa Fresh, you agree to these Terms.
          </p>
        </div>

        {/* Table of contents */}
        <div className="bg-muted/30 rounded-2xl border border-border/50 p-5 mb-10">
          <p className="text-sm font-semibold mb-3">Table of Contents</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {SECTIONS.map(s => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-xs text-primary hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {SECTIONS.map(s => (
            <section key={s.id} id={s.id}>
              <h2 className="font-serif text-xl font-bold mb-3 text-foreground">{s.title}</h2>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {s.content}
              </div>
            </section>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-12 pt-8 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Numa Fresh Inc. · All rights reserved. · <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </>
  );
}
