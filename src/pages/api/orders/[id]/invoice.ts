import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid order ID" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Find the order with its items, user, and vendor details
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        orderItems: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
            vendor: {
              select: {
                name: true,
                storeName: true,
                address: true,
                city: true,
                country: true,
                zipCode: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if user is authorized to view this order
    const isAuthorized =
      order.userId === session.user.id ||
      session.user.role === "admin" ||
      (session.user.role === "vendor" &&
        order.orderItems.some(item => item.vendorId === session.user.id));

    if (!isAuthorized) {
      return res.status(403).json({ error: "Not authorized to view this order" });
    }

    // Parse addresses
    let shippingAddress;
    let billingAddress;

    try {
      shippingAddress = JSON.parse(order.shippingAddress);
    } catch (e) {
      shippingAddress = { error: "Invalid shipping address format" };
    }

    try {
      billingAddress = JSON.parse(order.billingAddress);
    } catch (e) {
      billingAddress = { error: "Invalid billing address format" };
    }

    // Format date
    const orderDate = new Date(order.createdAt);
    const formattedDate = orderDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Calculate totals
    const subtotal = Number(order.totalAmount) - Number(order.taxAmount) - Number(order.shippingAmount);

    // Generate invoice number
    const invoiceNumber = `INV-${order.orderNumber}`;

    // Prepare invoice data
    const invoice = {
      invoiceNumber,
      orderNumber: order.orderNumber,
      invoiceDate: formattedDate,
      orderDate: formattedDate,
      customerInfo: {
        name: order.user?.name || 'Customer',
        email: order.user?.email || '',
        shippingAddress,
        billingAddress,
      },
      items: order.orderItems.map(item => ({
        name: item.productName || item.product.name,
        sku: item.product.sku || 'N/A',
        quantity: item.quantity,
        price: Number(item.price),
        total: item.quantity * Number(item.price),
        vendor: item.vendor.storeName || item.vendor.name,
      })),
      totals: {
        subtotal,
        shipping: Number(order.shippingAmount),
        tax: Number(order.taxAmount),
        discount: Number(order.discountAmount),
        total: Number(order.totalAmount),
      },
      payment: {
        status: order.paymentStatus,
        method: order.paymentMethod || 'Unknown',
        transactionId: order.paymentIntentId || 'N/A',
      },
      notes: order.notes || '',
      storeInfo: {
        name: "Felba Store",
        address: "123 Commerce St",
        city: "Nairobi",
        country: "Kenya",
        email: "support@felbastore.co.ke",
        phone: "+254 700 000000",
        website: "https://felbastore.co.ke",
      },
    };

    // Generate HTML invoice
    if (req.query.format === 'html') {
      const htmlInvoice = generateHtmlInvoice(invoice);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(htmlInvoice);
    }

    // Return JSON by default
    return res.status(200).json(invoice);
  } catch (error) {
    console.error("Error generating invoice:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

function generateHtmlInvoice(invoice: any): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice #${invoice.invoiceNumber}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          color: #333;
        }
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .invoice-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
        }
        .invoice-title {
          font-size: 24px;
          font-weight: bold;
          color: #e16b22;
        }
        .invoice-details {
          margin-top: 10px;
          font-size: 14px;
        }
        .invoice-section {
          margin-bottom: 30px;
        }
        .section-title {
          font-weight: bold;
          margin-bottom: 10px;
          border-bottom: 1px solid #eee;
          padding-bottom: 5px;
        }
        .address-container {
          display: flex;
          justify-content: space-between;
        }
        .address-box {
          width: 45%;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th {
          background-color: #f8f8f8;
          text-align: left;
          padding: 10px;
        }
        td {
          padding: 10px;
          border-bottom: 1px solid #eee;
        }
        .text-right {
          text-align: right;
        }
        .totals-table {
          width: 40%;
          margin-left: auto;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
        }
        .total-amount {
          font-weight: bold;
        }
        .payment-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          margin-top: 5px;
        }
        .paid {
          background-color: #e6f7e6;
          color: #2e7d32;
        }
        .pending {
          background-color: #fff8e1;
          color: #ff8f00;
        }
        .failed {
          background-color: #fbe9e7;
          color: #d32f2f;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 12px;
          color: #888;
          border-top: 1px solid #eee;
          padding-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="invoice-header">
          <div>
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-details">
              <div><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</div>
              <div><strong>Invoice Date:</strong> ${invoice.invoiceDate}</div>
              <div><strong>Order Number:</strong> ${invoice.orderNumber}</div>
            </div>
          </div>
          <div>
            <div><strong>${invoice.storeInfo.name}</strong></div>
            <div>${invoice.storeInfo.address}</div>
            <div>${invoice.storeInfo.city}, ${invoice.storeInfo.country}</div>
            <div>${invoice.storeInfo.email}</div>
            <div>${invoice.storeInfo.phone}</div>
          </div>
        </div>

        <div class="invoice-section">
          <div class="address-container">
            <div class="address-box">
              <div class="section-title">Bill To</div>
              <div>${invoice.customerInfo.name}</div>
              <div>${invoice.customerInfo.email}</div>
              <div>${invoice.customerInfo.billingAddress.address}</div>
              <div>${invoice.customerInfo.billingAddress.city}, ${invoice.customerInfo.billingAddress.state} ${invoice.customerInfo.billingAddress.zipCode}</div>
              <div>${invoice.customerInfo.billingAddress.country}</div>
            </div>
            <div class="address-box">
              <div class="section-title">Ship To</div>
              <div>${invoice.customerInfo.name}</div>
              <div>${invoice.customerInfo.shippingAddress.address}</div>
              <div>${invoice.customerInfo.shippingAddress.city}, ${invoice.customerInfo.shippingAddress.state} ${invoice.customerInfo.shippingAddress.zipCode}</div>
              <div>${invoice.customerInfo.shippingAddress.country}</div>
              <div>${invoice.customerInfo.shippingAddress.phone || ''}</div>
            </div>
          </div>
        </div>

        <div class="invoice-section">
          <div class="section-title">Order Items</div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>SKU</th>
                <th>Vendor</th>
                <th>Qty</th>
                <th>Price</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.sku}</td>
                  <td>${item.vendor}</td>
                  <td>${item.quantity}</td>
                  <td>$${item.price.toFixed(2)}</td>
                  <td class="text-right">$${item.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="invoice-section">
          <div class="totals-table">
            <div class="totals-row">
              <div>Subtotal</div>
              <div>$${invoice.totals.subtotal.toFixed(2)}</div>
            </div>
            <div class="totals-row">
              <div>Shipping</div>
              <div>$${invoice.totals.shipping.toFixed(2)}</div>
            </div>
            <div class="totals-row">
              <div>Tax</div>
              <div>$${invoice.totals.tax.toFixed(2)}</div>
            </div>
            ${invoice.totals.discount > 0 ? `
              <div class="totals-row">
                <div>Discount</div>
                <div>-$${invoice.totals.discount.toFixed(2)}</div>
              </div>
            ` : ''}
            <div class="totals-row total-amount">
              <div>Total</div>
              <div>$${invoice.totals.total.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div class="invoice-section">
          <div class="section-title">Payment Information</div>
          <div>Payment Method: ${invoice.payment.method}</div>
          <div>Transaction ID: ${invoice.payment.transactionId}</div>
          <div>
            Status:
            <span class="payment-badge ${invoice.payment.status.toLowerCase()}">
              ${invoice.payment.status.charAt(0).toUpperCase() + invoice.payment.status.slice(1)}
            </span>
          </div>
        </div>

        ${invoice.notes ? `
          <div class="invoice-section">
            <div class="section-title">Notes</div>
            <p>${invoice.notes}</p>
          </div>
        ` : ''}

        <div class="footer">
          <p>Thank you for shopping with ${invoice.storeInfo.name}!</p>
          <p>For any questions regarding this invoice, please contact us at ${invoice.storeInfo.email}</p>
          <p>© ${new Date().getFullYear()} ${invoice.storeInfo.name} | ${invoice.storeInfo.website}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
