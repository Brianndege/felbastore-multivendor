// File: src/app/vendors/dashboard/products/layout.tsx
import React from "react";

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "15px", border: "2px dashed #666" }}>
      <h2>Products Layout</h2>
      <div>{children}</div>
    </div>
  );
}