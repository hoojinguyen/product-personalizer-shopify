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

  const handleSelectAll = (visibleLogs: typeof logs) => {
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
    <s-page heading="Orders Customization Portal">
      <style>{`
        .orders-dashboard-wrapper {
          font-family: -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
          color: #202223;
        }
        
        /* Tab Filter Bar */
        .orders-tabs {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid #e1e3e5;
          margin-bottom: 20px;
          padding-bottom: 4px;
        }
        .tab-btn {
          background: none;
          border: none;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          color: #6d7175;
          cursor: pointer;
          border-radius: 6px 6px 0 0;
          transition: all 0.15s ease;
          position: relative;
        }
        .tab-btn:hover {
          background: #f1f2f4;
          color: #202223;
        }
        .tab-btn.active {
          color: #008060;
          font-weight: 600;
        }
        .tab-btn.active::after {
          content: "";
          position: absolute;
          bottom: -5px;
          left: 0;
          right: 0;
          height: 3px;
          background: #008060;
          border-radius: 3px 3px 0 0;
        }

        /* Filter Controls */
        .toolbar-wrapper {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .filter-tools {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .search-icon {
          position: absolute;
          left: 10px;
          color: #8c9196;
        }
        .orders-input {
          padding: 8px 12px;
          border: 1px solid #babfc3;
          border-radius: 8px;
          font-size: 13px;
          background: #ffffff;
          color: #202223;
          box-sizing: border-box;
          transition: border-color 0.15s ease;
        }
        .orders-input:focus {
          border-color: #008060;
          outline: none;
          box-shadow: 0 0 0 2px rgba(0, 128, 96, 0.08);
        }
        .search-input {
          padding-left: 32px;
          width: 220px;
        }
        .date-picker-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #6d7175;
        }
        .sync-btn {
          background: #008060;
          color: #ffffff;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background 0.15s;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        .sync-btn:hover:not(:disabled) {
          background: #006e52;
        }
        .sync-btn:disabled {
          background: #f1f2f4;
          color: #8c9196;
          cursor: not-allowed;
          border: 1px solid #e1e3e5;
          box-shadow: none;
        }

        /* Bulk Action Bar */
        .bulk-actions-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #002e25;
          color: #ffffff;
          padding: 10px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          animation: slideDown 0.2s ease-out;
        }
        .bulk-selection-count {
          font-weight: 600;
          font-size: 13px;
        }
        .bulk-actions-buttons {
          display: flex;
          gap: 8px;
        }
        .bulk-btn {
          border: none;
          padding: 6px 12px;
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
          background: #008060;
          color: #ffffff;
        }
        .bulk-download-btn:hover {
          background: #006e52;
        }
        .bulk-delete-btn {
          background: #c5221f;
          color: #ffffff;
        }
        .bulk-delete-btn:hover {
          background: #a51d1a;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Table Card */
        .table-card {
          background: #ffffff;
          border: 1px solid #e1e3e5;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        .orders-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13px;
        }
        .orders-table th {
          padding: 10px 16px;
          font-weight: 600;
          color: #202223;
          background: #f9fafb;
          border-bottom: 1px solid #e1e3e5;
          user-select: none;
        }
        .orders-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #e1e3e5;
          color: #202223;
        }
        .orders-table tbody tr {
          transition: background 0.15s;
        }
        .orders-table tbody tr:not(.expanded-row):hover {
          background: #f9fafb;
          cursor: pointer;
        }
        .orders-table tbody tr.expanded {
          background: #f4f6f8;
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
          padding: 3px 8px;
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
        .action-link {
          color: #008060;
          font-weight: 600;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .action-link:hover {
          text-decoration: underline;
        }
        .zip-download-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #2c3e50;
          color: #fff;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: background 0.15s;
        }
        .zip-download-btn:hover {
          background: #1a252f;
        }
        .row-delete-btn {
          background: none;
          border: none;
          color: #c5221f;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .row-delete-btn:hover {
          background: #fce8e6;
        }

        /* Expander Coordinates Panel */
        .expanded-details-wrapper {
          background: #ffffff;
          border: 1px solid #e1e3e5;
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
        .empty-state-card {
          padding: 48px;
          border: 1px dashed #babfc3;
          border-radius: 8px;
          text-align: center;
          background: #fafbfb;
          color: #6d7175;
        }
        .empty-state-title {
          font-size: 15px;
          font-weight: 600;
          color: #202223;
          margin-bottom: 4px;
        }

        /* Pagination & Footer */
        .footer-wrapper {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .page-size-selector {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #6d7175;
        }
        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .page-indicator {
          font-size: 13px;
          color: #202223;
        }
        .pagination-arrow {
          background: #ffffff;
          border: 1px solid #babfc3;
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
          border-color: #e1e3e5;
          color: #8c9196;
        }
        .help-links {
          display: flex;
          gap: 16px;
        }
        .help-link {
          color: #008060;
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
        }
        .help-link:hover {
          text-decoration: underline;
        }
      `}</style>

      <s-section heading="Personalized Orders Fulfillment Command Center">
        <s-paragraph>
          Track buyer customizations and sync manufacturing files. Select an order to review detailed coordinates or bulk-download full **Fulfillment Packages** as compressed ZIP files to route directly to laser engravers or screenprint shops.
        </s-paragraph>

        <div className="orders-dashboard-wrapper">
          {/* Quick Filter Horizontal Tabs */}
          <OrdersFilterTabs
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            logs={logs}
          />

          {/* Search, Date Range, & Sync Toolbar */}
          <OrdersToolbar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            handleSyncOrders={handleSyncOrders}
            syncing={syncing}
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
      </s-section>
    </s-page>
  );
}
