import React from "react";

interface OrdersToolbarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  handleSyncOrders: () => void;
  syncing: boolean;
}

export function OrdersToolbar({
  searchQuery,
  setSearchQuery,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  handleSyncOrders,
  syncing,
}: OrdersToolbarProps) {
  return (
    <div className="toolbar-wrapper">
      <div className="filter-tools">
        <div className="search-wrapper">
          <span className="search-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search by Order ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="orders-input search-input"
          />
        </div>

        <div className="date-picker-wrapper">
          <span>From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="orders-input"
          />
          <span>To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="orders-input"
          />
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => { setStartDate(""); setEndDate(""); }}
              style={{ background: "none", border: "none", color: "#c5221f", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}
            >
              Clear Dates
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSyncOrders}
        disabled={syncing}
        className="sync-btn"
      >
        {syncing ? (
          <>🔄 Syncing Shopify Orders...</>
        ) : (
          <>📥 Import & Sync Shopify Orders</>
        )}
      </button>
    </div>
  );
}
