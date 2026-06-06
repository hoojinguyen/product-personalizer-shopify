import React, { Fragment } from "react";
import { OrderDetailsPanel } from "./OrderDetailsPanel";

interface OrderLog {
  id: string;
  orderId: string;
  status: string;
  error?: string | null;
  createdAt: string | Date;
  printFileUrl?: string | null;
  [key: string]: any;
}

interface OrdersTableProps {
  paginatedLogs: OrderLog[];
  selectedLogIds: string[];
  handleSelectRow: (id: string) => void;
  handleSelectAll: (visibleLogs: any[]) => void;
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
  if (filteredLogsCount === 0) {
    return (
      <div className="empty-state-card">
        <div className="empty-state-title">No Recent Orders Found</div>
        <div>
          There are currently no customized orders that match your filter parameters.
          Click &quot;Sync Recent Orders&quot; to fetch recent sales from your store database.
        </div>
      </div>
    );
  }

  return (
    <>
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
              <th>Order ID</th>
              <th>Sync Time</th>
              <th>Fulfillment Status</th>
              <th>Manufacturing File</th>
              <th>Fulfillment ZIP</th>
              <th style={{ width: "60px", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLogs.map(log => {
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
                    <td style={{ fontWeight: 600, color: "#2c6ecb" }}>
                      #{log.orderId}
                    </td>
                    <td style={{ color: "#6d7175" }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <span className={`status-badge ${
                        isCompleted ? "badge-completed" : isFailed ? "badge-failed" : "badge-pending"
                      }`}>
                        {log.status.toLowerCase()}
                      </span>
                      {log.error && (
                        <div style={{ fontSize: "11px", color: "#c5221f", marginTop: "4px" }}>
                          ⚠️ {log.error}
                        </div>
                      )}
                    </td>
                    <td>
                      {log.printFileUrl ? (
                        <a
                          href={log.printFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="action-link"
                        >
                          📄 View SVG Layout
                        </a>
                      ) : (
                        <span style={{ color: "#6d7175", fontStyle: "italic" }}>
                          {isCompleted ? "Generic SVG Cached" : "Compiling..."}
                        </span>
                      )}
                    </td>
                    <td>
                      <a
                        href={`/apps/personalizer/download?orderId=${log.orderId}`}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="zip-download-btn"
                      >
                        📦 Download ZIP
                      </a>
                    </td>
                    <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(log.id)}
                        title="Delete Order Log"
                        className="row-delete-btn"
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
                      <td colSpan={7} style={{ padding: "16px 24px", borderBottom: "1px solid #e1e3e5" }}>
                        <OrderDetailsPanel log={log} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Controls & Pagination */}
      <div className="footer-wrapper">
        <div className="page-size-selector">
          <span>Show:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
            className="orders-input"
            style={{ padding: "6px 8px" }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>
            Showing {Math.min(filteredLogsCount, (currentPage - 1) * pageSize + 1)} - {Math.min(filteredLogsCount, currentPage * pageSize)} of {filteredLogsCount} results
          </span>
        </div>

        <div className="pagination-controls">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="pagination-arrow"
            title="Previous Page"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <span className="page-indicator">
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            type="button"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="pagination-arrow"
            title="Next Page"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

        <div className="help-links">
          <a href="#docs" className="help-link"> Documentation</a>
          <a href="#contact" className="help-link"> Contact Us</a>
        </div>
      </div>
    </>
  );
}
