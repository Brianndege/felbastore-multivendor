// File: src/app/vendors/dashboard/layout.tsx
import React from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "20px", border: "2px solid #333" }}>
      <h1>Dashboard Layout</h1>
      <div>{children}</div>
    </div>
  );
}