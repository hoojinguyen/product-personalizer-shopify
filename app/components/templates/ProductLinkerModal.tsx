import React from "react";

interface ProductLinkerModalProps {
  isLinkModalOpen: boolean;
  setIsLinkModalOpen: (open: boolean) => void;
  products: any[];
  linkedProducts: string[];
  toggleProductLink: (id: string) => void;
  handleSaveProductLinks: () => void;
}

export const ProductLinkerModal: React.FC<ProductLinkerModalProps> = ({
  isLinkModalOpen,
  setIsLinkModalOpen,
  products,
  linkedProducts,
  toggleProductLink,
  handleSaveProductLinks,
}) => {
  if (!isLinkModalOpen) return null;

  return (
    <div className="generic-modal-overlay">
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
        
        <div className="generic-modal-body" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <span style={{ fontSize: "13px", color: "#6d7175" }}>
            Select the products below to synchronize and enable this template configuration. Previously linked products that you uncheck will have their configurations disabled.
          </span>
          
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
            {products.length === 0 ? (
              <span style={{ padding: "20px", textAlign: "center", color: "#8c9196" }}>No products found in this store</span>
            ) : (
              products.map((p: any) => {
                const isLinked = linkedProducts.includes(p.id);
                return (
                  <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", background: isLinked ? "#fafafa" : "#ffffff", border: isLinked ? "1px solid #1a1a1a" : "1px solid #cbd5e1", transition: "all 0.1s ease" }}>
                    <input
                      type="checkbox"
                      checked={isLinked}
                      onChange={() => toggleProductLink(p.id)}
                      style={{ accentColor: "#1a1a1a", cursor: "pointer" }}
                    />
                    {p.featuredImage?.url ? (
                      <img src={p.featuredImage.url} alt="" style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px" }} />
                    ) : (
                      <div style={{ width: "32px", height: "32px", background: "#f1f2f4", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>📦</div>
                    )}
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a1a" }}>{p.title}</span>
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
