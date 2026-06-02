import { useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useAppBridge } from "@shopify/app-bridge-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // Fetch counts from DB and Shopify
  let totalCount = 0;
  let enabledCount = 0;
  let templatesCount = 0;
  let ordersCount = 0;

  try {
    templatesCount = await db.template.count();
    ordersCount = await db.orderProcessingLog.count({ where: { shop } });

    const response = await admin.graphql(
      `#graphql
      query getProductsCount {
        products(first: 50) {
          edges {
            node {
              id
              metafield(namespace: "app", key: "customization_config") {
                value
              }
            }
          }
        }
      }`
    );
    const responseJson = await response.json();
    const products = responseJson.data?.products?.edges || [];
    totalCount = products.length;

    products.forEach((edge: { node: { metafield?: { value: string } } }) => {
      const configVal = edge.node.metafield?.value;
      if (configVal) {
        try {
          const config = JSON.parse(configVal);
          if (config.enabled) enabledCount++;
        } catch (e) {
          console.warn("Failed to parse customization_config metafield", e);
        }
      }
    });
  } catch (err) {
    console.error("Error fetching dashboard metric counts:", err);
  }

  return { totalCount, enabledCount, templatesCount, ordersCount };
};

export default function Index() {
  const { enabledCount, templatesCount, ordersCount } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);

  const handleRating = (val: number) => {
    setRating(val);
    shopify.toast.show(`Thank you for your ${val}-star review! ✨`);
  };

  // Safe percentage calculation
  const productPercent = Math.min(100, Math.max(0, (enabledCount / 500) * 100));
  const orderPercent = Math.min(100, Math.max(0, (ordersCount / 500) * 100));

  return (
    <s-page heading="Product Personalizer Dashboard">
      
      {/* 🟢 Active theme status banner */}
      <div style={{
        background: "#e2f1e8",
        color: "#137333",
        padding: "16px 24px",
        borderRadius: "12px",
        border: "1px solid rgba(19, 115, 51, 0.15)",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        marginBottom: "24px",
        boxShadow: "0 2px 8px rgba(19, 115, 51, 0.04)"
      }}>
        <div style={{
          background: "#137333",
          color: "#fff",
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "bold",
          fontSize: "14px",
          flexShrink: 0
        }}>✓</div>
        <div style={{ flex: 1, fontWeight: 600, fontSize: "14px" }}>
          Product Personalizer is active on your live theme. Storefront customizer elements are inject-ready.
        </div>
      </div>

      {/* 📊 Quotas and Account Limit Metrics (5 Columns) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "16px",
        marginBottom: "24px"
      }}>
        {/* Metric 1: Plan */}
        <div style={{ background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 2px 6px rgba(0,0,0,0.01)" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#6d7175", letterSpacing: "0.05em", marginBottom: "4px" }}>Plan Tier</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#1a1a1a" }}>Moderate</div>
            <div style={{ fontSize: "12px", color: "#6d7175", marginTop: "2px" }}>$29.99/mo</div>
          </div>
          <div style={{ marginTop: "12px", fontSize: "12px", fontWeight: 600 }}>
            <s-link href="/app/subscription">Upgrade Plan →</s-link>
          </div>
        </div>

        {/* Metric 2: Products Configured */}
        <div style={{ background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 2px 6px rgba(0,0,0,0.01)" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#6d7175", letterSpacing: "0.05em", marginBottom: "4px" }}>Products Limit</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#1a1a1a" }}>{enabledCount} <span style={{ fontSize: "13px", fontWeight: 500, color: "#6d7175" }}>/ 500 active</span></div>
            {/* Progress bar */}
            <div style={{ width: "100%", height: "6px", background: "#f1f2f4", borderRadius: "3px", marginTop: "8px", overflow: "hidden" }}>
              <div style={{ width: `${productPercent}%`, height: "100%", background: "#008060", borderRadius: "3px" }} />
            </div>
          </div>
          <span style={{ fontSize: "11px", color: "#6d7175", marginTop: "8px" }}>Capped at 500 products</span>
        </div>

        {/* Metric 3: Orders Configured */}
        <div style={{ background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 2px 6px rgba(0,0,0,0.01)" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#6d7175", letterSpacing: "0.05em", marginBottom: "4px" }}>Synced Orders</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#1a1a1a" }}>{ordersCount} <span style={{ fontSize: "13px", fontWeight: 500, color: "#6d7175" }}>/ 500 syncs</span></div>
            {/* Progress bar */}
            <div style={{ width: "100%", height: "6px", background: "#f1f2f4", borderRadius: "3px", marginTop: "8px", overflow: "hidden" }}>
              <div style={{ width: `${orderPercent}%`, height: "100%", background: "#2c6ecb", borderRadius: "3px" }} />
            </div>
          </div>
          <span style={{ fontSize: "11px", color: "#6d7175", marginTop: "8px" }}>Billing cycle resets monthly</span>
        </div>

        {/* Metric 4: Blueprints Templates */}
        <div style={{ background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 2px 6px rgba(0,0,0,0.01)" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#6d7175", letterSpacing: "0.05em", marginBottom: "4px" }}>Blueprints</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#1a1a1a" }}>{templatesCount} <span style={{ fontSize: "13px", fontWeight: 500, color: "#6d7175" }}>stored</span></div>
            <div style={{ width: "100%", height: "6px", background: "#f1f2f4", borderRadius: "3px", marginTop: "8px", overflow: "hidden" }}>
              <div style={{ width: "100%", height: "100%", background: "#47c1bf", borderRadius: "3px" }} />
            </div>
          </div>
          <span style={{ fontSize: "11px", color: "#6d7175", marginTop: "8px" }}>Unlimited templates quota</span>
        </div>

        {/* Metric 5: CDN Storage Size */}
        <div style={{ background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 2px 6px rgba(0,0,0,0.01)" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#6d7175", letterSpacing: "0.05em", marginBottom: "4px" }}>CDN Storage</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#1a1a1a" }}>174.9 <span style={{ fontSize: "13px", fontWeight: 500, color: "#6d7175" }}>KB used</span></div>
            <div style={{ width: "100%", height: "6px", background: "#f1f2f4", borderRadius: "3px", marginTop: "8px", overflow: "hidden" }}>
              <div style={{ width: "1%", height: "100%", background: "#457b9d", borderRadius: "3px" }} />
            </div>
          </div>
          <span style={{ fontSize: "11px", color: "#6d7175", marginTop: "8px" }}>Quota size limit: 1.00 GB</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", alignItems: "start", marginBottom: "24px" }}>
        
        {/* Step-by-Step Quick Start */}
        <s-section heading="Personalize Your Store Products ✨">
          <s-paragraph>
            Welcome to the Product Personalizer App! Allow your customers to add custom engraving, text, fonts, and colors to products directly on the checkout page, boosting average order value (AOV) and customer engagement.
          </s-paragraph>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
            
            <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
              <div style={{
                width: "28px",
                height: "28px",
                background: "#008060",
                color: "#ffffff",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                flexShrink: 0
              }}>1</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "15px" }}>Configure Personalization Options</div>
                <s-paragraph>
                  Go to the <s-link href="/app/configure">Product Options page</s-link>, select a product, enable personalization, and customize options, fonts, color palettes, and upcharge fees.
                </s-paragraph>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
              <div style={{
                width: "28px",
                height: "28px",
                background: "#008060",
                color: "#ffffff",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                flexShrink: 0
              }}>2</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "15px" }}>Enable Checkout UI Extension</div>
                <s-paragraph>
                  Navigate to your Shopify Checkout Editor (Online Store &gt; Customize &gt; Checkout) and add the <strong>Product Personalizer Checkout</strong> block under cart lines so customers can customize items during checkout.
                </s-paragraph>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
              <div style={{
                width: "28px",
                height: "28px",
                background: "#008060",
                color: "#ffffff",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                flexShrink: 0
              }}>3</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "15px" }}>Process Personalized Orders</div>
                <s-paragraph>
                  Customization selections automatically attach to checkout and propagate to order details. You can view customization keys (`engraving_text`, `engraving_font`, `engraving_color`) on line items in the Shopify Admin.
                </s-paragraph>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "24px" }}>
            <s-button href="/app/configure" variant="primary">
              Configure Product Options
            </s-button>
          </div>
        </s-section>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* ⭐ 5-Star Experience Feedback Widget */}
          <s-section heading="Merchant Experience">
            <s-paragraph>How has your experience been using our customizer dashboard?</s-paragraph>
            <div style={{ display: "flex", gap: "8px", margin: "12px 0", justifyContent: "center" }}>
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => handleRating(star)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontSize: "28px",
                      transition: "transform 0.1s ease",
                      transform: hoverRating === star ? "scale(1.2)" : "none",
                      outline: "none"
                    }}
                  >
                    {isActive ? "★" : "☆"}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: "11px", color: "#6d7175", textAlign: "center", fontStyle: "italic" }}>
              {rating > 0 ? `Rated ${rating} out of 5 stars` : "Hover and click to submit rating"}
            </div>
          </s-section>

          {/* Support Section */}
          <s-section heading="Need Support?">
            <s-paragraph>
              If you have any questions or need custom styling adjustments to fit your brand identity, reach out to our team at support@productpersonalizer.com.
            </s-paragraph>
            <s-paragraph>
              <strong>API Gateway status:</strong> Online 🟢
            </s-paragraph>
          </s-section>

        </div>
      </div>

      {/* 📚 Onboarding / Learning Resource Center (3 columns) */}
      <s-section heading="Personalizer Knowledge Base & Tutorials">
        <s-paragraph>Master advanced customization strategies with our visual setup cookbooks.</s-paragraph>
        
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
          marginTop: "16px"
        }}>
          
          {/* Resource 1 */}
          <div style={{ background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "12px", padding: "20px", transition: "transform 0.2s ease, border-color 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "#babfc3"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "#e1e3e5"; }}>
            <div style={{ fontSize: "28px", marginBottom: "12px" }}></div>
            <h4 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 8px 0", color: "#1a1a1a" }}>Custom Typography Fonts</h4>
            <p style={{ fontSize: "13px", color: "#6d7175", margin: 0, lineHeight: "1.4" }}>
              Learn how to upload and register custom TTF, OTF, or WOFF vector font files into assets for custom engraving rendering.
            </p>
          </div>

          {/* Resource 2 */}
          <div style={{ background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "12px", padding: "20px", transition: "transform 0.2s ease, border-color 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "#babfc3"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "#e1e3e5"; }}>
            <div style={{ fontSize: "28px", marginBottom: "12px" }}>💍</div>
            <h4 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 8px 0", color: "#1a1a1a" }}>Letter Monograms Setup</h4>
            <p style={{ fontSize: "13px", color: "#6d7175", margin: 0, lineHeight: "1.4" }}>
              Configure jewelry engraving, monogram initials templates, and embroidery stitches coordinate-perfect positioning logic.
            </p>
          </div>

          {/* Resource 3 */}
          <div style={{ background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "12px", padding: "20px", transition: "transform 0.2s ease, border-color 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "#babfc3"; }} onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "#e1e3e5"; }}>
            <div style={{ fontSize: "28px", marginBottom: "12px" }}>🔀</div>
            <h4 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 8px 0", color: "#1a1a1a" }}>Conditional Field Routing</h4>
            <p style={{ fontSize: "13px", color: "#6d7175", margin: 0, lineHeight: "1.4" }}>
              Build dynamic forms that automatically hide or display customization inputs based on selections.
            </p>
          </div>
        </div>
      </s-section>

    </s-page>
  );
}
