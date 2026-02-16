import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, {});
  if (!session || session.user.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Parse query parameters for filtering
  const {
    startDate,
    endDate,
    status,
    paymentStatus,
    format = "csv"
  } = req.query;

  const filters: any = {};

  // Apply date filters if provided
  if (startDate && typeof startDate === 'string') {
    filters.createdAt = {
      ...(filters.createdAt || {}),
      gte: new Date(startDate)
    };
  }

  if (endDate && typeof endDate === 'string') {
    filters.createdAt = {
      ...(filters.createdAt || {}),
      lte: new Date(endDate)
    };
  }

  // Apply status filter if provided
  if (status && typeof status === 'string') {
    filters.status = status;
  }

  // Apply payment status filter if provided
  if (paymentStatus && typeof paymentStatus === 'string') {
    filters.paymentStatus = paymentStatus;
  }

  try {
    // Fetch orders with filters
    const orders = await prisma.order.findMany({
      where: filters,
      include: {
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            vendor: {
              select: {
                id: true,
                name: true,
                storeName: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // If no orders found
    if (orders.length === 0) {
      return res.status(404).json({ error: "No orders found matching the criteria" });
    }

    // Generate CSV
    if (format === 'csv') {
      const csvRows = [];

      // Add CSV header
      csvRows.push([
        'Order ID',
        'Order Number',
        'Customer Name',
        'Customer Email',
        'Date',
        'Status',
        'Payment Status',
        'Payment Method',
        'Total Amount',
        'Number of Items',
        'Shipping Address',
        'Billing Address'
      ].join(','));

      // Add order data
      for (const order of orders) {
        let shippingAddressStr = '';
        let billingAddressStr = '';

        try {
          const shippingAddress = JSON.parse(order.shippingAddress);
          shippingAddressStr = `${shippingAddress.address}, ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}`;

          const billingAddress = JSON.parse(order.billingAddress);
          billingAddressStr = `${billingAddress.address}, ${billingAddress.city}, ${billingAddress.state} ${billingAddress.zipCode}`;
        } catch (e) {
          console.error('Error parsing address:', e);
        }

        // Escape fields that might contain commas
        const escapeCsv = (field: string) => {
          if (!field) return '';
          // If the field contains a comma, quote, or newline, wrap it in quotes
          if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            // Replace any quotes with double quotes to escape them
            return `"${field.replace(/"/g, '""')}"`;
          }
          return field;
        };

        csvRows.push([
          order.id,
          order.orderNumber,
          escapeCsv(order.user?.name || ''),
          escapeCsv(order.user?.email || ''),
          new Date(order.createdAt).toISOString(),
          order.status,
          order.paymentStatus,
          order.paymentMethod || '',
          order.totalAmount.toString(),
          order.orderItems.length.toString(),
          escapeCsv(shippingAddressStr),
          escapeCsv(billingAddressStr)
        ].join(','));
      }

      // Generate CSV content
      const csvContent = csvRows.join('\n');

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=orders-export-${new Date().toISOString().slice(0, 10)}.csv`);

      return res.status(200).send(csvContent);
    }

    // Default JSON response if format is not csv
    return res.status(200).json({ orders });
  } catch (error) {
    console.error("Error exporting orders:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error"
    });
  }
}
