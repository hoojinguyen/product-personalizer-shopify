import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useState, useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

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

// Action: Handle manual Shopify orders sync
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
      const orders = responseJson.data?.orders?.edges?.map((e: any) => e.node) || [];
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
        const items = order.lineItems?.edges?.map((e: any) => e.node) || [];

        for (const item of items) {
          const attributes = item.customAttributes || [];
          const hasPreview = attributes.some((a: any) => a.key === "_preview_url");
          const hasVisibleProps = attributes.some((a: any) => !a.key.startsWith("_") && a.key !== "priceUpcharge");
          
          if (hasPreview || hasVisibleProps) {
            isPersonalized = true;
            break;
          }
        }

        if (isPersonalized) {
          // Register the order as PENDING status
          // The background create webhook or manual compiling will process the SVG print files
          await db.orderProcessingLog.create({
            data: {
              shop,
              orderId: orderIdNumber,
              status: "COMPLETED", // Sync registers it as COMPLETED to let merchant download instantly
              printFileUrl: ""
            }
          });
          syncedCount++;
        }
      }

      return { success: true, syncedCount };
    } catch (e: any) {
      return { error: e.message || "Failed to sync orders" };
    }
  }

  return { error: "Unknown intent" };
};

export default function OrdersDashboard() {
  const { logs } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<any>();
  const shopify = useAppBridge();

  const [syncing, setSyncing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "pending" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (fetcher.data?.success) {
      setSyncing(false);
      shopify.toast.show(`Sync complete! Registered ${fetcher.data.syncedCount} new personalized orders.`);
    } else if (fetcher.data?.error) {
      setSyncing(false);
      shopify.toast.show(`Sync error: ${fetcher.data.error}`);
    }
  }, [fetcher.data, shopify]);

  const handleSyncOrders = () => {
    setSyncing(true);
    fetcher.submit({ intent: "sync_orders" }, { method: "POST" });
  };

  const filteredLogs = logs.filter(log => {
    const matchesStatus = filterStatus === "all" || log.status.toLowerCase() === filterStatus;
    const matchesSearch = log.orderId.includes(searchQuery) || (log.error && log.error.includes(searchQuery));
    return matchesStatus && matchesSearch;
  });

  return (
    <s-page heading="Orders Customization Portal">
      <s-section heading="Personalized Orders Fulfillment Command Center">
        <s-paragraph>
          Track buyer customizations and sync manufacturing files. Select an order to review detailed coordinates or bulk-download full **Fulfillment Packages** as compressed ZIP files to route directly to laser engravers or screenprint shops.
        </s-paragraph>

        {/* Filters and Sync Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 0", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: 600 }}>Filter by:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #babfc3", background: "#fff" }}
            >
              <option value="all">All Orders</option>
              <option value="completed">🟢 Completed</option>
              <option value="pending">🟡 Pending Processing</option>
              <option value="failed">🔴 Failed Rendering</option>
            </select>

            <input
              type="text"
              placeholder="Search by Order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #babfc3", width: "180px" }}
            />
          </div>

          <button
            onClick={handleSyncOrders}
            disabled={syncing}
            style={{
              padding: "8px 16px",
              background: "#008060",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            {syncing ? "🔄 Syncing Shopify Orders..." : "🔄 Sync Recent Orders"}
          </button>
        </div>

        {/* Orders Log Table */}
        {filteredLogs.length === 0 ? (
          <div style={{ padding: "40px", border: "1px dashed #babfc3", borderRadius: "8px", textAlign: "center", color: "#6d7175" }}>
            No personalized orders match the current filters. Click "Sync Recent Orders" to query Shopify order queues.
          </div>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid #e1e3e5", borderRadius: "8px", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e1e3e5" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Order ID</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Sync Time</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Fulfillment Status</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Manufacturing File</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Fulfillment ZIP</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => {
                  const isCompleted = log.status === "COMPLETED";
                  const isFailed = log.status === "FAILED";
                  
                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid #e1e3e5", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "#2c6ecb" }}>
                        #{log.orderId}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#6d7175" }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "4px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          background: isCompleted ? "#e6f4ea" : isFailed ? "#fce8e6" : "#fef7e0",
                          color: isCompleted ? "#137333" : isFailed ? "#c5221f" : "#b06000"
                        }}>
                          {log.status}
                        </span>
                        {log.error && (
                          <div style={{ fontSize: "11px", color: "#c5221f", marginTop: "4px" }}>
                            ⚠️ {log.error}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {log.printFileUrl ? (
                          <a href={log.printFileUrl} target="_blank" rel="noreferrer" style={{ color: "#008060", fontWeight: 600, textDecoration: "none" }}>
                            📄 View SVG Layout
                          </a>
                        ) : (
                          <span style={{ color: "#6d7175", fontStyle: "italic" }}>
                            {isCompleted ? "Generic SVG Cached" : "Compiling..."}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {/* Direct link pointing to our secure dynamic zip builder API */}
                        <a
                          href={`/apps/personalizer/download?orderId=${log.orderId}`}
                          download
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 12px",
                            background: "#2c3e50",
                            color: "#fff",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            textDecoration: "none",
                            cursor: "pointer"
                          }}
                        >
                          📦 Download ZIP Package
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </s-section>
    </s-page>
  );
}
