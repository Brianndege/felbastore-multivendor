# FelbaStore - Multivendor E-Commerce Platform

A full-featured multivendor e-commerce marketplace built with Next.js 15, featuring advanced payment processing (Stripe & M-Pesa), vendor management, and modern UI components.

## 🚀 Features

### For Customers
- **Product Browsing**: Browse products by categories, featured items, and new arrivals
- **Shopping Cart**: Full-featured cart with quantity management
- **Checkout Process**: Streamlined checkout with multiple payment options
- **Order Management**: Track orders and view order history
- **User Authentication**: Secure registration and login with NextAuth.js

### For Vendors
- **Vendor Dashboard**: Comprehensive dashboard for managing products and orders
- **Product Management**: Add, edit, and manage product listings
- **Sales Analytics**: Track sales performance and revenue
- **Inventory Management**: Stock tracking and alerts

### Payment Processing
- **Stripe Integration**: Credit/debit card payments with webhook support
- **M-Pesa Integration**: Mobile money payments for African markets
- **Secure Transactions**: PCI-compliant payment handling

### Technical Features
- **Modern Stack**: Next.js 15 with App Router and Pages Router
- **Type Safety**: Full TypeScript implementation
- **Database**: Prisma ORM with PostgreSQL support
- **UI Components**: Radix UI primitives with Tailwind CSS
- **Authentication**: NextAuth.js with Prisma adapter
- **Email**: Nodemailer integration for notifications
- **Media**: Cloudinary integration for image uploads

## 📦 Tech Stack

- **Framework**: Next.js 15.2.0
- **Language**: TypeScript
- **Styling**: Tailwind CSS + tailwindcss-animate
- **UI Components**: Radix UI, Lucide React Icons
- **Forms**: React Hook Form + Zod validation
- **Database**: Prisma ORM
- **Authentication**: NextAuth.js
- **Payments**: Stripe, M-Pesa
- **Email**: Nodemailer
- **Media Storage**: Cloudinary

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL database
- Stripe account (for payments)
- M-Pesa API credentials (optional, for mobile payments)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Brianndege/felbastore-multivendor.git
   cd felbastore-multivendor
   ```

2. Install dependencies:
   ```bash
   bun install
   # or
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```

4. Configure your `.env.local` file with:
   - Database connection string
   - NextAuth secret
   - Stripe API keys
   - M-Pesa credentials (optional)
   - Email service credentials

5. Set up the database:
   ```bash
   bunx prisma generate
   bunx prisma db push
   ```

6. Run the development server:
   ```bash
   bun dev
   # or
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
├── prisma/                 # Prisma schema and migrations
├── src/
│   ├── app/                # Next.js App Router pages
│   │   ├── auth/           # Authentication pages
│   │   ├── cart/           # Shopping cart
│   │   ├── checkout/       # Checkout flow
│   │   ├── orders/         # Order management
│   │   ├── products/       # Product pages
│   │   └── vendors/        # Vendor dashboard
│   ├── components/         # React components
│   │   ├── checkout/       # Checkout components
│   │   ├── layout/         # Header, Footer
│   │   ├── products/       # Product components
│   │   └── ui/             # UI primitives
│   ├── contexts/           # React contexts
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Utility functions
│   │   └── payments/       # Payment providers
│   ├── pages/api/          # API routes
│   │   ├── auth/           # Auth endpoints
│   │   ├── cart/           # Cart API
│   │   ├── orders/         # Orders API
│   │   ├── payment/        # Payment processing
│   │   └── vendor/         # Vendor API
│   └── types/              # TypeScript types
└── public/                 # Static assets
```

## 🔐 Environment Variables

Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

# Stripe
STRIPE_SECRET_KEY="sk_..."
STRIPE_PUBLISHABLE_KEY="pk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# M-Pesa (Optional)
MPESA_CONSUMER_KEY="..."
MPESA_CONSUMER_SECRET="..."
MPESA_SHORTCODE="..."
MPESA_PASSKEY="..."

# Email
EMAIL_SERVER_HOST="..."
EMAIL_SERVER_PORT="..."
EMAIL_SERVER_USER="..."
EMAIL_SERVER_PASSWORD="..."
EMAIL_FROM="..."

# Cloudinary
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

## 📚 Documentation

- [Database Setup](./DATABASE_SETUP.md)
- [Payment System](./PAYMENT_SYSTEM.md)
- [Authentication Testing](./AUTHENTICATION_TESTING.md)
- [Technical Audit](./TECHNICAL_AUDIT.md)

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository in Vercel
3. Configure environment variables
4. Deploy

### Netlify

Configuration is included in `netlify.toml`.

## 📝 License

This project is private and proprietary.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Built with ❤️ using Next.js and modern web technologies.
