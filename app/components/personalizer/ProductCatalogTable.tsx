import { useState, useEffect } from "react";
import { SearchIcon, PlusIcon, ImageIcon, DuplicateIcon, ExportIcon, TrashIcon, EditIcon, EyeballIcon, ExternalLinkIcon } from "./Icons";

interface ProductCatalogTableProps {
  products: any[];
  shop: string;
  onConfigureProduct: (product: any) => void;
  onDeleteOptions: (product: any) => void;
  onDuplicateOptions: (product: any) => void;
  onExportJson: (product: any) => void;
  onToggleStatus: (product: any, currentEnabled: boolean) => void;
  savingStatusToggleId: string | null;
  onOpenAddModal: () => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkActivate: (ids: string[]) => void;
  onBulkDeactivate: (ids: string[]) => void;
}

export function ProductCatalogTable({
  products,
  shop,
  onConfigureProduct,
  onDeleteOptions,
  onDuplicateOptions,
  onExportJson,
  onToggleStatus,
  savingStatusToggleId,
  onOpenAddModal,
  onBulkDelete,
  onBulkActivate,
  onBulkDeactivate
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

  // Close active dropdown menu when clicking outside of it
  useEffect(() => {
    if (activeActionsDropdownId === null) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".row-actions-wrapper")) {
        setActiveActionsDropdownId(null);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, [activeActionsDropdownId]);

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

  const executeBulkActivate = () => {
    if (bulkSelectedIds.length > 0) {
      onBulkActivate(bulkSelectedIds);
      setBulkSelectedIds([]);
    }
  };

  const executeBulkDeactivate = () => {
    if (bulkSelectedIds.length > 0) {
      onBulkDeactivate(bulkSelectedIds);
      setBulkSelectedIds([]);
    }
  };

  return (
    <div className="product-options-card-container">
      {/* Page Header inside card */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 16px 20px" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "#1a1a1a" }}>Product Options</h1>
          <p style={{ fontSize: "13px", color: "#6d7175", margin: "4px 0 0 0" }}>
            Configure fields, upcharges, and coordinate layouts for your customizable store products.
          </p>
        </div>
        <button className="btn-primary" onClick={onOpenAddModal}>
          <PlusIcon style={{ strokeWidth: "3px", marginRight: "4px" }} /> Add Customizable Product
        </button>
      </div>

      {/* Bulk Operations Bar */}
      {bulkSelectedIds.length > 0 && (
        <div className="bulk-actions-bar" style={{
          background: "#f8fafc",
          border: "1.5px solid #ebebeb",
          borderRadius: "8px",
          padding: "12px 18px",
          margin: "0 20px 16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)"
        }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>
            Selected <strong>{bulkSelectedIds.length}</strong> {bulkSelectedIds.length === 1 ? "product" : "products"}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn-secondary" style={{ color: "#1a1a1a", border: "1px solid #cbd5e1", background: "#ffffff", display: "inline-flex", alignItems: "center" }} onClick={executeBulkActivate}>
              <span className="polaris-status-dot polaris-status-dot-active" style={{ marginRight: "6px" }} /> Activate Options
            </button>
            <button className="btn-secondary" style={{ color: "#6d7175", border: "1px solid #babfc3", background: "#ffffff", display: "inline-flex", alignItems: "center" }} onClick={executeBulkDeactivate}>
              <span className="polaris-status-dot polaris-status-dot-inactive" style={{ marginRight: "6px" }} /> Inactivate Options
            </button>
            <button className="btn-danger" style={{ background: "#d82c0d", color: "#ffffff", border: "none", display: "inline-flex", alignItems: "center" }} onClick={executeBulkDelete}>
              <TrashIcon style={{ width: "13px", height: "13px", strokeWidth: "2.5px", marginRight: "6px" }} /> Remove Configurations
            </button>
          </div>
        </div>
      )}

      {/* Filter Toolbar row */}
      <div className="search-and-filters">
        <div className="search-field-wrapper">
          <SearchIcon className="search-field-icon" />
          <input
            type="text"
            placeholder="Search customizer catalog..."
            className="search-field-input"
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
                <td colSpan={6} style={{ padding: "48px 24px", textAlign: "center" }}>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "16px",
                    maxWidth: "400px",
                    margin: "0 auto"
                  }}>
                    <div style={{
                      width: "60px",
                      height: "60px",
                      background: "#f1f2f4",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                      color: "#6d7175"
                    }}>
                      🔍
                    </div>
                    <div style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "#202223"
                    }}>
                      No products found
                    </div>
                    <p style={{
                      fontSize: "13px",
                      color: "#6d7175",
                      margin: 0,
                      lineHeight: "1.5"
                    }}>
                      Try changing the search query, clearing filters, or adding a new customizable product.
                    </p>
                    {(searchQuery || vendorFilter || tagFilter) && (
                      <button
                        className="btn-secondary"
                        style={{ marginTop: "8px" }}
                        onClick={() => {
                          setSearchQuery("");
                          setVendorFilter("");
                          setTagFilter("");
                          setCurrentPage(1);
                        }}
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
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
                const shopName = shop.replace("https://", "").replace("http://", "").split(".")[0];
                const numericProductId = p.id.split("/").pop() || "";
                const adminProductUrl = `https://admin.shopify.com/store/${shopName}/products/${numericProductId}`;
                const storefrontProductUrl = `https://${shop}/products/${p.handle}`;

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
                        <div style={{ width: "40px", height: "40px", background: "#f1f2f4", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", color: "#8c9196" }}>
                          <ImageIcon />
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "14px", color: "#202223" }}>{p.title}</div>
                      <div style={{ fontSize: "12px", color: "#6d7175" }}>
                        ID: {p.id.split("/").pop()} | Vendor: {p.vendor || "N/A"}
                      </div>
                    </td>
                    <td>
                      <span className="pill-tag" style={{ background: optCount > 0 ? "#f1f2f4" : "#f1f2f4", color: optCount > 0 ? "#1a1a1a" : "#6d7175", fontWeight: optCount > 0 ? "bold" : "normal" }}>
                        {optCount} Layers
                      </span>
                      {p.tags?.slice(0, 2).map((t: string) => (
                        <span key={t} className="pill-tag">{t}</span>
                      ))}
                    </td>
                    <td>
                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <label className="polaris-switch">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            disabled={savingStatusToggleId === p.id}
                            onChange={() => onToggleStatus(p, isEnabled)}
                          />
                          <span className="polaris-switch-track">
                            <span className="polaris-switch-thumb">
                              {savingStatusToggleId === p.id && <span className="polaris-switch-spinner" />}
                            </span>
                          </span>
                        </label>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row-actions-wrapper" style={{ display: "flex", gap: "4px", justifyContent: "flex-end", alignItems: "center", position: "relative" }}>
                        <button className="btn-tertiary" style={{ padding: "6px 10px", fontSize: "13px", whiteSpace: "nowrap" }} onClick={() => onConfigureProduct(p)}>
                          <EditIcon style={{ marginRight: "4px" }} /> Edit
                        </button>
                        
                        <button
                          className="btn-tertiary"
                          style={{ padding: "6px 8px", fontSize: "13px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveActionsDropdownId(activeActionsDropdownId === p.id ? null : p.id);
                          }}
                        >
                          ⋮
                        </button>

                        {activeActionsDropdownId === p.id && (
                          <div style={{
                            position: "absolute",
                            right: "0px",
                            top: "32px",
                            background: "#ffffff",
                            border: "1.5px solid #ebebeb",
                            borderRadius: "8px",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                            zIndex: 1000,
                            display: "flex",
                            flexDirection: "column",
                            minWidth: "180px",
                            textAlign: "left",
                            padding: "6px"
                          }}>
                            <a
                              href={storefrontProductUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: "8px 12px",
                                border: "none",
                                background: "none",
                                fontSize: "13px",
                                cursor: "pointer",
                                width: "100%",
                                boxSizing: "border-box",
                                textAlign: "left",
                                borderRadius: "4px",
                                color: "#202223",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                textDecoration: "none"
                              }}
                              className="dropdown-item-hover"
                              onClick={() => setActiveActionsDropdownId(null)}
                            >
                              <EyeballIcon style={{ width: "14px", height: "14px" }} /> Preview Storefront
                            </a>
                            <a
                              href={adminProductUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: "8px 12px",
                                border: "none",
                                background: "none",
                                fontSize: "13px",
                                cursor: "pointer",
                                width: "100%",
                                boxSizing: "border-box",
                                textAlign: "left",
                                borderRadius: "4px",
                                color: "#202223",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                textDecoration: "none"
                              }}
                              className="dropdown-item-hover"
                              onClick={() => setActiveActionsDropdownId(null)}
                            >
                              <ExternalLinkIcon style={{ width: "14px", height: "14px" }} /> View in Admin
                            </a>
                            <div style={{ borderTop: "1.5px solid #ebebeb", margin: "4px 6px" }} />
                            <button
                              style={{
                                padding: "8px 12px",
                                border: "none",
                                background: "none",
                                fontSize: "13px",
                                cursor: "pointer",
                                width: "100%",
                                textAlign: "left",
                                borderRadius: "4px",
                                color: "#202223",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px"
                              }}
                              className="dropdown-item-hover"
                              onClick={() => {
                                onDuplicateOptions(p);
                                setActiveActionsDropdownId(null);
                              }}
                            >
                              <DuplicateIcon /> Duplicate to another...
                            </button>
                            <button
                              style={{
                                padding: "8px 12px",
                                border: "none",
                                background: "none",
                                fontSize: "13px",
                                cursor: "pointer",
                                width: "100%",
                                textAlign: "left",
                                borderRadius: "4px",
                                color: "#202223",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px"
                              }}
                              className="dropdown-item-hover"
                              onClick={() => {
                                onExportJson(p);
                                setActiveActionsDropdownId(null);
                              }}
                            >
                              <ExportIcon /> Export config JSON
                            </button>
                            <div style={{ borderTop: "1.5px solid #ebebeb", margin: "4px 6px" }} />
                            <button
                              style={{
                                padding: "8px 12px",
                                border: "none",
                                background: "none",
                                fontSize: "13px",
                                color: "#d82c0d",
                                cursor: "pointer",
                                width: "100%",
                                textAlign: "left",
                                borderRadius: "4px",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px"
                              }}
                              className="dropdown-item-hover-danger"
                              onClick={() => {
                                onDeleteOptions(p);
                                setActiveActionsDropdownId(null);
                              }}
                            >
                              <TrashIcon style={{ strokeWidth: "2.5px" }} /> Delete settings
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        {sortedProducts.length > 0 && (
          <div className="pagination-bar">
            <div style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "13px" }}>
              <span>Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(parseInt(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
              >
                {[5, 10, 15, 20, 30, 50, 100].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span style={{ color: "#6d7175" }}>
                Showing {Math.min(sortedProducts.length, (currentPage - 1) * itemsPerPage + 1)} - {Math.min(sortedProducts.length, currentPage * itemsPerPage)} of {sortedProducts.length} results
              </span>
            </div>
            
            {totalPages > 1 && (
              <div className="pagination-nav">
                <button
                  className="pagination-arrow"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  ←
                </button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    className={`page-num ${currentPage === i + 1 ? "active" : ""}`}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  className="pagination-arrow"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                >
                  →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
