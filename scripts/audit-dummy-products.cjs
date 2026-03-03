const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  try {
    const [total, flaggedDummy, seedCreated, taggedDemo, liveVisible] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { isDummy: true } }),
      prisma.product.count({ where: { createdBy: { in: ['seed_script', 'seed', 'demo_seed'] } } }),
      prisma.product.count({ where: { tags: { hasSome: ['sample', 'test', 'demo'] } } }),
      prisma.product.count({
        where: {
          productType: 'vendor',
          isApproved: true,
          status: 'active',
          workflowStatus: 'APPROVED',
          isDummy: false,
          OR: [{ createdBy: null }, { createdBy: { notIn: ['seed_script', 'seed', 'demo_seed'] } }],
        },
      }),
    ]);

    console.log(JSON.stringify({ total, flaggedDummy, seedCreated, taggedDemo, liveVisible }, null, 2));

    const sample = await prisma.product.findMany({
      where: {
        OR: [
          { isDummy: true },
          { createdBy: { in: ['seed_script', 'seed', 'demo_seed'] } },
          { tags: { hasSome: ['sample', 'test', 'demo'] } },
        ],
      },
      select: {
        id: true,
        name: true,
        vendorId: true,
        isDummy: true,
        createdBy: true,
        tags: true,
        status: true,
        workflowStatus: true,
      },
      take: 25,
      orderBy: { createdAt: 'desc' },
    });

    console.log('candidates=', JSON.stringify(sample, null, 2));
  } catch (error) {
    console.error('[audit-dummy-products] FAILED', error?.message || error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
