import React from "react";
import { CloseIcon } from "../personalizer/Icons";

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  width?: string;
  zIndex?: number;
}

export function Modal({
  isOpen,
  title,
  onClose,
  children,
  footer,
  className = "",
  width = "500px",
  zIndex = 1040
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex }}>
      <div className={`modal-card ${className}`} style={{ width }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
