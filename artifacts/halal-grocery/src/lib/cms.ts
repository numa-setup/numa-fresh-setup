import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface CmsNav {
  mealPlanner: boolean;
  eidSpecials: boolean;
  announcementsEnabled: boolean;
}

export interface CmsAnnouncement {
  id: string;
  text: string;
  code?: string;
  codeLabel?: string;
  linkUrl?: string;
  linkLabel?: string;
  bgFrom?: string;
  bgVia?: string;
  bgTo?: string;
  active: boolean;
}

export interface CmsHeroStore {
  id: string;
  imageUrl: string;
  label: string;
  size?: 'large' | 'small';
  linkUrl?: string;
  active: boolean;
}

export interface CmsFeaturedReview {
  id: string;
  name: string;
  city: string;
  avatar: string;
  rating: number;
  text: string;
  active: boolean;
}

export interface CmsFeaturedProducts {
  visible: boolean;
  kicker: string;
  heading: string;
  subtitle: string;
  productIds: string[];
}

export interface CmsEidSpecials {
  pageActive: boolean;
  eidDate: string;
  heroTitle: string;
  heroArabic: string;
  heroSubtitle: string;
  noticeText: string;
  showCountdown: boolean;
  showPackages: boolean;
  showTips: boolean;
  showStores: boolean;
}

export interface CmsFooterCertificate {
  id: string;
  iconKey: 'shield' | 'award' | 'check' | 'star' | 'leaf';
  label: string;
  sub: string;
  linkUrl?: string;
  active: boolean;
}

export interface CmsSettings {
  'cms.nav': CmsNav;
  'cms.announcements': CmsAnnouncement[];
  'cms.heroStores': CmsHeroStore[];
  'cms.featuredProducts': CmsFeaturedProducts;
  'cms.eidSpecials': CmsEidSpecials;
  'cms.footerCertificates': CmsFooterCertificate[];
  'cms.featuredReviews': CmsFeaturedReview[];
}

// Client-side defaults — match server-side DEFAULTS exactly so SSR/initial render is stable
export const CMS_DEFAULTS: CmsSettings = {
  'cms.nav': { mealPlanner: false, eidSpecials: false, announcementsEnabled: true },
  'cms.announcements': [
    {
      id: 'default-1',
      text: '🎉 Al-Madina Halal — Get 15% off your first order this week!',
      code: 'NUMA15',
      codeLabel: 'Use code',
      linkUrl: '/store/al-madina-halal-mississauga',
      linkLabel: 'Shop Now',
      bgFrom: '#0D3327',
      bgVia: '#1B4D3E',
      bgTo: '#D4AF37',
      active: true,
    },
  ],
  // Mirror the server: no hardcoded hero images. What the admin saves is
  // exactly what shows; nothing else fills in the slots.
  'cms.heroStores': [],
  'cms.featuredProducts': { visible: true, kicker: 'Top Picks', heading: 'Popular Products', subtitle: 'Best sellers from our certified stores', productIds: [] },
  'cms.eidSpecials': {
    pageActive: true, eidDate: '2025-06-07T06:00:00',
    heroTitle: 'Eid Specials & Qurbani', heroArabic: 'عيد مبارك',
    heroSubtitle: 'Pre-order your Qurbani, Eid feast packages, and special cuts. Certified halal — from our stores to your table.',
    noticeText: 'Pre-Order Deadline: Qurbani pre-orders must be placed at least 7 days before Eid. Slots are limited — order now to avoid disappointment.',
    showCountdown: true, showPackages: true, showTips: true, showStores: true,
  },
  'cms.footerCertificates': [
    { id: 'c1', iconKey: 'shield', label: 'ISNA', sub: 'Certified', linkUrl: '', active: true },
    { id: 'c2', iconKey: 'award', label: 'IFANCA', sub: 'Approved', linkUrl: '', active: true },
    { id: 'c3', iconKey: 'check', label: 'Halal', sub: 'Standards', linkUrl: '', active: true },
  ],
  'cms.featuredReviews': [
    { id: 'r1', name: 'Fatima R.', city: 'Houston, TX', avatar: 'F', rating: 5, text: 'Best halal grocery app in the US. Found my favorite cuts in minutes and the curbside pickup was seamless!', active: true },
    { id: 'r2', name: 'Mohammed A.', city: 'Chicago, IL', avatar: 'M', rating: 5, text: 'Fresh lamb, perfectly cut to my specs. The store owner followed my instructions exactly. Highly recommend.', active: true },
    { id: 'r3', name: 'Aisha K.', city: 'Dallas, TX', avatar: 'A', rating: 5, text: 'The loyalty rewards add up so fast. I got my last order almost free. This app has changed how I shop.', active: true },
  ],
};

export function useCms() {
  const query = useQuery<CmsSettings>({
    queryKey: ['cms', 'site'],
    queryFn: () => api.get<CmsSettings>('/cms/site'),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return query.data ?? CMS_DEFAULTS;
}

/** Same as useCms() but also returns whether the first fetch has resolved.
 *  Use this on pages that need to gate render on real CMS values (e.g. Eid page). */
export function useCmsWithStatus() {
  const query = useQuery<CmsSettings>({
    queryKey: ['cms', 'site'],
    queryFn: () => api.get<CmsSettings>('/cms/site'),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  return {
    cms: query.data ?? CMS_DEFAULTS,
    isLoaded: query.isFetched && !query.isLoading,
  };
}

export async function updateCms<K extends keyof CmsSettings>(
  key: K,
  value: CmsSettings[K]
): Promise<void> {
  // key looks like "cms.nav" — strip "cms." prefix for the URL
  const short = String(key).replace(/^cms\./, '');
  await api.put(`/cms/admin/${short}`, value);
}
