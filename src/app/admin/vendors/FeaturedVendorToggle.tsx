"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type FeaturedVendorToggleProps = {
  vendorId: string;
  featured: boolean;
  updateAction: (formData: FormData) => Promise<void>;
};

export default function FeaturedVendorToggle({
  vendorId,
  featured,
  updateAction,
}: FeaturedVendorToggleProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(featured);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setChecked(featured);
  }, [featured]);

  const onToggle = (nextChecked: boolean) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("vendorId", vendorId);
      formData.set("featured", String(nextChecked));

      try {
        await updateAction(formData);
        setChecked(nextChecked);
        router.refresh();
      } catch {
        setChecked((prev) => !prev);
      }
    });
  };

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={isPending}
        onChange={(event) => {
          const nextChecked = event.target.checked;
          setChecked(nextChecked);
          onToggle(nextChecked);
        }}
        className="h-4 w-4 rounded border-gray-300 text-[#e16b22] focus:ring-[#e16b22]"
        aria-label="Toggle vendor featured status"
      />
      <span className="text-xs text-muted-foreground">{isPending ? "Updating..." : checked ? "Featured" : "Not featured"}</span>
    </label>
  );
}
