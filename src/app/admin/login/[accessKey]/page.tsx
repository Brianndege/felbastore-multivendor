import { redirect } from "next/navigation";
import { AdminKeyLoginForm } from "./AdminKeyLoginForm";
import { ensureAdminSecuritySchemaCompatibility, findValidAdminAccessKey } from "@/lib/admin/security-auth";

export default async function AdminSecureLoginPage({ params }: { params: Promise<{ accessKey: string }> }) {
  const { accessKey } = await params;

  await ensureAdminSecuritySchemaCompatibility();
  const access = await findValidAdminAccessKey(accessKey || "");

  if (!access) {
    redirect("/");
  }

  return <AdminKeyLoginForm accessKey={accessKey} accessKeyExpiresAt={access.expiresAt.toISOString()} />;
}
