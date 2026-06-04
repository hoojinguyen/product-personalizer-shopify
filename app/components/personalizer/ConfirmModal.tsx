import React from "react";
import { CloseIcon } from "./Icons";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 1050 }}>
      <div className="modal-card" style={{ width: "420px", borderRadius: "8px", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)" }}>
        
        <div className="modal-header" style={{ padding: "14px 20px" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#202223" }}>{title}</h3>
          <button
            className="modal-close"
            onClick={onCancel}
            aria-label="Close"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "none", cursor: "pointer", padding: 0 }}
          >
            <CloseIcon style={{ width: "14px", height: "14px" }} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: "20px", fontSize: "14px", lineHeight: "1.5", color: "#202223" }}>
          {message}
        </div>

        <div className="modal-footer" style={{ padding: "12px 20px", justifyContent: "flex-end", gap: "8px" }}>
          <button
            className="btn-secondary"
            onClick={onCancel}
            style={{ border: "1px solid #babfc3", color: "#6d7175", background: "#ffffff", padding: "6px 12px", fontSize: "13px" }}
          >
            {cancelLabel}
          </button>
          <button
            className="btn-primary"
            onClick={onConfirm}
            style={{
              backgroundColor: isDestructive ? "#d82c0d" : "#008060",
              color: "#ffffff",
              border: "none",
              padding: "6px 12px",
              fontWeight: 600,
              borderRadius: "6px",
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            {confirmLabel}
          </button>
        </div>

      </div>
    </div>
  );
}
