import { prisma } from '@/lib/prisma';
import type { DashboardStats, VendorStats, AdminStats } from '@/types/dashboard';

export async function getUserDashboardStats(userId: string): Promise<DashboardStats> {
  const [orders, addresses] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { orderItems: true },
      take: 10,
    }),
    prisma.savedAddress.count({ where: { userId } }),
  ]);

  const totalSpent = orders
    .filter(o => o.paymentStatus === 'paid')
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  const pendingOrders = orders.filter(o => o.status === 'pending').length;

  const recentOrders = orders.slice(0, 5).map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    totalAmount: Number(o.totalAmount),
    createdAt: o.createdAt.toISOString(),
    itemCount: o.orderItems.length,
  }));

  return {
    totalOrders: orders.length,
    pendingOrders,
    totalSpent,
    savedAddresses: addresses,
    recentOrders,
  };
}

export async function getVendorDashboardStats(vendorId: string): Promise<VendorStats> {
  const [orderItems, products] = await Promise.all([
    prisma.orderItem.findMany({
      where: { vendorId },
      include: {
        order: true,
      },
      orderBy: { order: { createdAt: 'desc' } },
    }),
    prisma.product.findMany({
      where: { vendorId },
      select: { avgRating: true, reviewCount: true },
    }),
  ]);

  const paidItems = orderItems.filter(i => i.order.paymentStatus === 'paid');
  const totalRevenue = paidItems.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
  const uniqueOrders = new Set(orderItems.map(i => i.orderId));
  const pendingOrders = orderItems.filter(i => i.order.status === 'pending');

  const avgRating = products.length > 0
    ? products.reduce((sum, p) => sum + Number(p.avgRating || 0), 0) / products.length
    : 0;

  // Monthly revenue for last 6 months
  const now = new Date();
  const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const month = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    const monthItems = paidItems.filter(item => {
      const itemDate = new Date(item.order.createdAt);
      return itemDate.getFullYear() === d.getFullYear() && itemDate.getMonth() === d.getMonth();
    });
    return {
      month,
      revenue: monthItems.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0),
      orders: new Set(monthItems.map(i => i.orderId)).size,
    };
  });

  const recentOrders = orderItems.slice(0, 5).map(i => ({
    id: i.order.id,
    orderNumber: i.order.orderNumber,
    status: i.order.status,
    paymentStatus: i.order.paymentStatus,
    totalAmount: Number(i.order.totalAmount),
    createdAt: i.order.createdAt.toISOString(),
    productName: i.productName,
    quantity: i.quantity,
  }));

  return {
    totalRevenue,
    totalOrders: uniqueOrders.size,
    totalProducts: products.length,
    avgRating: Math.round(avgRating * 10) / 10,
    pendingOrders: new Set(pendingOrders.map(i => i.orderId)).size,
    recentOrders,
    monthlyRevenue,
  };
}

export async function getAdminDashboardStats(): Promise<AdminStats> {
  const [users, vendors, products, orders] = await Promise.all([
    prisma.user.count(),
    prisma.vendor.count(),
    prisma.product.count(),
    prisma.order.findMany({
      include: { user: { select: { name: true, email: true } }, orderItems: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const [pendingVendors, pendingProducts] = await Promise.all([
    prisma.vendor.count({ where: { isVerified: false } }),
    prisma.product.count({ where: { isApproved: false } }),
  ]);

  const totalRevenue = orders
    .filter(o => o.paymentStatus === 'paid')
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  const now = new Date();
  const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const month = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    const monthOrders = orders.filter(o => {
      const od = new Date(o.createdAt);
      return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth() && o.paymentStatus === 'paid';
    });
    return {
      month,
      revenue: monthOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0),
      orders: monthOrders.length,
    };
  });

  const recentOrders = orders.slice(0, 10).map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    totalAmount: Number(o.totalAmount),
    createdAt: o.createdAt.toISOString(),
    userName: o.user.name || 'Unknown',
    userEmail: o.user.email,
  }));

  return {
    totalUsers: users,
    totalVendors: vendors,
    totalProducts: products,
    totalOrders: orders.length,
    totalRevenue,
    pendingVendors,
    pendingProducts,
    recentOrders,
    revenueByMonth,
  };
}
