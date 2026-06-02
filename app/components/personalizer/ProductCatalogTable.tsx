import { useState } from "react";

interface ProductCatalogTableProps {
  products: any[];
  onConfigureProduct: (product: any) => void;
  onDeleteOptions: (product: any) => void;
  onDuplicateOptions: (product: any) => void;
  onExportJson: (product: any) => void;
  onToggleStatus: (product: any, currentEnabled: boolean) => void;
  savingStatusToggleId: string | null;
  onOpenAddModal: () => void;
  onBulkDelete: (ids: string[]) => void;
}

export function ProductCatalogTable({
  products,
  onConfigureProduct,
  onDeleteOptions,
  onDuplicateOptions,
  onExportJson,
  onToggleStatus,
  savingStatusToggleId,
  onOpenAddModal,
  onBulkDelete
}: ProductCatalogTableProps) {
  // Local list sorting & search states
  const [searchQuery, setSearchQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortKey, setSortKey] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [activeActionsDropdownId, setActiveActionsDropdownId] = useState<string | null>(null);

  // Extract unique filters from product list
  const vendors = Array.from(new Set(products.map((p: any) => p.vendor).filter(Boolean))) as string[];
  const tagsList = Array.from(new Set(products.flatMap((p: any) => p.tags || []).filter(Boolean))) as string[];

  // Perform search / filtering logic
  const filteredProducts = products.filter((p: any) => {
    const titleMatch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
    const vendorMatch = vendorFilter ? p.vendor === vendorFilter : true;
    const tagMatch = tagFilter ? p.tags?.includes(tagFilter) : true;
    return titleMatch && vendorMatch && tagMatch;
  });

  // Perform sorting
  const sortedProducts = [...filteredProducts].sort((a: any, b: any) => {
    const isAConfig = a.metafield?.value ? JSON.parse(a.metafield.value).enabled : false;
    const isBConfig = b.metafield?.value ? JSON.parse(b.metafield.value).enabled : false;
    
    if (sortKey === "alphabetical_asc") return a.title.localeCompare(b.title);
    if (sortKey === "alphabetical_desc") return b.title.localeCompare(a.title);
    if (sortKey === "status_active") return (isBConfig ? 1 : 0) - (isAConfig ? 1 : 0);
    return 0; // Newest/default order
  });

  // Calculate pagination boundaries
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage) || 1;
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setBulkSelectedIds(paginatedProducts.map(p => p.id));
    } else {
      setBulkSelectedIds([]);
    }
  };

  const handleSelectRow = (productId: string, checked: boolean) => {
    if (checked) {
      setBulkSelectedIds([...bulkSelectedIds, productId]);
    } else {
      setBulkSelectedIds(bulkSelectedIds.filter(id => id !== productId));
    }
  };

  const executeBulkDelete = () => {
    if (bulkSelectedIds.length > 0) {
      onBulkDelete(bulkSelectedIds);
      setBulkSelectedIds([]);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Personalizable Products</h1>
          <p style={{ fontSize: "13px", color: "#6d7175", margin: "4px 0 0 0" }}>
            Configure fields, upcharges, and coordinate layouts for your customizable store products.
          </p>
        </div>
        <button className="btn-primary" onClick={onOpenAddModal}>
          ➕ Set Customizer config
        </button>
      </div>

      {/* Bulk Operations Bar */}
      {bulkSelectedIds.length > 0 && (
        <div className="bulk-actions-bar">
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#006e52" }}>
            {bulkSelectedIds.length} products selected for action
          </span>
          <button className="btn-danger" onClick={executeBulkDelete}>
            🗑️ Delete Customizer for selected
          </button>
        </div>
      )}

      {/* Filter Toolbar row */}
      <div className="search-filters-row">
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search customizer catalog..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <select
          className="filter-select"
          value={vendorFilter}
          onChange={(e) => {
            setVendorFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="">Filter by Vendor</option>
          {vendors.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={tagFilter}
          onChange={(e) => {
            setTagFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="">Filter by Tag</option>
          {tagsList.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={sortKey}
          onChange={(e) => {
            setSortKey(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="newest">Sort by: Newest</option>
          <option value="alphabetical_asc">Alphabetical (A-Z)</option>
          <option value="alphabetical_desc">Alphabetical (Z-A)</option>
          <option value="status_active">Status: Active first</option>
        </select>
      </div>

      {/* Primary Configured Product Catalog Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: "40px" }}>
                <input
                  type="checkbox"
                  checked={paginatedProducts.length > 0 && paginatedProducts.every(p => bulkSelectedIds.includes(p.id))}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th style={{ width: "60px" }}>Image</th>
              <th>Product Details</th>
              <th>Config Options</th>
              <th>Status</th>
              <th style={{ width: "120px", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#8c9196" }}>
                  No configured products found matching the criteria. Click "Set Customizer config" to add one.
                </td>
              </tr>
            ) : (
              paginatedProducts.map((p: any) => {
                let isEnabled = false;
                let optCount = 0;
                if (p.metafield?.value) {
                  try {
                    const parsed = JSON.parse(p.metafield.value);
                    isEnabled = parsed.enabled ?? false;
                    optCount = parsed.options?.length ?? 0;
                  } catch (e) {}
                }

                const isRowSelected = bulkSelectedIds.includes(p.id);

                return (
                  <tr key={p.id} style={{ background: isRowSelected ? "#f9fafb" : "transparent" }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isRowSelected}
                        onChange={(e) => handleSelectRow(p.id, e.target.checked)}
                      />
                    </td>
                    <td>
                      {p.featuredImage?.url ? (
                        <img src={p.featuredImage.url} alt="" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }} />
                      ) : (
                        <div style={{ width: "40px", height: "40px", background: "#f1f2f4", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>📦</div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "#202223" }}>{p.title}</div>
                      <div style={{ fontSize: "12px", color: "#6d7175" }}>
                        ID: {p.id.split("/").pop()} | Vendor: {p.vendor || "N/A"}
                      </div>
                    </td>
                    <td>
                      <span className="pill-tag" style={{ background: optCount > 0 ? "#e2f1eb" : "#f1f2f4", color: optCount > 0 ? "#008060" : "#6d7175" }}>
                        {optCount} Layers
                      </span>
                      {p.tags?.slice(0, 2).map((t: string) => (
                        <span key={t} className="pill-tag">{t}</span>
                      ))}
                    </td>
                    <td>
                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <label className="status-toggle">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            disabled={savingStatusToggleId === p.id}
                            onChange={() => onToggleStatus(p, isEnabled)}
                          />
                          <span className="status-slider" />
                        </label>
                        {savingStatusToggleId === p.id && <div className="spinner-overlay" />}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", position: "relative" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => onConfigureProduct(p)}>
                          🔧 Edit Layout
                        </button>
                        
                        <button
                          className="btn-secondary"
                          style={{ padding: "6px 8px", fontSize: "12px" }}
                          onClick={() => setActiveActionsDropdownId(activeActionsDropdownId === p.id ? null : p.id)}
                        >
                          ⋮
                        </button>

                        {activeActionsDropdownId === p.id && (
                          <>
                            <div
                              style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}
                              onClick={() => setActiveActionsDropdownId(null)}
                            />
                            <div style={{
                              position: "absolute",
                              right: "12px",
                              top: "36px",
                              background: "#ffffff",
                              border: "1px solid #babfc3",
                              borderRadius: "6px",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                              zIndex: 101,
                              display: "flex",
                              flexDirection: "column",
                              minWidth: "160px",
                              textAlign: "left"
                            }}>
                              <button
                                style={{ padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: "pointer", width: "100%", textAlign: "left" }}
                                onClick={() => {
                                  onDuplicateOptions(p);
                                  setActiveActionsDropdownId(null);
                                }}
                              >
                                👥 Duplicate to another...
                              </button>
                              <button
                                style={{ padding: "8px 12px", border: "none", background: "none", fontSize: "13px", cursor: "pointer", width: "100%", textAlign: "left" }}
                                onClick={() => {
                                  onExportJson(p);
                                  setActiveActionsDropdownId(null);
                                }}
                              >
                                📥 Export config JSON
                              </button>
                              <div style={{ borderTop: "1px solid #ebebeb", margin: "4px 0" }} />
                              <button
                                style={{ padding: "8px 12px", border: "none", background: "none", fontSize: "13px", color: "#d82c0d", cursor: "pointer", width: "100%", textAlign: "left" }}
                                onClick={() => {
                                  onDeleteOptions(p);
                                  setActiveActionsDropdownId(null);
                                }}
                              >
                                🗑️ Delete settings
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="pagination-footer">
            <span style={{ fontSize: "13px", color: "#6d7175" }}>
              Showing Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({sortedProducts.length} total products)
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </button>
              <button
                className="pagination-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
