const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function getArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const adminEmail = getArg('admin-email') || process.env.CLEANUP_ADMIN_EMAIL;
  const adminPassword = getArg('admin-password') || process.env.CLEANUP_ADMIN_PASSWORD;
  const apply = hasFlag('apply');
  const dryRun = !apply;

  if (!adminEmail || !adminPassword) {
    throw new Error('Provide admin credentials via --admin-email / --admin-password (or CLEANUP_ADMIN_EMAIL/CLEANUP_ADMIN_PASSWORD).');
  }

  const admin = await prisma.user.findUnique({
    where: { email: adminEmail.toLowerCase().trim() },
    select: { id: true, email: true, role: true, password: true },
  });

  if (!admin || admin.role !== 'admin' || !admin.password) {
    throw new Error('Admin account not found or invalid.');
  }

  const ok = await bcrypt.compare(adminPassword, admin.password);
  if (!ok) {
    throw new Error('Admin password confirmation failed.');
  }

  const dummyProducts = await prisma.product.findMany({
    where: {
      productType: 'vendor',
      OR: [
        { isDummy: true },
        { createdBy: { in: ['seed_script', 'seed', 'demo_seed'] } },
        {
          AND: [
            { createdBy: { in: ['seed_script', 'seed', 'demo_seed'] } },
            { tags: { hasSome: ['sample', 'test', 'demo'] } },
          ],
        },
      ],
    },
    select: { id: true, name: true, images: true, vendorId: true },
  });

  const productIds = dummyProducts.map((item) => item.id);
  const orderRefs = await prisma.orderItem.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true },
  });
  const blocked = new Set(orderRefs.map((item) => item.productId));
  const removableIds = productIds.filter((id) => !blocked.has(id));

  const [reviews, variants, inventoryRecords, searchEntries] = await Promise.all([
    prisma.review.findMany({ where: { productId: { in: removableIds } } }),
    prisma.productVariant.findMany({ where: { productId: { in: removableIds } } }),
    prisma.inventoryRecord.findMany({ where: { productId: { in: removableIds } } }),
    prisma.productSearchIndex.findMany({ where: { productId: { in: removableIds } } }),
  ]);

  const backup = {
    generatedAt: new Date().toISOString(),
    dryRun,
    adminId: admin.id,
    adminEmail: admin.email,
    criteria: ['isDummy=true', 'createdBy in [seed_script,seed,demo_seed]', 'createdBy seed + tags include sample/test/demo'],
    blockedProductIds: [...blocked],
    products: dummyProducts.filter((item) => removableIds.includes(item.id)),
    reviews,
    variants,
    inventoryRecords,
    searchEntries,
  };

  const backupDir = path.join(process.cwd(), 'artifacts', 'cleanup-backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `dummy-products-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');

  console.log(`[cleanup] Matched: ${productIds.length}, Removable: ${removableIds.length}, Blocked: ${blocked.size}`);
  console.log(`[cleanup] Backup written to ${backupPath}`);
  console.log(`[cleanup] Candidate IDs: ${removableIds.join(', ') || '(none)'}`);

  await prisma.adminCleanupRun.create({
    data: {
      adminUserId: admin.id,
      adminEmail: admin.email,
      dryRun,
      criteria: JSON.stringify({ blockedProductIds: [...blocked] }),
      removedProductIds: removableIds,
      removedCount: dryRun ? 0 : removableIds.length,
      completedAt: new Date(),
    },
  });

  if (dryRun || removableIds.length === 0) {
    console.log('[cleanup] Dry-run complete. No data deleted. Use --apply to execute deletion.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.cartItem.deleteMany({ where: { productId: { in: removableIds } } });
    await tx.wishlistItem.deleteMany({ where: { productId: { in: removableIds } } });
    await tx.review.deleteMany({ where: { productId: { in: removableIds } } });
    await tx.productVariant.deleteMany({ where: { productId: { in: removableIds } } });
    await tx.inventoryRecord.deleteMany({ where: { productId: { in: removableIds } } });
    await tx.productSearchIndex.deleteMany({ where: { productId: { in: removableIds } } });
    await tx.product.deleteMany({ where: { id: { in: removableIds } } });
  });

  console.log('[cleanup] Dummy products removed successfully.');
}

main()
  .catch((error) => {
    console.error('[cleanup] FAILED', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });