"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

const prismaUnsafe = prisma as any;

const VendorOrderSchema = z.object({
  id: z.string().min(1),
  orderNumber: z.string().min(1),
  status: z.string().min(1),
  shippingStatus: z.string().min(1),
  paymentStatus: z.string().min(1),
  createdAt: z.date(),
  totalAmount: z.number(),
  vendorAmount: z.number(),
  itemCount: z.number().int().nonnegative(),
  currency: z.string().min(1),
  customer: z.object({
    name: z.string().min(1),
    email: z.string(),
  }),
  canUpdateStatus: z.boolean(),
});

export type VendorOrderActionItem = z.infer<typeof VendorOrderSchema>;

type FetchVendorOrdersResult =
  | { ok: true; orders: VendorOrderActionItem[]; skippedOrders: number }
  | { ok: false; error: string; code: string };

function normalizeLifecycleStatus(value: unknown, fallback = "pending") {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized || fallback;
}

function deriveShippingStatus(orderStatus: string) {
  if (orderStatus === "shipped") return "shipped";
  if (orderStatus === "in_transit") return "in_transit";
  if (orderStatus === "delivered") return "delivered";
  return "pending";
}

export async function fetchVendorOrdersAction(input?: { status?: string }): Promise<FetchVendorOrdersResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "vendor") {
    return { ok: false, error: "Unauthorized", code: "UNAUTHORIZED" };
  }

  const vendorId = typeof session.user.id === "string" ? session.user.id.trim() : "";
  if (!vendorId) {
    return { ok: false, error: "Invalid vendor session", code: "INVALID_VENDOR_SESSION" };
  }

  const requestedStatus = typeof input?.status === "string" ? input.status.trim().toLowerCase() : "";

  try {
    const orders = await prismaUnsafe.order.findMany({
      where: {
        orderItems: {
          some: {
            vendorId,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
          },
        },
        orderItems: {
          include: {
            product: {
              select: {
                currency: true,
              },
            },
          },
        },
        vendorFulfillments: {
          where: { vendorId },
          take: 1,
        },
      },
      take: 100,
    });

    const mapped: VendorOrderActionItem[] = [];
    let skippedOrders = 0;

    for (const order of orders as any[]) {
      try {
        const vendorItems = Array.isArray(order.orderItems)
          ? order.orderItems.filter((item: any) => item?.vendorId === vendorId)
          : [];

        const status = normalizeLifecycleStatus(
          order.vendorFulfillments?.[0]?.orderStatus,
          normalizeLifecycleStatus(order.status, "pending")
        );

        const candidate = {
          id: order.id,
          orderNumber: order.orderNumber,
          status,
          shippingStatus: normalizeLifecycleStatus(
            order.vendorFulfillments?.[0]?.shippingStatus,
            deriveShippingStatus(status)
          ),
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
          totalAmount: Number(order.totalAmount),
          vendorAmount: Number(
            vendorItems
              .reduce((sum: number, item: any) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
              .toFixed(2)
          ),
          itemCount: vendorItems.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0),
          currency: vendorItems[0]?.product?.currency || "KES",
          customer: {
            name: order.customer?.name || "Deleted User",
            email: order.customer?.email || "",
          },
          canUpdateStatus: Array.isArray(order.orderItems)
            ? order.orderItems.every((item: any) => item?.vendorId === vendorId)
            : false,
        };

        const parsed = VendorOrderSchema.safeParse(candidate);
        if (!parsed.success) {
          skippedOrders += 1;
          console.error("[fetchVendorOrdersAction] Invalid order payload", {
            orderId: order.id,
            vendorId,
            issues: parsed.error.issues,
          });
          continue;
        }

        if (requestedStatus && requestedStatus !== "all" && parsed.data.status !== requestedStatus) {
          continue;
        }

        mapped.push(parsed.data);
      } catch (rowError) {
        skippedOrders += 1;
        console.error("[fetchVendorOrdersAction] Failed to map order", {
          orderId: order.id,
          vendorId,
          reason: rowError instanceof Error ? rowError.message : "unknown_row_error",
        });
      }
    }

    return { ok: true, orders: mapped, skippedOrders };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[fetchVendorOrdersAction] Prisma known request error", {
        code: error.code,
        message: error.message,
        vendorId,
        requestedStatus,
      });
    } else if (error instanceof Prisma.PrismaClientValidationError) {
      console.error("[fetchVendorOrdersAction] Prisma validation error", {
        message: error.message,
        vendorId,
        requestedStatus,
      });
    } else {
      console.error("[fetchVendorOrdersAction] Unexpected error", {
        vendorId,
        requestedStatus,
        reason: error instanceof Error ? error.message : "unknown_error",
      });
    }

    return {
      ok: false,
      error: "Failed to fetch vendor orders",
      code: "VENDOR_ORDERS_FETCH_FAILED",
    };
  }
}
