import React from "react";

interface OrdersBulkActionBarProps {
  selectedCount: number;
  handleBulkDownload: () => void;
  handleBulkDelete: () => void;
}

export function OrdersBulkActionBar({
  selectedCount,
  handleBulkDownload,
  handleBulkDelete,
}: OrdersBulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="bulk-actions-bar">
      <div className="bulk-selection-count">
        Selected {selectedCount} orders for batch execution
      </div>
      <div className="bulk-actions-buttons">
        <button
          type="button"
          onClick={handleBulkDownload}
          className="bulk-btn bulk-download-btn"
        >
          📦 Bulk Download Packages
        </button>
        <button
          type="button"
          onClick={handleBulkDelete}
          className="bulk-btn bulk-delete-btn"
        >
          🗑️ Bulk Delete Logs
        </button>
      </div>
    </div>
  );
}
