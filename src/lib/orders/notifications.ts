import { prisma } from "@/lib/prisma";

type SendNotificationInput = {
  userId?: string;
  vendorId?: string;
  title: string;
  message: string;
  type?: string;
  priority?: string;
  data?: Record<string, unknown>;
};

export async function sendNotification(input: SendNotificationInput) {
  await prisma.notification.create({
    data: {
      userId: input.userId || null,
      vendorId: input.vendorId || null,
      type: input.type || "order",
      priority: input.priority || "normal",
      title: input.title,
      message: input.message,
      data: input.data ? JSON.stringify(input.data) : null,
    },
  });
}
