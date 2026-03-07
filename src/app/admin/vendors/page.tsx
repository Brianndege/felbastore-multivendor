import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { ensureVendorFeaturedSchemaCompatibility } from "@/lib/admin/vendor-featured";
import FeaturedVendorToggle from "./FeaturedVendorToggle";
import { updateVendorFeaturedAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminVendorManagementPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/login?callbackUrl=/admin/vendors");
  }

  if (session.user.role !== "admin") {
    redirect("/");
  }

  await ensureVendorFeaturedSchemaCompatibility();

  const vendors = await prisma.vendor.findMany({
    select: {
      id: true,
      storeName: true,
      email: true,
      featured: true,
    },
    orderBy: [
      { featured: "desc" },
      { storeName: "asc" },
    ],
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 md:py-8">
      <Card>
        <CardHeader>
          <CardTitle>Vendor Management</CardTitle>
          <CardDescription>
            Manage which vendors are featured across marketplace surfaces.
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">Total: {vendors.length}</Badge>
            <Badge variant="outline">Featured: {vendors.filter((vendor) => vendor.featured).length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="table-scroll overflow-x-auto rounded border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Store Name</th>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-left font-medium">Featured</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{vendor.storeName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{vendor.email}</td>
                    <td className="px-3 py-2">
                      <FeaturedVendorToggle
                        vendorId={vendor.id}
                        featured={vendor.featured}
                        updateAction={updateVendorFeaturedAction}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
