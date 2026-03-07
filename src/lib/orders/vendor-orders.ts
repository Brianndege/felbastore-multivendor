import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";
import { ensureOrderLifecycleSchemaCompatibility } from "@/lib/orders/schema-compat";

type VendorOrderRow = {
  id: string;
  orderNumber: string;
  customerId: string;
  vendorId: string;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: string;
  shippingProvider: string | null;
  trackingNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getVendorOrders(status?: OrderStatus): Promise<VendorOrderRow[]> {
  await ensureOrderLifecycleSchemaCompatibility();

  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "vendor") {
    throw new Error("Unauthorized");
  }

  const vendorId = session.user.id;
  const rows = await prisma.orderVendorFulfillment.findMany({
    where: {
      vendorId,
      ...(status ? { orderStatus: status } : {}),
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          totalAmount: true,
          paymentStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return rows.map((row: any) => ({
    id: row.order.id,
    orderNumber: row.order.orderNumber,
    customerId: row.order.userId,
    vendorId: row.vendorId,
    totalAmount: Number(row.order.totalAmount),
    status: row.orderStatus,
    paymentStatus: row.order.paymentStatus,
    shippingProvider: row.shippingProvider || null,
    trackingNumber: row.trackingNumber || null,
    createdAt: row.order.createdAt,
    updatedAt: row.order.updatedAt,
  }));
}
