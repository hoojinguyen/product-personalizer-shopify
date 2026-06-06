import React from "react";

interface BuiltInTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  options: string;
}

interface BuiltInTemplatesTabProps {
  filteredBuiltIn: BuiltInTemplate[];
  setSelectedTemplate: (template: any) => void;
  setIsPreviewModalOpen: (open: boolean) => void;
  handleDuplicateBuiltIn: (builtin: BuiltInTemplate) => void;
  handleOpenLinkModal: (id: string) => void;
  setSearchTerm: (term: string) => void;
}

export const BuiltInTemplatesTab: React.FC<BuiltInTemplatesTabProps> = ({
  filteredBuiltIn,
  setSelectedTemplate,
  setIsPreviewModalOpen,
  handleDuplicateBuiltIn,
  handleOpenLinkModal,
  setSearchTerm,
}) => {
  return (
    <table className="template-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Tags</th>
          <th style={{ textAlign: "right" }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {filteredBuiltIn.length === 0 ? (
          <tr>
            <td colSpan={3} style={{ textAlign: "center", color: "#6d7175", padding: "40px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <span>No built-in templates match your search.</span>
                <button
                  type="button"
                  className="btn-text-action"
                  style={{ border: "1px solid #babfc3", padding: "4px 12px", fontSize: "12px" }}
                  onClick={() => setSearchTerm("")}
                >
                  Clear search
                </button>
              </div>
            </td>
          </tr>
        ) : (
          filteredBuiltIn.map((builtin) => (
            <tr key={builtin.id}>
              <td style={{ fontWeight: 600 }}>{builtin.name}</td>
              <td>
                {builtin.tags.map((tag, i) => (
                  <span key={i} className="badge-tag">{tag}</span>
                ))}
              </td>
              <td style={{ textAlign: "right" }}>
                <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                  <button
                    title="Preview Template Design"
                    aria-label="Preview Template Design"
                    className="action-icon-btn"
                    onClick={() => {
                      setSelectedTemplate({
                        id: builtin.id,
                        name: builtin.name,
                        description: builtin.description,
                        options: builtin.options
                      });
                      setIsPreviewModalOpen(true);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button
                    title="Duplicate to Your Templates"
                    aria-label="Duplicate to Your Templates"
                    className="action-icon-btn"
                    onClick={() => handleDuplicateBuiltIn(builtin)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                  <button
                    className="btn-text-action"
                    onClick={() => handleOpenLinkModal(builtin.id)}
                  >
                    Use Template
                  </button>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
};
