import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log('[test-db] Starting database connectivity test...');

  try {
    // Test 1: Simple query to check connection
    console.log('[test-db] Test 1: Testing basic database connection...');
    const userCount = await prisma.user.count();
    const vendorCount = await prisma.vendor.count();
    console.log('[test-db] Connection successful - Users:', userCount, 'Vendors:', vendorCount);

    // Test 2: Try to create and delete a test user
    console.log('[test-db] Test 2: Testing user creation...');
    const testEmail = `test-${Date.now()}@example.com`;
    const testUser = await prisma.user.create({
      data: {
        name: "Test User",
        email: testEmail,
        password: "test-password-hashed",
        role: "user",
      },
    });
    console.log('[test-db] Test user created with ID:', testUser.id);

    // Clean up test user
    console.log('[test-db] Cleaning up test user...');
    await prisma.user.delete({
      where: { id: testUser.id },
    });
    console.log('[test-db] Test user deleted successfully');

    // Test 3: Check if we can query vendors
    console.log('[test-db] Test 3: Testing vendor query...');
    const vendors = await prisma.vendor.findMany({
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        storeName: true,
      },
    });
    console.log('[test-db] Found', vendors.length, 'vendors');

    // Test 4: Check products
    console.log('[test-db] Test 4: Testing product query...');
    const productCount = await prisma.product.count();
    console.log('[test-db] Found', productCount, 'products');

    console.log('[test-db] All tests passed successfully!');

    return res.status(200).json({
      success: true,
      message: "Database connectivity test passed",
      results: {
        connection: "✓ Connected",
        userCount,
        vendorCount,
        productCount,
        createTest: "✓ Passed",
        deleteTest: "✓ Passed",
        queryTest: "✓ Passed",
        sampleVendors: vendors,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[test-db] Database test failed:', error);
    console.error('[test-db] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });

    return res.status(500).json({
      success: false,
      error: "Database connectivity test failed",
      details: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
}
