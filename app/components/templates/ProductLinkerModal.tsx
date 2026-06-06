import React, { useState, useEffect } from "react";

interface ProductLinkerModalProps {
  isLinkModalOpen: boolean;
  setIsLinkModalOpen: (open: boolean) => void;
  products: any[];
  linkedProducts: string[];
  toggleProductLink: (id: string) => void;
  handleSaveProductLinks: () => void;
  setLinkedProducts: React.Dispatch<React.SetStateAction<string[]>>;
}

export const ProductLinkerModal: React.FC<ProductLinkerModalProps> = ({
  isLinkModalOpen,
  setIsLinkModalOpen,
  products,
  linkedProducts,
  toggleProductLink,
  handleSaveProductLinks,
  setLinkedProducts,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  // Reset search query when modal opens/closes
  useEffect(() => {
    if (isLinkModalOpen) {
      setSearchQuery("");
    }
  }, [isLinkModalOpen]);

  if (!isLinkModalOpen) return null;

  // Filter products by search query
  const filteredProducts = products.filter((p: any) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="generic-modal-overlay">
      <style>{`
        .product-linker-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
        }
        .product-linker-item:hover {
          border-color: #94a3b8 !important;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
        }
        .product-linker-item.linked:hover {
          border-color: #006e52 !important;
        }
      `}</style>
      <div className="generic-modal-card">
        <div className="generic-modal-header">
          <h3>Link template to Shopify store products</h3>
          <button
            style={{ border: "none", background: "none", fontSize: "16px", cursor: "pointer" }}
            onClick={() => setIsLinkModalOpen(false)}
          >
            ✕
          </button>
        </div>
        
        <div className="generic-modal-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "#6d7175", lineHeight: "1.4" }}>
            Select the products below to synchronize and enable this template configuration. Previously linked products that you uncheck will have their configurations disabled.
          </span>

          {/* Search bar wrapper */}
          <div style={{ position: "relative" }}>
            <input
              type="text"
              className="custom-input"
              placeholder="Search products by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 32px",
                fontSize: "13px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1"
              }}
            />
            <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#8c9196", display: "inline-flex", alignItems: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
          </div>

          {/* Selection Actions & Count */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => {
                  const filteredIds = filteredProducts.map(p => p.id);
                  const uniqueIds = Array.from(new Set([...linkedProducts, ...filteredIds]));
                  setLinkedProducts(uniqueIds);
                }}
                style={{ border: "none", background: "none", color: "#008060", fontWeight: "bold", cursor: "pointer", padding: 0 }}
              >
                Select All Filtered
              </button>
              <span style={{ color: "#cbd5e1" }}>|</span>
              <button
                type="button"
                onClick={() => {
                  const filteredIds = filteredProducts.map(p => p.id);
                  const remainingIds = linkedProducts.filter(id => !filteredIds.includes(id));
                  setLinkedProducts(remainingIds);
                }}
                style={{ border: "none", background: "none", color: "#d92d20", fontWeight: "bold", cursor: "pointer", padding: 0 }}
              >
                Clear Filtered
              </button>
            </div>
            <span style={{ color: "#6d7175", fontWeight: 600 }}>
              {linkedProducts.length} selected
            </span>
          </div>
          
          {/* Scrollable list of products */}
          <div style={{
            maxHeight: "300px",
            overflowY: "auto",
            border: "1px solid #ebebeb",
            borderRadius: "6px",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
            {filteredProducts.length === 0 ? (
              <span style={{ padding: "20px", textAlign: "center", color: "#8c9196", fontSize: "13px" }}>
                No products found matching your search.
              </span>
            ) : (
              filteredProducts.map((p: any) => {
                const isLinked = linkedProducts.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`product-linker-item ${isLinked ? "linked" : ""}`}
                    style={{
                      background: isLinked ? "#f0fbf7" : "#ffffff",
                      border: isLinked ? "1px solid #008060" : "1px solid #cbd5e1"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isLinked}
                      onChange={() => toggleProductLink(p.id)}
                      style={{ accentColor: "#008060", cursor: "pointer" }}
                    />
                    {p.featuredImage?.url ? (
                      <img
                        src={p.featuredImage.url}
                        alt=""
                        style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px", border: "1px solid #ebebeb" }}
                      />
                    ) : (
                      <div style={{ width: "32px", height: "32px", background: "#f1f2f4", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #ebebeb", fontSize: "14px" }}>
                        📦
                      </div>
                    )}
                    <span style={{ fontSize: "13px", fontWeight: 600, color: isLinked ? "#008060" : "#1a1a1a" }}>
                      {p.title}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="generic-modal-footer">
          <button
            className="customizer-btn"
            onClick={() => setIsLinkModalOpen(false)}
          >
            Cancel
          </button>
          <button
            className="customizer-btn primary"
            onClick={handleSaveProductLinks}
          >
            Apply Links
          </button>
        </div>
      </div>
    </div>
  );
};
