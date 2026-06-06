import React from "react";
import { Modal } from "../shared/Modal";

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
  const footer = (
    <>
      <button
        className="btn-secondary"
        onClick={onCancel}
      >
        {cancelLabel}
      </button>
      <button
        className="btn-primary"
        onClick={onConfirm}
        style={{
          backgroundColor: isDestructive ? "var(--color-danger)" : "var(--brand-color)",
          borderColor: isDestructive ? "var(--color-danger)" : "var(--brand-color-hover)"
        }}
      >
        {confirmLabel}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={onCancel}
      footer={footer}
      width="420px"
      zIndex={1050}
    >
      {message}
    </Modal>
  );
}
