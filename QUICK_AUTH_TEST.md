# Quick Authentication Testing Guide

## 🚀 Quick Start Testing

### 1. Verify Database Connection (30 seconds)

```bash
# Start the dev server
cd multivendor-marketplace
bun run dev

# In another terminal, test DB connection
curl http://localhost:3000/api/test-db
```

✅ **Success**: You should see `"success": true` and database counts
❌ **Fail**: Check your `DATABASE_URL` in `.env` file

---

### 2. Test User Registration (2 minutes)

**Option A: Via Browser**
1. Go to http://localhost:3000/auth/register
2. Fill in:
   - Name: "Test User"
   - Email: "test@example.com"
   - Password: "password123"
   - Confirm Password: "password123"
3. Click "Create Account"
4. ✅ Should redirect to login page with success message

**Option B: Via cURL**
```bash
curl -X POST http://localhost:3000/api/auth/registerUser \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```

✅ **Success**: HTTP 201, returns user object
❌ **Fail**: Check server console for detailed error logs

---

### 3. Test User Login (1 minute)

1. Go to http://localhost:3000/auth/login
2. Click "Customer" tab
3. Enter:
   - Email: "test@example.com"
   - Password: "password123"
4. Click "Sign In"
5. ✅ Should redirect to home page

---

### 4. Test Vendor Registration & Login (3 minutes)

**Register:**
1. Go to http://localhost:3000/vendors/register
2. Fill in name, email, password, store name
3. Create account
4. ✅ Should redirect to login

**Login:**
1. Go to http://localhost:3000/auth/login
2. Click "Vendor" tab
3. Enter vendor credentials
4. ✅ Should redirect to `/vendors/dashboard`

---

## 🔍 What Was Fixed

1. ✅ **Critical Bug**: Removed server-side code from client components
2. ✅ **Enhanced Logging**: All auth operations now log to console
3. ✅ **Better Errors**: Clear, user-friendly error messages
4. ✅ **DB Testing**: New `/api/test-db` endpoint to verify connectivity
5. ✅ **Security**: Verified password hashing works correctly

---

## 📊 Monitor Server Logs

When testing, watch your terminal for logs like:

```
[Prisma] Database connection established successfully
[registerUser] Registration attempt started
[registerUser] User created successfully with ID: clxxxx...
[NextAuth] Login successful for user: test@example.com
```

---

## 🐛 Common Issues

### Database Connection Error
```bash
# Regenerate Prisma client
bunx prisma generate

# Push schema to database
bunx prisma db push
```

### Email Already Exists
```bash
# Delete test user
bunx prisma studio
# Navigate to User table and delete the record
```

---

## 📚 Full Documentation

For comprehensive testing procedures, see:
- `AUTHENTICATION_TESTING.md` - Complete testing guide
- Server console output - Real-time debugging logs
- `http://localhost:3000/api/test-db` - Database health check

---

## ✅ Success Checklist

- [ ] Database connection test passes
- [ ] User registration creates record in DB
- [ ] User login redirects to home page
- [ ] Vendor registration creates record in DB
- [ ] Vendor login redirects to dashboard
- [ ] Passwords are hashed (not plain text)
- [ ] Error messages are clear and helpful
- [ ] Server logs show detailed operation info

---

**Need Help?** Check server console for detailed error messages with `[registerUser]`, `[registerVendor]`, or `[NextAuth]` prefixes.
