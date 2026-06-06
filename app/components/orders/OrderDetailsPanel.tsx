import React from "react";

interface OrderLog {
  id: string;
  orderId: string;
  status: string;
  error?: string | null;
  createdAt: string | Date;
}

interface OrderDetailsPanelProps {
  log: OrderLog;
}

export function OrderDetailsPanel({ log }: OrderDetailsPanelProps) {
  return (
    <div className="expanded-details-wrapper">
      <h4 className="details-title">
        📋 Personalization Manufacturing Coordinates Log
      </h4>
      
      <div className="details-grid">
        <div>
          <span className="details-section-label">Registered Options Attributes:</span>
          <table className="details-table">
            <tbody>
              <tr>
                <td className="label-col">Product Type:</td>
                <td className="val-col">Custom Personalized Chronograph</td>
              </tr>
              <tr>
                <td className="label-col">Custom Text:</td>
                <td className="val-col">&quot;H.N.&quot;</td>
              </tr>
              <tr>
                <td className="label-col">Selected Typography:</td>
                <td className="val-col">Cursive Elegant (TTF)</td>
              </tr>
              <tr>
                <td className="label-col">Selected Color Hex:</td>
                <td className="val-col" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#3E2723", border: "1px solid #d2d5d8" }} />
                  #3E2723 (Dark Brown)
                </td>
              </tr>
              <tr>
                <td className="label-col">Upcharge Added:</td>
                <td className="val-col" style={{ color: "#008060" }}>+$5.00</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div>
          <span className="details-section-label">Visual Positioning Offsets:</span>
          <table className="details-table">
            <tbody>
              <tr>
                <td className="label-col">X Coordinate Offset:</td>
                <td className="val-col offset-font">400 px</td>
              </tr>
              <tr>
                <td className="label-col">Y Coordinate Offset:</td>
                <td className="val-col offset-font">380 px</td>
              </tr>
              <tr>
                <td className="label-col">Scale Factor Dimension:</td>
                <td className="val-col offset-font">200 W x 100 H</td>
              </tr>
              <tr>
                <td className="label-col">Rotation Angle Degrees:</td>
                <td className="val-col offset-font">0°</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
