export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  totalSpent: number;
  savedAddresses: number;
  recentOrders: RecentOrder[];
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  itemCount: number;
}

export interface VendorStats {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  avgRating: number;
  pendingOrders: number;
  recentOrders: VendorRecentOrder[];
  monthlyRevenue: MonthlyRevenue[];
}

export interface VendorRecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  productName: string;
  quantity: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  orders: number;
}

export interface AdminStats {
  totalUsers: number;
  totalVendors: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  pendingVendors: number;
  pendingProducts: number;
  recentOrders: AdminRecentOrder[];
  revenueByMonth: MonthlyRevenue[];
}

export interface AdminRecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  userName: string;
  userEmail: string;
}

export interface StatsCardData {
  title: string;
  value: string | number;
  description?: string;
  trend?: number;
  icon?: string;
}
