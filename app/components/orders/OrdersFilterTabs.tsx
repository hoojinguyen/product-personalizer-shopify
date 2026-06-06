import React from "react";

interface OrderLog {
  id: string;
  orderId: string;
  status: string;
  error?: string | null;
  createdAt: string | Date;
}

interface OrdersFilterTabsProps {
  filterStatus: "all" | "completed" | "pending" | "failed";
  setFilterStatus: (status: "all" | "completed" | "pending" | "failed") => void;
  logs: OrderLog[];
}

export function OrdersFilterTabs({
  filterStatus,
  setFilterStatus,
  logs,
}: OrdersFilterTabsProps) {
  return (
    <div className="orders-tabs">
      <button
        type="button"
        className={`tab-btn ${filterStatus === "all" ? "active" : ""}`}
        onClick={() => setFilterStatus("all")}
      >
        All Orders ({logs.length})
      </button>
      <button
        type="button"
        className={`tab-btn ${filterStatus === "completed" ? "active" : ""}`}
        onClick={() => setFilterStatus("completed")}
      >
        🟢 Completed ({logs.filter(l => l.status.toLowerCase() === "completed").length})
      </button>
      <button
        type="button"
        className={`tab-btn ${filterStatus === "pending" ? "active" : ""}`}
        onClick={() => setFilterStatus("pending")}
      >
        🟡 Pending ({logs.filter(l => l.status.toLowerCase() === "pending").length})
      </button>
      <button
        type="button"
        className={`tab-btn ${filterStatus === "failed" ? "active" : ""}`}
        onClick={() => setFilterStatus("failed")}
      >
        🔴 Failed ({logs.filter(l => l.status.toLowerCase() === "failed").length})
      </button>
    </div>
  );
}
