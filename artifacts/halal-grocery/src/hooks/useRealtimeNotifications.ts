import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { connectForRole, type Role } from "@/lib/socket";
import { useLocation } from "wouter";

/**
 * Top-level realtime bridge: opens one socket per logged-in session, wires
 * role-specific events to toasts and React Query cache invalidations.
 *
 * Recreates the socket whenever the access token rotates so it never holds a
 * stale credential.
 */
export function useRealtimeNotifications() {
  const { user, isAuthenticated, accessToken } = useAuth();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated || !user?.role || !accessToken) return;
    const role = user.role as Role;
    const handle = connectForRole(role);
    if (!handle) return;
    const { socket } = handle;

    // ─── Shared: CMS content changes (admin saves) ──────────────────
    const onCmsUpdated = () => {
      qc.invalidateQueries({ queryKey: ["cms"] });
    };
    socket.on("cms_updated", onCmsUpdated);

    const cleanups: Array<() => void> = [
      () => socket.off("cms_updated", onCmsUpdated),
    ];

    if (role === "STORE_OWNER") {
      // Server auto-joins `store:{storeId}` rooms on connect for owners,
      // so all `emitToStore(...)` events reach this socket.
      const onNewOrder = (data: { orderId?: string; total?: number }) => {
        toast.success("New order received!", {
          description: data?.total ? `Order total: $${Number(data.total).toFixed(2)}` : undefined,
        });
        qc.invalidateQueries({ queryKey: ["portal"] });
        qc.invalidateQueries({ queryKey: ["store-portal", "orders"] });
      };
      const onCustomerArrived = (data: { vehicleInfo?: string }) => {
        toast.info("Customer arrived for pickup", {
          description: data?.vehicleInfo || "Customer is here for curbside pickup",
        });
        qc.invalidateQueries({ queryKey: ["portal"] });
      };
      const onProductApproved = () => {
        toast.success("Product approved by admin");
        qc.invalidateQueries({ queryKey: ["portal", "products"] });
        qc.invalidateQueries({ queryKey: ["portal", "inventory"] });
        qc.invalidateQueries({ queryKey: ["products"] });
      };
      const onProductRejected = (data: { reason?: string }) => {
        toast.error("Product rejected", { description: data?.reason });
        qc.invalidateQueries({ queryKey: ["portal", "products"] });
      };
      const onStoreStatusChanged = () => {
        toast.info("Your store status was updated");
        qc.invalidateQueries({ queryKey: ["portal"] });
        qc.invalidateQueries({ queryKey: ["stores"] });
      };

      socket.on("new_order", onNewOrder);
      socket.on("customer_arrived", onCustomerArrived);
      socket.on("product_approved", onProductApproved);
      socket.on("product_rejected", onProductRejected);
      socket.on("store_status_changed", onStoreStatusChanged);

      cleanups.push(
        () => socket.off("new_order", onNewOrder),
        () => socket.off("customer_arrived", onCustomerArrived),
        () => socket.off("product_approved", onProductApproved),
        () => socket.off("product_rejected", onProductRejected),
        () => socket.off("store_status_changed", onStoreStatusChanged),
      );
    }

    if (role === "ADMIN") {
      // Admin namespace auto-joins `admin_global` server-side, so emitToAdmin(...)
      // reaches this socket without any client-side join.
      const onNewOrder = () => {
        toast.success("New order placed");
        qc.invalidateQueries({ queryKey: ["admin"] });
        qc.invalidateQueries({ queryKey: ["orders"] });
      };
      const onNewStoreApplication = (data?: { storeName?: string; ownerName?: string }) => {
        const title = data?.storeName
          ? `New store application: ${data.storeName}`
          : "New store application";
        const description = data?.ownerName
          ? `From ${data.ownerName} — awaiting your review`
          : "A vendor is awaiting approval";
        toast.info(title, {
          description,
          duration: 8000,
          action: {
            label: "Review",
            onClick: () => setLocation("/admin/stores?status=pending"),
          },
        });
        qc.invalidateQueries({ queryKey: ["admin"] });
        qc.invalidateQueries({ queryKey: ["stores"] });
      };
      const onNewProductPending = () => {
        toast.info("New product awaiting review");
        qc.invalidateQueries({ queryKey: ["admin", "products", "pending"] });
        qc.invalidateQueries({ queryKey: ["admin"] });
      };
      const onOrderStatusChanged = () => {
        qc.invalidateQueries({ queryKey: ["admin"] });
      };

      socket.on("new_order", onNewOrder);
      socket.on("new_store_application", onNewStoreApplication);
      socket.on("new_product_pending", onNewProductPending);
      socket.on("order_status_changed", onOrderStatusChanged);

      cleanups.push(
        () => socket.off("new_order", onNewOrder),
        () => socket.off("new_store_application", onNewStoreApplication),
        () => socket.off("new_product_pending", onNewProductPending),
        () => socket.off("order_status_changed", onOrderStatusChanged),
      );
    }

    if (role === "CUSTOMER") {
      const onProductStockUpdated = () => {
        qc.invalidateQueries({ queryKey: ["products"] });
      };
      const onUserBanned = () => {
        toast.error("Your account has been suspended", {
          description: "Please contact support for more information.",
          duration: 10000,
        });
      };
      socket.on("product_stock_updated", onProductStockUpdated);
      socket.on("user_banned", onUserBanned);
      cleanups.push(
        () => socket.off("product_stock_updated", onProductStockUpdated),
        () => socket.off("user_banned", onUserBanned),
      );
    }

    return () => {
      cleanups.forEach((fn) => fn());
      handle.release();
    };
  }, [isAuthenticated, user?.role, accessToken, qc]);
}
