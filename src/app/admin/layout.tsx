import type { ReactNode } from "react";
import { AdminSessionGuard } from "@/components/admin/AdminSessionGuard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminSessionGuard />
      {children}
    </>
  );
}
