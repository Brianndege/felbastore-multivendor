import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'vendor') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const vendorId = session.user.id;

  try {
    if (req.method === 'GET') {
      const products = await prisma.product.findMany({
        where: { vendorId },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { reviews: true, orderItems: true } },
        },
      });
      return res.status(200).json(products);
    }

    if (req.method === 'POST') {
      const { name, description, price, category, subcategory, tags, images, inventory, sku, status } = req.body;

      if (!name || !description || !price || !category) {
        return res.status(400).json({ error: 'name, description, price, and category are required' });
      }

      const product = await prisma.product.create({
        data: {
          vendorId,
          name,
          description,
          price: parseFloat(price),
          category,
          subcategory: subcategory || null,
          tags: tags || [],
          images: images || [],
          inventory: parseInt(inventory) || 0,
          sku: sku || null,
          status: status || 'active',
        },
      });
      return res.status(201).json(product);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Vendors Products API]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
