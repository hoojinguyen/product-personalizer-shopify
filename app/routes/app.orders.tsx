import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState, useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { OrdersFilterTabs } from "../components/orders/OrdersFilterTabs";
import { OrdersToolbar } from "../components/orders/OrdersToolbar";
import { OrdersBulkActionBar } from "../components/orders/OrdersBulkActionBar";
import { OrdersTable } from "../components/orders/OrdersTable";

interface CustomAttribute {
  key: string;
  value: string;
}

interface LineItemNode {
  id: string;
  title: string;
  customAttributes: CustomAttribute[];
}

interface OrderNode {
  id: string;
  name: string;
  createdAt: string;
  lineItems?: {
    edges?: {
      node: LineItemNode;
    }[];
  };
}

// Loader: Fetch all SQLite order processing log entries
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const logs = await db.orderProcessingLog.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" }
  });

  return { logs };
};

// Action: Handle manual Shopify orders sync, deletion, and bulk operations
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "sync_orders") {
    try {
      const response = await admin.graphql(
        `#graphql
        query getRecentOrders {
          orders(first: 30, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                name
                createdAt
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      title
                      customAttributes {
                        key
                        value
                      }
                    }
                  }
                }
              }
            }
          }
        }`
      );

      const responseJson = await response.json();
      const orders = responseJson.data?.orders?.edges?.map((e: { node: OrderNode }) => e.node) || [];
      let syncedCount = 0;

      for (const order of orders) {
        const orderIdNumber = order.id.split("/").pop();
        
        // Check if log already exists
        const exists = await db.orderProcessingLog.findFirst({
          where: { shop, orderId: orderIdNumber }
        });

        if (exists) continue;

        // Check if order has personalized line items
        let isPersonalized = false;
        const items = order.lineItems?.edges?.map((e: { node: LineItemNode }) => e.node) || [];

        for (const item of items) {
          const attributes = item.customAttributes || [];
          const hasPreview = attributes.some((a: CustomAttribute) => a.key === "_preview_url");
          const hasVisibleProps = attributes.some((a: CustomAttribute) => !a.key.startsWith("_") && a.key !== "priceUpcharge");
          
          if (hasPreview || hasVisibleProps) {
            isPersonalized = true;
            break;
          }
        }

        if (isPersonalized) {
          // Register the order as COMPLETED status to let merchant download instantly
          await db.orderProcessingLog.create({
            data: {
              shop,
              orderId: orderIdNumber,
              status: "COMPLETED",
              printFileUrl: ""
            }
          });
          syncedCount++;
        }
      }

      return { success: true, intent, syncedCount };
    } catch (e: unknown) {
      return { error: (e as Error).message || "Failed to sync orders" };
    }
  }

  if (intent === "delete_order") {
    const logId = formData.get("logId") as string;
    try {
      await db.orderProcessingLog.delete({
        where: { id: logId, shop }
      });
      return { success: true, intent, deletedId: logId };
    } catch (e: unknown) {
      return { error: (e as Error).message || "Failed to delete order log entry" };
    }
  }

  if (intent === "bulk_delete") {
    const logIds = JSON.parse(formData.get("logIds") as string) as string[];
    try {
      const deleteResult = await db.orderProcessingLog.deleteMany({
        where: {
          id: { in: logIds },
          shop
        }
      });
      return { success: true, intent, count: deleteResult.count };
    } catch (e: unknown) {
      return { error: (e as Error).message || "Failed to delete selected order logs" };
    }
  }

  return { error: "Unknown intent" };
};

const SyncIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-.73" />
  </svg>
);

export default function OrdersDashboard() {
  const { logs } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [syncing, setSyncing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "pending" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selection states
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);

  useEffect(() => {
    if (fetcher.data?.success) {
      setSyncing(false);
      if (fetcher.data.intent === "sync_orders") {
        shopify.toast.show(`Sync complete! Registered ${fetcher.data.syncedCount} new personalized orders.`);
      } else if (fetcher.data.intent === "delete_order") {
        shopify.toast.show("Order log entry deleted.");
      } else if (fetcher.data.intent === "bulk_delete") {
        shopify.toast.show(`Successfully deleted ${fetcher.data.count} order logs.`);
      }
    } else if (fetcher.data?.error) {
      setSyncing(false);
      shopify.toast.show(`Error: ${fetcher.data.error}`);
    }
  }, [fetcher.data, shopify]);

  // Reset page and selection when filter changes
  useEffect(() => {
    setSelectedLogIds([]);
    setCurrentPage(1);
  }, [filterStatus, searchQuery, startDate, endDate]);

  const handleSyncOrders = () => {
    setSyncing(true);
    fetcher.submit({ intent: "sync_orders" }, { method: "POST" });
  };

  const handleDeleteRow = (logId: string) => {
    if (confirm("Are you sure you want to delete this order log?")) {
      fetcher.submit({ intent: "delete_order", logId }, { method: "POST" });
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Are you sure you want to delete the ${selectedLogIds.length} selected order logs?`)) {
      fetcher.submit(
        { intent: "bulk_delete", logIds: JSON.stringify(selectedLogIds) },
        { method: "POST" }
      );
    }
  };

  const handleBulkDownload = () => {
    selectedLogIds.forEach((logId, index) => {
      const log = logs.find(l => l.id === logId);
      if (log) {
        setTimeout(() => {
          const downloadUrl = `/apps/personalizer/download?orderId=${log.orderId}`;
          const a = document.createElement("a");
          a.href = downloadUrl;
          a.download = "";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, index * 400); // 400ms delay to bypass browser popup limits
      }
    });
  };

  const handleSelectRow = (id: string) => {
    setSelectedLogIds(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (visibleLogs: { id: string }[]) => {
    const visibleIds = visibleLogs.map(l => l.id);
    const allSelected = visibleIds.every(id => selectedLogIds.includes(id));
    
    if (allSelected) {
      setSelectedLogIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedLogIds(prev => {
        const next = [...prev];
        visibleIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  // Filter logs logic
  const filteredLogs = logs.filter(log => {
    const matchesStatus = filterStatus === "all" || log.status.toLowerCase() === filterStatus;
    const matchesSearch = log.orderId.includes(searchQuery) || (log.error && log.error.includes(searchQuery));
    
    let matchesDate = true;
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      matchesDate = matchesDate && new Date(log.createdAt) >= start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(log.createdAt) <= end;
    }
    
    return matchesStatus && matchesSearch && matchesDate;
  });

  // Pagination logs slice
  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <s-page heading="Orders">

      <style>{`
        /* Tab Filter Bar */
        .orders-tabs {
          display: flex;
          background: #fafafa;
          border-bottom: 1px solid #ebebeb;
          padding: 0 16px;
        }
        .tab-btn {
          background: none;
          border: none;
          padding: 14px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #6d7175;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          transition: all 0.2s ease;
          position: relative;
        }
        .tab-btn:hover {
          color: #1a1a1a;
        }
        .tab-btn.active {
          color: #1a1a1a;
          border-bottom-color: #1a1a1a;
        }

        /* Filter Controls & Toolbar */
        .toolbar-wrapper {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 16px;
          border-bottom: 1px solid #ebebeb;
          background: #ffffff;
        }
        .filter-tools {
          display: flex;
          gap: 12px;
          align-items: center;
          width: 100%;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .search-icon {
          position: absolute;
          left: 12px;
          color: #8c9196;
          display: flex;
          align-items: center;
        }
        .orders-input {
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 14px;
          background: #ffffff;
          color: #1a1a1a;
          box-sizing: border-box;
          outline: none;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .orders-input:focus {
          border-color: #1a1a1a;
          box-shadow: 0 0 0 1px #1a1a1a, 0 0 0 3px rgba(26, 26, 26, 0.15);
        }
        .search-input {
          padding-left: 36px;
          width: 240px;
        }

        /* Custom Dropdown Date Picker */
        .date-picker-trigger-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 600;
          color: #202223;
          cursor: pointer;
          transition: background-color 0.15s, border-color 0.15s;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          outline: none;
        }
        .date-picker-trigger-btn:hover {
          background-color: #f6f6f7;
          border-color: #94a3b8;
        }
        .calendar-icon, .chevron-icon {
          color: #6d7175;
        }
        .date-picker-dropdown-popover {
          position: absolute;
          right: 0;
          top: 40px;
          z-index: 100;
          background: #ffffff;
          border: 1.5px solid #ebebeb;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
          min-width: 280px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .date-inputs-row {
          display: flex;
          gap: 10px;
        }
        .date-input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }
        .date-input-group label {
          font-size: 11px;
          font-weight: 600;
          color: #6d7175;
          text-transform: uppercase;
        }
        .date-field-input {
          width: 100%;
          padding: 6px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 13px;
        }
        .date-picker-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
          margin-top: 4px;
        }
        .clear-dates-btn {
          background: none;
          border: none;
          color: #d92d20;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 4px;
        }
        .apply-dates-btn {
          background: #1a1a1a;
          color: #ffffff;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.15s;
        }
        .apply-dates-btn:hover {
          background: #303030;
        }

        /* Page sync button (top actions) */
        .orders-page-sync-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ffffff;
          color: #202223;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.15s ease, border-color 0.15s ease;
          line-height: 1;
          outline: none;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        .orders-page-sync-btn:hover:not(:disabled) {
          background-color: #f6f6f7;
          border-color: #94a3b8;
        }
        .orders-page-sync-btn:disabled {
          background-color: #f1f2f4;
          color: #8c9196;
          cursor: not-allowed;
          border-color: #cbd5e1;
        }
        .sync-icon-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .sync-icon-wrapper.spinning {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Bulk Action Bar */
        .bulk-actions-bar {
          background: #f8fafc;
          border: 1.5px solid #ebebeb;
          border-radius: 8px;
          padding: 12px 18px;
          margin: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
        }
        .bulk-selection-count {
          font-size: 13px;
          font-weight: 600;
          color: #1a1a1a;
        }
        .bulk-actions-buttons {
          display: flex;
          gap: 8px;
        }
        .bulk-btn {
          border: none;
          padding: 8px 14px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
        }
        .bulk-download-btn {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #1a1a1a;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        .bulk-download-btn:hover {
          background: #f6f6f7;
          border-color: #94a3b8;
        }
        .bulk-delete-btn {
          background: #d82c0d;
          color: #ffffff;
        }
        .bulk-delete-btn:hover {
          background: #be250a;
        }

        /* Unified Card container */
        .orders-card-container {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #ebebeb;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
          overflow: hidden;
          margin-top: 20px;
        }

        /* Table Card and styling */
        .table-card {
          background: #ffffff;
          overflow: hidden;
        }
        .orders-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13px;
        }
        .orders-table th {
          padding: 14px 16px;
          font-weight: 600;
          color: #6d7175;
          background: #fafafa;
          border-bottom: 1px solid #ebebeb;
          user-select: none;
          text-transform: uppercase;
          font-size: 12px;
        }
        .orders-table td {
          padding: 16px;
          border-bottom: 1px solid #f3f3f3;
          color: #202223;
          vertical-align: middle;
        }
        .orders-table tbody tr:not(.expanded-row):hover {
          background: #fcfcfc;
          cursor: pointer;
        }
        .orders-table tbody tr.expanded {
          background: #fafafa;
        }
        .checkbox-cell {
          width: 24px;
          padding-right: 0 !important;
          text-align: center;
        }
        .checkbox-input {
          cursor: pointer;
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1px solid #babfc3;
        }

        /* Status Badges */
        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
        }
        .badge-completed {
          background: #e6f4ea;
          color: #137333;
        }
        .badge-pending {
          background: #fef7e0;
          color: #b06000;
        }
        .badge-failed {
          background: #fce8e6;
          color: #c5221f;
        }

        /* Action Buttons */
        .download-zip-link {
          color: #008060;
          font-weight: 600;
          text-decoration: none;
          font-size: 13px;
        }
        .download-zip-link:hover {
          text-decoration: underline;
        }
        .view-svg-link {
          color: #6d7175;
          font-weight: 500;
          text-decoration: none;
          font-size: 13px;
        }
        .view-svg-link:hover {
          color: #1a1a1a;
          text-decoration: underline;
        }
        .row-delete-action-btn {
          background: none;
          border: none;
          color: #6d7175;
          cursor: pointer;
          padding: 6px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .row-delete-action-btn:hover {
          color: #d92d20;
          background: #fde8e8;
        }

        /* Expander Coordinates Panel */
        .expanded-details-wrapper {
          background: #ffffff;
          border: 1px solid #ebebeb;
          border-radius: 8px;
          padding: 16px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
        }
        .details-title {
          margin: 0 0 12px 0;
          font-size: 13px;
          font-weight: 700;
          color: #1a1a1a;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .details-section-label {
          font-size: 11px;
          font-weight: 700;
          color: #6d7175;
          display: block;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .details-table {
          width: 100%;
          font-size: 12px;
          border-collapse: collapse;
        }
        .details-table td {
          padding: 6px 0;
          border-bottom: none;
          color: #202223;
        }
        .details-table td.label-col {
          color: #6d7175;
          width: 150px;
        }
        .details-table td.val-col {
          font-weight: 600;
        }
        .offset-font {
          font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
        }

        /* Empty state */
        .empty-state-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          max-width: 400px;
          margin: 0 auto;
        }
        .empty-state-heading {
          font-size: 14px;
          font-weight: 700;
          color: #202223;
          letter-spacing: 0.05em;
          margin: 0;
        }
        .empty-state-subheading {
          font-size: 11px;
          font-weight: 600;
          color: #6d7175;
          letter-spacing: 0.05em;
          margin: 0;
        }

        /* Pagination & Footer */
        .pagination-bar {
          padding: 14px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #ebebeb;
          background: #fafafa;
        }
        .page-size-selector {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #6d7175;
        }
        .orders-input.size-select {
          padding: 4px 8px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          background: #fff;
          cursor: pointer;
        }
        .pagination-nav {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .page-num-indicator {
          font-size: 13px;
          font-weight: 600;
          color: #202223;
        }
        .pagination-arrow {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #202223;
          transition: all 0.15s;
        }
        .pagination-arrow:hover:not(:disabled) {
          background: #f6f6f7;
        }
        .pagination-arrow:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          border-color: #cbd5e1;
          color: #8c9196;
        }
      `}</style>

      <div className="orders-card-container">
        {/* Card Header matching Templates & Product Options pages */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 16px 20px" }}>
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "#1a1a1a" }}>Orders</h2>
            <p style={{ fontSize: "13px", color: "#6d7175", margin: "4px 0 0 0" }}>
              Track buyer customizations, sync manufacturing files, and download fulfillment packages.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSyncOrders}
            disabled={syncing}
            className="orders-page-sync-btn"
          >
            <span className={`sync-icon-wrapper ${syncing ? "spinning" : ""}`} style={{ marginRight: "6px" }}>
              <SyncIcon />
            </span>
            {syncing ? "Syncing..." : "Sync Orders"}
          </button>
        </div>

        {/* Quick Filter Horizontal Tabs */}
        <OrdersFilterTabs
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          logs={logs}
        />

        {/* Search, Date Range Toolbar */}
        <OrdersToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />

        {/* Bulk Selection Actions Bar */}
        <OrdersBulkActionBar
          selectedCount={selectedLogIds.length}
          handleBulkDownload={handleBulkDownload}
          handleBulkDelete={handleBulkDelete}
        />

        {/* Orders Log Table card */}
        <OrdersTable
          paginatedLogs={paginatedLogs}
          selectedLogIds={selectedLogIds}
          handleSelectRow={handleSelectRow}
          handleSelectAll={handleSelectAll}
          expandedLogId={expandedLogId}
          setExpandedLogId={setExpandedLogId}
          handleDeleteRow={handleDeleteRow}
          filteredLogsCount={filteredLogs.length}
          pageSize={pageSize}
          setPageSize={setPageSize}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalPages={totalPages}
        />
      </div>
    </s-page>
  );
}
