import { useState } from "react";
import { SearchIcon, ImageIcon } from "./Icons";
import { Modal } from "../shared/Modal";

interface CatalogPickerModalProps {
  isOpen: boolean;
  products: any[];
  onClose: () => void;
  onAdd: (selectedIds: string[]) => void;
}

export function CatalogPickerModal({
  isOpen,
  products,
  onClose,
  onAdd
}: CatalogPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBy, setSearchBy] = useState("all");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

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

  const handleToggleProduct = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      setSelectedProductIds(selectedProductIds.filter(id => id !== productId));
    } else {
      setSelectedProductIds([...selectedProductIds, productId]);
    }
  };

  const handleAdd = () => {
    if (selectedProductIds.length > 0) {
      onAdd(selectedProductIds);
      setSelectedProductIds([]);
    }
  };

  const footer = (
    <>
      <span style={{ fontSize: "13px", fontWeight: 600 }}>
        {selectedProductIds.length === 1 ? "1 product selected" : `${selectedProductIds.length} products selected`}
      </span>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          className="btn-secondary"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="btn-primary"
          disabled={selectedProductIds.length === 0}
          onClick={handleAdd}
        >
          Add
        </button>
      </div>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      title="Select Products to Configure"
      onClose={onClose}
      footer={footer}
      width="500px"
    >
      <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: "0 0 16px 0" }}>
        Select one or more unconfigured products from your store catalog to apply personalization config.
      </p>

      {/* Search controls inside modal */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <div className="search-wrapper" style={{ flex: 2 }}>
          <SearchIcon className="search-icon" />
          <input
            type="text"
            placeholder="Search store catalog..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>Search by:</span>
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
          <div style={{ textAlign: "center", padding: "30px", color: "var(--color-text-secondary)", fontSize: "13px" }}>
            No unconfigured products found matching the query.
          </div>
        ) : (
          pickerProducts.map((p: any) => {
            const isSelected = selectedProductIds.includes(p.id);
            return (
              <div
                key={p.id}
                onClick={() => handleToggleProduct(p.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px",
                  border: isSelected ? "2px solid var(--brand-color)" : "1px solid var(--color-border-divider)",
                  borderRadius: "8px",
                  background: isSelected ? "#f0fbf7" : "var(--color-bg-surface)",
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  style={{ accentColor: "var(--brand-color)", width: "16px", height: "16px", cursor: "pointer" }}
                />
                {p.featuredImage?.url ? (
                  <img src={p.featuredImage.url} alt="" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }} />
                ) : (
                  <div style={{ width: "40px", height: "40px", background: "var(--color-bg-primary)", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-secondary)" }}>
                    <ImageIcon />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--color-text-secondary)" }}>
                    Vendor: {p.vendor}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
