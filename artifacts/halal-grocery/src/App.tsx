import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ContactUs } from "@/components/layout/ContactUs";
import { BottomNav } from "@/components/layout/BottomNav";
import { CookieConsent } from "@/components/CookieConsent";
import { FloatingCartBar } from "@/components/FloatingCartBar";
import { lazy, Suspense, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { PortalLayout } from "@/components/portal/PortalLayout";

// Customer-facing pages (lazy-loaded)
const HomePage = lazy(() => import("@/pages/home"));
const StoreDetailPage = lazy(() => import("@/pages/store-detail"));
const CartPage = lazy(() => import("@/pages/cart"));
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const LoginPage = lazy(() => import("@/pages/login"));
const StoreLoginPage = lazy(() => import("@/pages/store-login"));
const AdminLoginPage = lazy(() => import("@/pages/admin-login"));
const SignupPage = lazy(() => import("@/pages/signup"));
const CreateAccountPage = lazy(() => import("@/pages/create-account"));
const OrdersPage = lazy(() => import("@/pages/orders"));
const OrderDetailPage = lazy(() => import("@/pages/order-detail"));
const OrderTrackingPage = lazy(() => import("@/pages/order-tracking"));
const AccountPage = lazy(() => import("@/pages/account"));
const AccountAddressesPage = lazy(() => import("@/pages/account-addresses"));
const AccountNotificationsPage = lazy(() => import("@/pages/account-notifications"));
const AccountScheduledOrdersPage = lazy(() => import("@/pages/account-scheduled-orders"));
const AccountSavedPage = lazy(() => import("@/pages/account-saved"));
const PrivacyPage = lazy(() => import("@/pages/privacy"));
const TermsPage = lazy(() => import("@/pages/terms"));
const ProductDetailPage = lazy(() => import("@/pages/product-detail"));
const ProductsPage = lazy(() => import("@/pages/products"));
const StoresPage = lazy(() => import("@/pages/stores"));

// Admin Panel pages — self-contained with AdminLayout (no Navbar/Footer)
const AdminPage = lazy(() => import("@/pages/admin"));
const AdminStoresPage = lazy(() => import("@/pages/admin-stores"));
const AdminStoresNewPage = lazy(() => import("@/pages/admin-stores-new"));
const AdminStoreEditPage = lazy(() => import("@/pages/admin-store-edit"));
const AdminOrdersPage = lazy(() => import("@/pages/admin-orders"));
const AdminUsersPage = lazy(() => import("@/pages/admin-users"));
const AdminFinancePage = lazy(() => import("@/pages/admin-finance"));
const AdminAnalyticsPage = lazy(() => import("@/pages/admin-analytics"));
const AdminSettingsPage = lazy(() => import("@/pages/admin-settings"));
const AdminSupportPage = lazy(() => import("@/pages/admin-support"));
const AdminAuditPage = lazy(() => import("@/pages/admin-audit"));
const AdminContentPage = lazy(() => import("@/pages/admin-content"));
const AdminWebsitePage = lazy(() => import("@/pages/admin-website"));
const AdminReviewsPage = lazy(() => import("@/pages/admin-reviews"));
const AdminSiteReviewsPage = lazy(() => import("@/pages/admin-site-reviews"));
const AdminProductsPendingPage = lazy(() => import("@/pages/admin-products-pending"));
const AdminProductsPage = lazy(() => import("@/pages/admin-products"));
const NotFound = lazy(() => import("@/pages/not-found"));
const PickupVerifyPage = lazy(() => import("@/pages/pickup-verify"));

// Store Portal pages — use PortalLayout internally, NOT AppLayout
const StorePortalDashboard = lazy(() => import("@/pages/store-portal"));
const StorePortalOrders = lazy(() => import("@/pages/store-portal-orders"));
const StorePortalOrder = lazy(() => import("@/pages/store-portal-order"));
const StorePortalProducts = lazy(() => import("@/pages/store-portal-products"));
const StorePortalInventory = lazy(() => import("@/pages/store-portal-inventory"));
const StorePortalAnalytics = lazy(() => import("@/pages/store-portal-analytics"));
const StorePortalPayouts = lazy(() => import("@/pages/store-portal-payouts"));
const StorePortalOnboarding = lazy(() => import("@/pages/store-portal-onboarding"));
const StorePortalSettings = lazy(() => import("@/pages/store-portal-settings"));
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl hg-gradient-primary flex items-center justify-center animate-pulse">
          <span className="text-white font-bold font-serif">حل</span>
        </div>
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location]);
  return null;
}

function AdminGuard({ page: Page }: { page: React.ComponentType }) {
  const { user } = useAuth();
  if (!user || user.role !== 'ADMIN') return <AdminLoginPage />;
  return <Page />;
}

function PortalGuard({ page: Page }: { page: React.ComponentType }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (user?.role === 'ADMIN') setLocation('/admin');
  }, [user?.role]);
  if (!user || (user.role !== 'STORE_OWNER' && user.role !== 'STORE_STAFF')) {
    return <StoreLoginPage />;
  }
  return <Page />;
}

function AdminRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation('/admin'); }, []);
  return null;
}

// ── AdminShell ────────────────────────────────────────────────────────────────
// Renders AdminLayout ONCE so the sidebar never unmounts on tab switches.
// Every /admin/* route resolves inside this single shell.
function AdminShell() {
  const { user } = useAuth();
  if (!user || user.role !== 'ADMIN') return <AdminLoginPage />;
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin/stores/:id/edit" component={AdminStoreEditPage} />
        <Route path="/admin/stores/new" component={AdminStoresNewPage} />
        <Route path="/admin/stores" component={AdminStoresPage} />
        <Route path="/admin/orders" component={AdminOrdersPage} />
        <Route path="/admin/users" component={AdminUsersPage} />
        <Route path="/admin/products/pending" component={AdminProductsPendingPage} />
        <Route path="/admin/products" component={AdminProductsPage} />
        <Route path="/admin/finance" component={AdminFinancePage} />
        <Route path="/admin/analytics" component={AdminAnalyticsPage} />
        <Route path="/admin/settings" component={AdminSettingsPage} />
        <Route path="/admin/support" component={AdminSupportPage} />
        <Route path="/admin/audit" component={AdminAuditPage} />
        <Route path="/admin/reviews" component={AdminReviewsPage} />
        <Route path="/admin/site-reviews" component={AdminSiteReviewsPage} />
        <Route path="/admin/content" component={AdminContentPage} />
        <Route path="/admin/website" component={AdminWebsitePage} />
        <Route component={AdminPage} />
      </Switch>
    </AdminLayout>
  );
}

// ── PortalShell ───────────────────────────────────────────────────────────────
// Renders PortalLayout ONCE so the sidebar never unmounts on tab switches.
// Every /store-portal/* route resolves inside this single shell.
function PortalShell() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (user?.role === 'ADMIN') setLocation('/admin');
  }, [user?.role]);
  if (!user || (user.role !== 'STORE_OWNER' && user.role !== 'STORE_STAFF')) {
    return <StoreLoginPage />;
  }
  return (
    <PortalLayout>
      <Switch>
        <Route path="/store-portal/orders/:id" component={StorePortalOrder} />
        <Route path="/store-portal/orders" component={StorePortalOrders} />
        <Route path="/store-portal/products" component={StorePortalProducts} />
        <Route path="/store-portal/inventory" component={StorePortalInventory} />
        <Route path="/store-portal/analytics" component={StorePortalAnalytics} />
        <Route path="/store-portal/payouts" component={StorePortalPayouts} />
        <Route path="/store-portal/onboarding" component={StorePortalOnboarding} />
        <Route path="/store-portal/settings" component={StorePortalSettings} />
        <Route component={StorePortalDashboard} />
      </Switch>
    </PortalLayout>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <BottomNav />
      <FloatingCartBar />
    </div>
  );
}

function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">{children}</main>
      <ContactUs />
      <Footer />
      <BottomNav />
      <FloatingCartBar />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ScrollToTop />
      <Switch>
        {/* ── Store Owner Portal — single PortalShell owns the layout; sidebar never remounts ── */}
        <Route path="/store-portal" component={PortalShell} />
        <Route path="/store-portal/*" component={PortalShell} />

        {/* ── Public / Customer pages (wrapped in AppLayout) ── */}
        <Route path="/" component={() => <HomeLayout><HomePage /></HomeLayout>} />
        <Route path="/stores" component={() => <AppLayout><StoresPage /></AppLayout>} />
        <Route path="/stores/:storeSlug" component={() => <AppLayout><StoreDetailPage /></AppLayout>} />
        <Route path="/store/:storeSlug" component={() => <AppLayout><StoreDetailPage /></AppLayout>} />
        <Route path="/store/:storeSlug/:productSlug" component={() => <AppLayout><ProductDetailPage /></AppLayout>} />
        <Route path="/products" component={() => <AppLayout><ProductsPage /></AppLayout>} />
        <Route path="/products/:slug" component={() => <AppLayout><ProductDetailPage /></AppLayout>} />
        <Route path="/privacy" component={() => <AppLayout><PrivacyPage /></AppLayout>} />
        <Route path="/terms" component={() => <AppLayout><TermsPage /></AppLayout>} />

        {/* Public pickup verification — standalone, no Navbar/Footer, works on any phone */}
        <Route path="/pickup/verify/:orderId" component={PickupVerifyPage} />

        {/* Auth — standalone pages (no Navbar/Footer) */}
        <Route path="/login" component={LoginPage} />
        <Route path="/store-login" component={StoreLoginPage} />
        <Route path="/seller/login" component={StoreLoginPage} />
        <Route path="/seller" component={StoreLoginPage} />
        <Route path="/admin-login" component={AdminRedirect} />
        <Route path="/signup" component={CreateAccountPage} />
        <Route path="/signin" component={LoginPage} />
        <Route path="/get-started" component={CreateAccountPage} />
        <Route path="/create-account" component={CreateAccountPage} />
        <Route path="/sign-up" component={CreateAccountPage} />

        {/* Customer account */}
        <Route path="/cart" component={() => <AppLayout><CartPage /></AppLayout>} />
        <Route path="/checkout" component={() => <AppLayout><CheckoutPage /></AppLayout>} />
        <Route path="/orders" component={() => <AppLayout><OrdersPage /></AppLayout>} />
        <Route path="/orders/:orderId/track" component={() => <AppLayout><OrderTrackingPage /></AppLayout>} />
        <Route path="/orders/:orderId" component={() => <AppLayout><OrderDetailPage /></AppLayout>} />
        <Route path="/account" component={() => <AppLayout><AccountPage /></AppLayout>} />
        <Route path="/account/addresses" component={() => <AppLayout><AccountAddressesPage /></AppLayout>} />
        <Route path="/account/notifications" component={() => <AppLayout><AccountNotificationsPage /></AppLayout>} />
        <Route path="/account/scheduled-orders" component={() => <AppLayout><AccountScheduledOrdersPage /></AppLayout>} />
        <Route path="/account/saved" component={() => <AppLayout><AccountSavedPage /></AppLayout>} />

        {/* ── Admin Panel — single AdminShell owns the layout; sidebar never remounts ── */}
        <Route path="/admin" component={AdminShell} />
        <Route path="/admin/*" component={AdminShell} />

        {/* 404 */}
        <Route component={() => <AppLayout><NotFound /></AppLayout>} />
      </Switch>
    </Suspense>
  );
}

function RealtimeBridge() {
  useRealtimeNotifications();
  return null;
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CartProvider>
            <TooltipProvider>
              <RealtimeBridge />
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
                <CookieConsent />
              </WouterRouter>
              <Toaster richColors position="top-center" />
            </TooltipProvider>
          </CartProvider>
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
