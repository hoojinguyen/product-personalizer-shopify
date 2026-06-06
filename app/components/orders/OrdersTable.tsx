import { Fragment } from "react";
import { OrderDetailsPanel } from "./OrderDetailsPanel";

interface OrderLog {
  id: string;
  orderId: string;
  status: string;
  error?: string | null;
  createdAt: string | Date;
  printFileUrl?: string | null;
  [key: string]: unknown;
}

interface OrdersTableProps {
  paginatedLogs: OrderLog[];
  selectedLogIds: string[];
  handleSelectRow: (id: string) => void;
  handleSelectAll: (visibleLogs: { id: string }[]) => void;
  expandedLogId: string | null;
  setExpandedLogId: (id: string | null) => void;
  handleDeleteRow: (logId: string) => void;
  filteredLogsCount: number;
  pageSize: number;
  setPageSize: (size: number) => void;
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  totalPages: number;
}

export function OrdersTable({
  paginatedLogs,
  selectedLogIds,
  handleSelectRow,
  handleSelectAll,
  expandedLogId,
  setExpandedLogId,
  handleDeleteRow,
  filteredLogsCount,
  pageSize,
  setPageSize,
  currentPage,
  setCurrentPage,
  totalPages,
}: OrdersTableProps) {
  return (
    <div className="table-card">
      <table className="orders-table">
        <thead>
          <tr>
            <th className="checkbox-cell">
              <input
                type="checkbox"
                checked={paginatedLogs.length > 0 && paginatedLogs.every(l => selectedLogIds.includes(l.id))}
                onChange={() => handleSelectAll(paginatedLogs)}
                className="checkbox-input"
              />
            </th>
            <th>Order No</th>
            <th>Date</th>
            <th>Download</th>
            <th>Delete</th>
          </tr>
        </thead>
        <tbody>
          {paginatedLogs.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: "80px 24px", textAlign: "center" }}>
                <div className="empty-state-wrapper">
                  <svg className="empty-state-icon" viewBox="0 0 100 100" width="80" height="80" style={{ marginBottom: "16px" }}>
                    <circle cx="50" cy="50" r="40" fill="#f1f2f4" />
                    <path d="M35 25h23l12 12v38H35Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M58 25v12h12" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" strokeLinejoin="round" />
                    <line x1="42" y1="48" x2="62" y2="48" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                    <line x1="42" y1="55" x2="62" y2="55" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                    <line x1="42" y1="62" x2="54" y2="62" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                    <rect x="42" y="34" width="10" height="10" fill="#e67e22" rx="1.5" />
                  </svg>
                  <h3 className="empty-state-heading">NO RECENT ORDERS FOUND</h3>
                  <p className="empty-state-subheading">YOU WILL SEE RECENT CUSTOMIZED ORDERS HERE</p>
                </div>
              </td>
            </tr>
          ) : (
            paginatedLogs.map(log => {
              const isCompleted = log.status === "COMPLETED";
              const isFailed = log.status === "FAILED";
              const isExpanded = expandedLogId === log.id;
              const isChecked = selectedLogIds.includes(log.id);

              return (
                <Fragment key={log.id}>
                  <tr
                    className={isExpanded ? "expanded" : ""}
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  >
                    <td className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleSelectRow(log.id)}
                        className="checkbox-input"
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, color: "#1a1a1a" }}>
                          #{log.orderId}
                        </span>
                        <span className={`status-badge ${
                          isCompleted ? "badge-completed" : isFailed ? "badge-failed" : "badge-pending"
                        }`}>
                          {log.status.toLowerCase()}
                        </span>
                      </div>
                      {log.error && (
                        <div style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "4px" }}>
                          Error: {log.error}
                        </div>
                      )}
                    </td>
                    <td style={{ color: "#6d7175" }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                        <a
                          href={`/apps/personalizer/download?orderId=${log.orderId}`}
                          download
                          className="download-zip-link"
                        >
                          Download ZIP
                        </a>
                        {log.printFileUrl ? (
                          <a
                            href={log.printFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="view-svg-link"
                          >
                            View SVG
                          </a>
                        ) : (
                          <span style={{ color: "#8c9196", fontSize: "12px", fontStyle: "italic" }}>
                            {isCompleted ? "SVG Cached" : "Compiling..."}
                          </span>
                        )}
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(log.id)}
                        className="row-delete-action-btn"
                        title="Delete Order Log"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="expanded-row" style={{ background: "#fdfdfd" }}>
                      <td colSpan={5} style={{ padding: "16px 24px", borderBottom: "1px solid #ebebeb" }}>
                        <OrderDetailsPanel log={log} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>

      {/* Footer Controls & Pagination */}
      <div className="pagination-bar">
        <div className="page-size-selector">
          <span>Show:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
            className="orders-input size-select"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="showing-results-text">
            {filteredLogsCount === 0 ? (
              "Showing 0 - 0 of 0 results"
            ) : (
              `Showing ${Math.min(filteredLogsCount, (currentPage - 1) * pageSize + 1)} - ${Math.min(filteredLogsCount, currentPage * pageSize)} of ${filteredLogsCount} results`
            )}
          </span>
        </div>

        <div className="pagination-nav">
          <button
            type="button"
            disabled={currentPage === 1 || filteredLogsCount === 0}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="pagination-arrow"
            title="Previous Page"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <span className="page-num-indicator">
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            type="button"
            disabled={currentPage === totalPages || totalPages === 0 || filteredLogsCount === 0}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="pagination-arrow"
            title="Next Page"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
