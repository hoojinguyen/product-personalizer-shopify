import { Outlet } from "react-router";
import { useLayoutContext } from "./LayoutContext";

// ─── AppLayout ────────────────────────────────────────────────────────────────
//
// This component does ONE thing: provides the shared sticky save bar.
//
// All page-level chrome (title, breadcrumbs, primary actions) is owned by each
// individual route — rendered inside Shopify's <s-page> web component which
// already implements the Polaris Page header. Adding a second header here
// caused the double-title breakage reported by the user.
//
// Save bar: slides up from the bottom only when saveBar.isDirty is true.
// Used exclusively by the Settings page (delegates via updateSaveBar context).

export function AppLayout() {
  const { saveBar } = useLayoutContext();
  const isVisible = !!saveBar?.isDirty;

  return (
    <>
      {isVisible && (
        <style>{`
          .agl-save-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 200;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 24px;
            background: #ffffff;
            border-top: 1px solid #e1e3e5;
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.10);
            animation: agl-slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          @keyframes agl-slide-up {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
          .agl-save-bar__label {
            flex: 1;
            font-size: 13px;
            color: #6d7175;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          .agl-save-bar__discard {
            background: #ffffff;
            color: #202223;
            border: 1px solid #babfc3;
            border-radius: 6px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
            transition: background 0.15s ease;
            line-height: 1;
          }
          .agl-save-bar__discard:hover:not(:disabled) {
            background: #f6f6f7;
          }
          .agl-save-bar__discard:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .agl-save-bar__save {
            background: #008060;
            color: #ffffff;
            border: none;
            border-radius: 6px;
            padding: 8px 20px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
            min-width: 80px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: background 0.15s ease;
            line-height: 1;
          }
          .agl-save-bar__save:hover:not(:disabled) {
            background: #006e52;
          }
          .agl-save-bar__save:disabled {
            background: #c8ede1;
            cursor: not-allowed;
          }
          .agl-spinner {
            width: 13px;
            height: 13px;
            border: 2px solid rgba(255, 255, 255, 0.35);
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: agl-spin 0.6s linear infinite;
          }
          @keyframes agl-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      )}

      {/* Route content — s-page inside each route owns all page chrome */}
      <Outlet />

      {/* Shared sticky save bar — only Settings uses this */}
      {isVisible && (
        <div className="agl-save-bar" role="region" aria-label="Unsaved changes">
          <span className="agl-save-bar__label">You have unsaved changes</span>
          <button
            className="agl-save-bar__discard"
            onClick={saveBar!.onDiscard}
            disabled={saveBar!.isSaving}
          >
            Discard
          </button>
          <button
            className="agl-save-bar__save"
            onClick={saveBar!.onSave}
            disabled={saveBar!.isSaving}
          >
            {saveBar!.isSaving ? <span className="agl-spinner" aria-hidden /> : null}
            {saveBar!.isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </>
  );
}
