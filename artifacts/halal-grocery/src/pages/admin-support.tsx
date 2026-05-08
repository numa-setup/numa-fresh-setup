import { AdminLayout } from "@/components/admin/AdminLayout";
import { HeadsetIcon } from "lucide-react";

export default function AdminSupportPage() {
  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Support</h1>
          <p className="text-muted-foreground mt-1">Manage customer and store owner support requests</p>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <HeadsetIcon className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Support Center</h2>
          <p className="text-muted-foreground max-w-sm">
            Support ticket management is coming soon. Customer and store queries will appear here.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
