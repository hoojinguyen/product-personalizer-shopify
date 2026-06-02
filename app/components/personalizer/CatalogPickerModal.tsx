import { useState } from "react";

interface CatalogPickerModalProps {
  isOpen: boolean;
  products: any[];
  onClose: () => void;
  onAdd: (productId: string) => void;
}

export function CatalogPickerModal({
  isOpen,
  products,
  onClose,
  onAdd
}: CatalogPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBy, setSearchBy] = useState("all");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter products that do not have customization configured
  const pickerProducts = products.filter((p: any) => {
    const isConfig = p.metafield?.value ? JSON.parse(p.metafield.value).enabled : false;
    const query = searchQuery.toLowerCase();
    
    // Only show unconfigured products in the add options modal to prevent duplicate setup
    if (isConfig) return false;
    
    if (searchBy === "all") {
      return (
        p.title.toLowerCase().includes(query) ||
        (p.vendor && p.vendor.toLowerCase().includes(query))
      );
    }
    if (searchBy === "title") {
      return p.title.toLowerCase().includes(query);
    }
    if (searchBy === "vendor") {
      return p.vendor && p.vendor.toLowerCase().includes(query);
    }
    return true;
  });

  const handleAdd = () => {
    if (selectedProductId) {
      onAdd(selectedProductId);
      setSelectedProductId(null);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        
        <div className="modal-header">
          <h3>Add Product Customizer</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: "13px", color: "#6d7175", margin: "0 0 16px 0" }}>
            Select an unconfigured product from your store catalog to apply personalization config.
          </p>

          {/* Search controls inside modal */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <div className="search-wrapper" style={{ flex: 2 }}>
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search store catalog..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "#6d7175", whiteSpace: "nowrap" }}>Search by:</span>
              <select
                value={searchBy}
                onChange={(e) => setSearchBy(e.target.value)}
                className="filter-select"
                style={{ padding: "6px 10px", fontSize: "13px", minWidth: "120px" }}
              >
                <option value="all">All</option>
                <option value="title">Product Title</option>
                <option value="vendor">Vendor</option>
              </select>
            </div>
          </div>

          {/* Product rows container */}
          <div style={{ maxHeight: "360px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
            {pickerProducts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#8c9196", fontSize: "13px" }}>
                No unconfigured products found matching the query.
              </div>
            ) : (
              pickerProducts.map((p: any) => {
                const isSelected = selectedProductId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px",
                      border: isSelected ? "2px solid #008060" : "1px solid #e1e3e5",
                      borderRadius: "8px",
                      background: isSelected ? "#f0fbf7" : "#ffffff",
                      cursor: "pointer",
                      transition: "all 0.15s"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      style={{ accentColor: "#008060", width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    {p.featuredImage?.url ? (
                      <img src={p.featuredImage.url} alt="" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }} />
                    ) : (
                      <div style={{ width: "40px", height: "40px", background: "#f1f2f4", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>📦</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.title}
                      </div>
                      <div style={{ fontSize: "11px", color: "#6d7175" }}>
                        Vendor: {p.vendor}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="modal-footer">
          <span style={{ fontSize: "13px", fontWeight: 600 }}>
            {selectedProductId ? "1 product selected" : "0 products selected"}
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="btn-secondary"
              onClick={onClose}
              style={{ border: "1px solid #babfc3", color: "#6d7175", background: "#ffffff" }}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={!selectedProductId}
              onClick={handleAdd}
              style={{
                backgroundColor: selectedProductId ? "#008060" : "#ebebeb",
                color: selectedProductId ? "#ffffff" : "#8c9196",
                cursor: selectedProductId ? "pointer" : "not-allowed",
                border: "none",
                padding: "8px 16px",
                fontWeight: 600,
                borderRadius: "6px"
              }}
            >
              Add
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
