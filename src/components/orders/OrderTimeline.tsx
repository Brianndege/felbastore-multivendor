import { CheckCircle2, CircleDot, PackageCheck, Truck } from "lucide-react";

type OrderTimelineProps = {
  status: string;
  timestamps: {
    confirmedAt?: string | Date | null;
    processedAt?: string | Date | null;
    shippedAt?: string | Date | null;
    deliveredAt?: string | Date | null;
  };
};

const STEPS = [
  { key: "confirmed", label: "Confirmed", icon: CircleDot },
  { key: "processing", label: "Processing", icon: PackageCheck },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
] as const;

function toLabelDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

const STATUS_ORDER = ["pending", "confirmed", "processing", "shipped", "in_transit", "delivered", "completed"];

export default function OrderTimeline({ status, timestamps }: OrderTimelineProps) {
  const statusIndex = STATUS_ORDER.indexOf((status || "pending").toLowerCase());

  return (
    <div className="rounded-md border bg-gray-50 p-3">
      <p className="mb-2 text-sm font-medium">Order Timeline</p>
      <ul className="space-y-2 text-xs">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const reached = statusIndex >= index + 1;
          const timestampValue =
            step.key === "confirmed"
              ? timestamps.confirmedAt
              : step.key === "processing"
              ? timestamps.processedAt
              : step.key === "shipped"
              ? timestamps.shippedAt
              : timestamps.deliveredAt;

          return (
            <li key={step.key} className="flex items-start gap-2">
              <Icon className={`mt-0.5 h-4 w-4 ${reached ? "text-green-600" : "text-gray-400"}`} />
              <div>
                <p className={reached ? "font-medium text-gray-900" : "text-gray-500"}>{step.label}</p>
                {toLabelDate(timestampValue) ? (
                  <p className="text-gray-500">{toLabelDate(timestampValue)}</p>
                ) : (
                  <p className="text-gray-400">Pending</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
