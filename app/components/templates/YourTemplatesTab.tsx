import React from "react";

interface YourTemplatesTabProps {
  templates: any[];
  products: any[];
  paginatedTemplates: any[];
  setSearchTerm: (term: string) => void;
  setSelectedTemplate: (template: any) => void;
  setIsModalOpen: (open: boolean) => void;
  setCustomizerLoading: (loading: boolean) => void;
  setCanvasZoom: (zoom: number) => void;
  initialStateRef: React.MutableRefObject<string>;
  getCurrentStateSnapshot: () => string;
  handleOpenLinkModal: (id: string) => void;
  handleDuplicateTemplate: (id: string) => void;
  handleDeleteTemplate: (id: string, linkedCount: string[]) => void;
  totalItems: number;
  pageSize: number;
  setPageSize: (size: number) => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
}

export const YourTemplatesTab: React.FC<YourTemplatesTabProps> = ({
  templates,
  products,
  paginatedTemplates,
  setSearchTerm,
  setSelectedTemplate,
  setIsModalOpen,
  setCustomizerLoading,
  setCanvasZoom,
  initialStateRef,
  getCurrentStateSnapshot,
  handleOpenLinkModal,
  handleDuplicateTemplate,
  handleDeleteTemplate,
  totalItems,
  pageSize,
  setPageSize,
  currentPage,
  setCurrentPage,
  totalPages,
}) => {
  return (
    <>
      <table className="template-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Description</th>
            <th style={{ textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {paginatedTemplates.length === 0 ? (
            <tr>
              <td colSpan={3} style={{ textAlign: "center", color: "#6d7175", padding: "40px" }}>
                {templates.length === 0 ? (
                  'You haven\'t created any templates yet. Click "Create new Template" to begin.'
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                    <span>No custom templates match your search.</span>
                    <button
                      type="button"
                      className="btn-text-action"
                      style={{ border: "1px solid #babfc3", padding: "4px 12px", fontSize: "12px" }}
                      onClick={() => setSearchTerm("")}
                    >
                      Clear search
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ) : (
            paginatedTemplates.map((t: any) => {
              // Count GIDs linked to this template ID
              const linkedCount = products.filter((p: any) => {
                if (p.metafield?.value) {
                  try {
                    return JSON.parse(p.metafield.value).templateId === t.id;
                  } catch (err) {}
                }
                return false;
              }).map((p: any) => p.id);

              return (
                <tr key={t.id}>
                  <td>
                    <button
                      onClick={() => {
                        setSelectedTemplate(t);
                        setIsModalOpen(true);
                        setCustomizerLoading(true);
                        setCanvasZoom(100);
                        setTimeout(() => {
                          setCustomizerLoading(false);
                          setTimeout(() => { initialStateRef.current = getCurrentStateSnapshot(); }, 50);
                        }, 800);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        font: "inherit",
                        fontWeight: 700,
                        color: "#2c3e50",
                        cursor: "pointer",
                        textAlign: "left"
                      }}
                    >
                      {t.name}
                    </button>
                    {linkedCount.length > 0 && (
                      <span style={{ marginLeft: "8px", fontSize: "11px", color: "#303030", background: "#f1f2f4", padding: "2px 6px", borderRadius: "10px", fontWeight: "bold" }}>
                        Linked: {linkedCount.length}
                      </span>
                    )}
                  </td>
                  <td style={{ color: "#6d7175", fontSize: "13px" }}>
                    {t.description || <span style={{ fontStyle: "italic", color: "#b2b2b2" }}>No description provided</span>}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                      <button
                        className="btn-text-action"
                        onClick={() => handleOpenLinkModal(t.id)}
                      >
                        Use Template
                      </button>
                      <button
                        title="Edit Template Blueprint"
                        aria-label="Edit Template Blueprint"
                        className="action-icon-btn"
                        onClick={() => {
                          setSelectedTemplate(t);
                          setIsModalOpen(true);
                          setCustomizerLoading(true);
                          setCanvasZoom(100);
                          setTimeout(() => {
                            setCustomizerLoading(false);
                            setTimeout(() => { initialStateRef.current = getCurrentStateSnapshot(); }, 50);
                          }, 800);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      </button>
                      <button
                        title="Duplicate Template"
                        aria-label="Duplicate Template"
                        className="action-icon-btn"
                        onClick={() => handleDuplicateTemplate(t.id)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                      <button
                        title="Delete Template"
                        aria-label="Delete Template"
                        className="action-icon-btn danger"
                        onClick={() => handleDeleteTemplate(t.id, linkedCount)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      
      {/* Pagination Controls */}
      {totalItems > 0 && (
        <div className="pagination-bar">
          <div style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "13px" }}>
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #babfc3", background: "#fff" }}
            >
              {[5, 10, 15, 20, 30, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <span style={{ color: "#6d7175" }}>
              Showing {Math.min(totalItems, (currentPage - 1) * pageSize + 1)} - {Math.min(totalItems, currentPage * pageSize)} of {totalItems} results
            </span>
          </div>
          
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
        </div>
      )}
    </>
  );
};
