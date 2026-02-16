# Felbastore Multivendor E-Commerce Platform

A robust multivendor e-commerce platform with advanced payment integration, built with Next.js, TypeScript, Prisma, and shadcn UI components.

![Felbastore](https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)

## Repository

GitHub Repository: [https://github.com/Brianndege/felbastore-multivendor](https://github.com/Brianndege/felbastore-multivendor)

## Features

- **Multivendor Architecture** - Multiple vendors can register and sell products
- **User & Vendor Authentication** - Secure login and registration with email verification
- **Product Management** - Complete CRUD operations for product listings
- **Advanced Payment System** - Integration with Stripe for card payments and M-Pesa for mobile money
- **Order Management** - Comprehensive order tracking and management
- **Dashboards** - Dedicated dashboards for users, vendors, and administrators
- **Responsive Design** - Mobile-friendly interface with Tailwind CSS
- **Email Notifications** - Automated emails for account actions and order updates
- **Invoice Generation** - Automatic creation of receipts and invoices
- **Secure Transactions** - Server-side validation and payment processing
- **Analytics** - Basic analytics for vendors and administrators

## Technology Stack

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** PostgreSQL (with Prisma Accelerate support)
- **Authentication:** NextAuth.js
- **Payment:** Stripe, M-Pesa
- **Email:** Nodemailer
- **Deployment:** Netlify, Vercel (supported)

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- Bun (preferred) or npm
- PostgreSQL database
- Stripe account (for payment processing)
- M-Pesa developer account (optional, for mobile money)
- SMTP server (for email notifications)

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
   Copy `.env.example` to `.env` and update with your own values:

```bash
cp .env.example .env
```

4. Set up the database:

```bash
bunx prisma generate
bunx prisma db push
```

5. Run the development server:

```bash
bun run dev
# or
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Deployment

#### Deploy to Netlify

1. Push your code to GitHub (or another Git provider)
2. Connect your repository to Netlify
3. Configure the build settings:
   - Build command: `npx prisma generate && NEXT_DISABLE_ESLINT=1 SKIP_TYPE_CHECK=1 npm run build`
   - Publish directory: `.next`
4. Add the following environment variables in Netlify:
   - `DATABASE_URL`: Your database connection string
   - `NEXTAUTH_SECRET`: A random string for NextAuth.js
   - `NEXTAUTH_URL`: Your deployed URL (e.g., https://your-app.netlify.app)
   - `STRIPE_SECRET_KEY`: Your Stripe secret key
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key
   - Other environment variables as needed
5. Deploy the site
6. Enable the Netlify Next.js plugin

#### Deploy to Vercel

1. Push your code to GitHub (or another Git provider)
2. Import the project in Vercel
3. Configure environment variables
4. Deploy

## Project Structure

```
felbastore-multivendor/
├── .next/               # Build output
├── prisma/              # Prisma schema and migrations
├── public/              # Static assets
├── src/
│   ├── app/             # Next.js App Router pages
│   ├── components/      # React components
│   ├── contexts/        # React context providers
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions and configurations
│   │   └── payments/    # Payment system architecture
│   ├── pages/           # Next.js Pages Router (API routes)
│   │   └── api/         # Backend API endpoints
│   └── types/           # TypeScript type definitions
├── .env.example         # Example environment variables
├── .gitignore           # Git ignore file
├── PAYMENT_SYSTEM.md    # Payment system documentation
├── README.md            # Project documentation
├── next.config.mjs      # Next.js configuration
└── package.json         # Project dependencies
```

## Documentation

The project includes several documentation files:

- **README.md**: This file with general project information
- **PAYMENT_SYSTEM.md**: Detailed documentation of the payment system architecture
- **AUTHENTICATION_TESTING.md**: Guide for testing authentication flows
- **TECHNICAL_AUDIT.md**: Technical audit of the platform with recommendations
- **DATABASE_SETUP.md**: Instructions for database setup and configuration

## Payment System Architecture

The payment system implements a modular design with the following key features:

- **Provider Abstraction Layer**: Common interface for all payment methods
- **Idempotent Transaction Processing**: Prevents duplicate payments
- **Asynchronous Payment Workflow**: Handles webhooks and callbacks
- **Cart-Payment Integrity**: Server-side validation of order totals
- **Comprehensive Error Handling**: Robust error recovery and logging

For more details, see [PAYMENT_SYSTEM.md](./PAYMENT_SYSTEM.md)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

For questions or support, please contact [support@felbastore.co.ke](mailto:support@felbastore.co.ke).

## Acknowledgements

- [Next.js](https://nextjs.org/) - The React framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Prisma](https://prisma.io/) - Database toolkit
- [NextAuth.js](https://next-auth.js.org/) - Authentication for Next.js
- [Stripe](https://stripe.com/) - Payment processing
- [Bun](https://bun.sh/) - JavaScript runtime and package manager
