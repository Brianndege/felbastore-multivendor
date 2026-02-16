# Authentication Testing Guide

This guide will help you test and verify the user registration and login flows for the Felbastore multivendor marketplace.

## Prerequisites

Before testing, ensure:

1. **Database Connection**: Your `DATABASE_URL` in `.env` is correctly configured
2. **Dependencies**: All packages are installed (`bun install`)
3. **Prisma**: Database schema is up to date (`bunx prisma generate && bunx prisma db push`)
4. **Dev Server**: The application is running (`bun run dev`)

## Test Endpoints

### 1. Database Connectivity Test

First, verify that the database connection is working:

```bash
curl http://localhost:3000/api/test-db
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Database connectivity test passed",
  "results": {
    "connection": "✓ Connected",
    "userCount": 0,
    "vendorCount": 0,
    "productCount": 0,
    "createTest": "✓ Passed",
    "deleteTest": "✓ Passed",
    "queryTest": "✓ Passed"
  }
}
```

If this test fails, check your DATABASE_URL and ensure Prisma can connect to your database.

## Testing User Registration Flow

### Test Case 1: Successful User Registration

**Via UI:**
1. Navigate to `http://localhost:3000/auth/register`
2. Fill in the registration form:
   - Name: "Test User"
   - Email: "testuser@example.com"
   - Password: "password123"
   - Confirm Password: "password123"
3. Click "Create Account"
4. Verify success message appears
5. Verify redirect to login page

**Via API:**
```bash
curl -X POST http://localhost:3000/api/auth/registerUser \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "testuser@example.com",
    "password": "password123"
  }'
```

**Expected Response (201 Created):**
```json
{
  "user": {
    "id": "clxxxx...",
    "name": "Test User",
    "email": "testuser@example.com",
    "role": "user"
  },
  "message": "Account created successfully! Please check your email to verify your account."
}
```

**Verify in Database:**
```bash
# Using Prisma Studio
bunx prisma studio

# Or query directly
bunx prisma db execute --stdin <<< "SELECT * FROM \"User\" WHERE email = 'testuser@example.com';"
```

### Test Case 2: Duplicate Email Registration

**Expected Behavior:** Should reject with 409 Conflict

```bash
curl -X POST http://localhost:3000/api/auth/registerUser \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Another User",
    "email": "testuser@example.com",
    "password": "password456"
  }'
```

**Expected Response (409 Conflict):**
```json
{
  "error": "An account with this email already exists."
}
```

### Test Case 3: Missing Required Fields

```bash
curl -X POST http://localhost:3000/api/auth/registerUser \
  -H "Content-Type: application/json" \
  -d '{
    "email": "incomplete@example.com"
  }'
```

**Expected Response (400 Bad Request):**
```json
{
  "error": "Missing required fields. Please provide name, email, and password."
}
```

## Testing Vendor Registration Flow

### Test Case 4: Successful Vendor Registration

**Via UI:**
1. Navigate to `http://localhost:3000/vendors/register`
2. Fill in the vendor registration form:
   - Name: "Test Vendor"
   - Email: "vendor@example.com"
   - Password: "password123"
   - Confirm Password: "password123"
   - Store Name: "Test Store"
3. Click "Create Vendor Account"
4. Verify success message appears
5. Verify redirect to login page

**Via API:**
```bash
curl -X POST http://localhost:3000/api/auth/registerVendor \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Vendor",
    "email": "vendor@example.com",
    "password": "password123",
    "storeName": "Test Store"
  }'
```

**Expected Response (201 Created):**
```json
{
  "vendor": {
    "id": "clxxxx...",
    "name": "Test Vendor",
    "email": "vendor@example.com",
    "storeName": "Test Store",
    "role": "vendor"
  },
  "message": "Vendor account created successfully! Please check your email to verify your account."
}
```

## Testing Login Flow

### Test Case 5: Successful User Login

**Via UI:**
1. Navigate to `http://localhost:3000/auth/login`
2. Select "Customer" tab
3. Enter credentials:
   - Email: "testuser@example.com"
   - Password: "password123"
4. Click "Sign In"
5. Verify success message
6. Verify redirect to home page

**Via API:**
```bash
curl -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "password123",
    "userType": "user",
    "redirect": false
  }'
```

### Test Case 6: Successful Vendor Login

**Via UI:**
1. Navigate to `http://localhost:3000/auth/login`
2. Select "Vendor" tab
3. Enter credentials:
   - Email: "vendor@example.com"
   - Password: "password123"
4. Click "Sign In"
5. Verify success message
6. Verify redirect to vendor dashboard (`/vendors/dashboard`)

### Test Case 7: Failed Login - Invalid Credentials

**Expected Behavior:** Should show error message

**Via UI:**
1. Navigate to `http://localhost:3000/auth/login`
2. Enter incorrect password
3. Verify "Invalid credentials" error message appears

### Test Case 8: Failed Login - User Not Found

**Via UI:**
1. Navigate to `http://localhost:3000/auth/login`
2. Enter email that doesn't exist: "nonexistent@example.com"
3. Verify "Invalid credentials" error message appears

## Checking Server Logs

When testing, monitor the console output for detailed logging:

```bash
# Start the dev server with visible logs
bun run dev
```

Look for log entries like:
- `[registerUser] Registration attempt started`
- `[registerUser] Checking for existing user with email: ...`
- `[registerUser] User created successfully with ID: ...`
- `[NextAuth] Login attempt started`
- `[NextAuth] Login successful for user: ...`
- `[Prisma] Database connection established successfully`

## Common Issues and Solutions

### Issue 1: Database Connection Failed

**Symptoms:**
- Error: "Database connection error"
- Test-db endpoint fails

**Solutions:**
1. Verify DATABASE_URL in `.env`
2. Ensure database is running
3. Run `bunx prisma generate`
4. Check network connectivity

### Issue 2: User Already Exists Error on First Registration

**Symptoms:**
- 409 Conflict error even though it's a new email

**Solutions:**
1. Check database for existing records:
   ```bash
   bunx prisma studio
   ```
2. Delete existing records if needed:
   ```bash
   bunx prisma db execute --stdin <<< "DELETE FROM \"User\" WHERE email = 'testuser@example.com';"
   ```

### Issue 3: Login Fails After Successful Registration

**Symptoms:**
- "Invalid credentials" error with correct password

**Solutions:**
1. Verify password is being hashed correctly
2. Check bcrypt version compatibility
3. Review server logs for detailed error messages

### Issue 4: Email Verification Tokens Not Created

**Symptoms:**
- Registration succeeds but no verification token

**Solutions:**
1. Check EmailVerificationToken table in database
2. Review email configuration in `.env`
3. Check server logs for email sending errors

## Password Security Verification

Verify passwords are properly hashed:

```bash
# Check a user record in the database
bunx prisma studio

# The password field should look like:
# $2a$10$randomhashstring...
# NOT the plain text password
```

## Manual Database Verification

After each test, you can verify the data was correctly saved:

```bash
# Open Prisma Studio
bunx prisma studio

# Or use direct queries
bunx prisma db execute --stdin <<< "SELECT id, name, email, role, \"createdAt\" FROM \"User\";"
bunx prisma db execute --stdin <<< "SELECT id, name, email, \"storeName\", role, \"createdAt\" FROM \"Vendor\";"
```

## Role-Based Access Control Testing

### Test Case 9: Verify User Cannot Access Vendor Dashboard

1. Login as a regular user
2. Try to navigate to `/vendors/dashboard`
3. Should be redirected to home page

### Test Case 10: Verify Vendor Cannot Access Admin Dashboard

1. Login as a vendor
2. Try to navigate to `/admin/dashboard`
3. Should be redirected to home page or see "Access Denied"

## Clean Up Test Data

After testing, clean up test accounts:

```bash
bunx prisma db execute --stdin <<< "DELETE FROM \"User\" WHERE email LIKE 'test%@example.com';"
bunx prisma db execute --stdin <<< "DELETE FROM \"Vendor\" WHERE email LIKE 'vendor%@example.com';"
```

## Automated Testing Script

Create a test script to run multiple tests:

```bash
#!/bin/bash

echo "Testing database connection..."
curl -s http://localhost:3000/api/test-db | jq

echo -e "\n\nTesting user registration..."
curl -s -X POST http://localhost:3000/api/auth/registerUser \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Automated Test User",
    "email": "autotest@example.com",
    "password": "test123456"
  }' | jq

echo -e "\n\nTesting duplicate registration (should fail)..."
curl -s -X POST http://localhost:3000/api/auth/registerUser \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Duplicate Test",
    "email": "autotest@example.com",
    "password": "test123456"
  }' | jq

echo -e "\n\nDone!"
```

## Next Steps

After successful testing:

1. ✅ Verify all registration flows work correctly
2. ✅ Verify all login flows work correctly
3. ✅ Verify database records are created properly
4. ✅ Verify passwords are hashed (not stored as plain text)
5. ✅ Verify role-based redirects work correctly
6. ✅ Test email verification flow
7. ✅ Test password reset flow
8. ✅ Deploy to staging environment
9. ✅ Run end-to-end tests in production-like environment

## Support

If you encounter issues:

1. Check server console logs
2. Review browser console for client-side errors
3. Use Prisma Studio to inspect database state
4. Verify environment variables are set correctly
5. Ensure all dependencies are installed and up to date
