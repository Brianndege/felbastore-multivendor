import { redirect } from "next/navigation";
import { AdminKeyLoginForm } from "./AdminKeyLoginForm";
import { ensureAdminSecuritySchemaCompatibility, findValidAdminAccessKey } from "@/lib/admin/security-auth";

export default async function AdminSecureLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ accessKey: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const { accessKey } = await params;
  const { email } = await searchParams;

  await ensureAdminSecuritySchemaCompatibility();
  const access = await findValidAdminAccessKey(accessKey || "");

  if (!access) {
    redirect("/");
  }

  return (
    <AdminKeyLoginForm
      accessKey={accessKey}
      accessKeyExpiresAt={access.expiresAt.toISOString()}
      prefilledEmail={typeof email === "string" ? email.trim().toLowerCase() : ""}
    />
  );
}
