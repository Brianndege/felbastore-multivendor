# Database Setup Guide

## Setting up MySQL Database in cPanel

### Step 1: Create MySQL Database
1. Log in to your cPanel account
2. Look for "MySQL® Databases" in the Databases section
3. Under "Create New Database":
   - Enter database name (e.g., `multivendor`)
   - Click "Create Database"

### Step 2: Create MySQL User
1. Under "MySQL Users" section:
   - Enter username (e.g., `multivendor_user`)
   - Enter a strong password
   - Click "Create User"

### Step 3: Add User to Database
1. Under "Add User To Database":
   - Select your user from the dropdown
   - Select your database from the dropdown
   - Click "Add"
2. Grant ALL PRIVILEGES to the user
3. Click "Make Changes"

### Step 4: Get Database Connection Details
- **Host**: Usually `localhost` (check with your hosting provider)
- **Database**: Your database name (e.g., `cpaneluser_multivendor`)
- **Username**: Your username (e.g., `cpaneluser_user`)
- **Password**: The password you created
- **Port**: Usually `3306`

## Configure Your Application

### Step 1: Update Environment Variables
Edit your `.env` file and update the `DATABASE_URL`:

```env
DATABASE_URL="mysql://USERNAME:PASSWORD@HOST:PORT/DATABASE"
```

Example:
```env
DATABASE_URL="mysql://cpaneluser_user:StrongPass123@localhost:3306/cpaneluser_multivendor"
NEXTAUTH_SECRET="your-secret-key-change-this-in-production"
NEXTAUTH_URL="https://yourdomain.com"
```

### Step 2: Create Database Tables

#### Option A: Using Prisma Migrate (Recommended for development)
If you have local development environment:
```bash
npx prisma migrate dev --name init
```

#### Option B: Manual SQL Import (For production/cPanel)
1. Generate SQL migration file:
```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > migration.sql
```

2. Open phpMyAdmin in cPanel
3. Select your database
4. Go to "Import" tab
5. Upload and execute the `migration.sql` file

#### Option C: Database Push (Quick setup)
```bash
npx prisma db push
```

### Step 3: Verify Setup
Your database should now have these tables:
- `User` - For customer accounts
- `Vendor` - For vendor accounts

## Testing the Authentication

1. Visit your website
2. Try registering as a customer at `/auth/register`
3. Try registering as a vendor at `/vendors/register`
4. Test login functionality at `/auth/login`
5. Verify vendor dashboard access at `/vendors/dashboard`

## Troubleshooting

### Common Issues:

1. **Connection refused**: Check if database host, port, username, and password are correct
2. **Access denied**: Verify user has proper privileges on the database
3. **Database not found**: Make sure database name is correct in connection string
4. **SSL issues**: Add `?sslaccept=strict` to the end of your DATABASE_URL if required

### Debugging Connection:
Check your connection by running:
```bash
npx prisma db pull
```

This will test the connection and show any tables that exist.
