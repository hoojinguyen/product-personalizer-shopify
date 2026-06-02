import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // Fetch products to count how many are personalized
  let totalCount = 0;
  let enabledCount = 0;

  try {
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

    products.forEach((edge: any) => {
      const configVal = edge.node.metafield?.value;
      if (configVal) {
        try {
          const config = JSON.parse(configVal);
          if (config.enabled) enabledCount++;
        } catch (e) {}
      }
    });
  } catch (err) {
    console.error("Error fetching product counts in dashboard loader", err);
  }

  return { totalCount, enabledCount };
};

export default function Index() {
  const { totalCount, enabledCount } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Product Personalizer Dashboard">
      {/* Banner / Overview Card */}
      <s-section heading="Personalize Your Store Products ✨">
        <s-paragraph>
          Welcome to the Product Personalizer App! Allow your customers to add custom engraving, text, fonts, and colors to products directly on the checkout page, boosting average order value (AOV) and customer engagement.
        </s-paragraph>
        
        <div style={{ display: "flex", gap: "24px", marginTop: "16px", marginBottom: "8px" }}>
          {/* Stat 1 */}
          <div style={{
            flex: 1,
            background: "#f4f6f8",
            border: "1px solid #babfc3",
            borderRadius: "12px",
            padding: "20px",
            textAlign: "center",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)"
          }}>
            <div style={{ fontSize: "36px", fontWeight: 700, color: "#008060" }}>{enabledCount}</div>
            <div style={{ fontWeight: 600, fontSize: "14px", color: "#6d7175", marginTop: "4px" }}>Personalized Products</div>
          </div>

          {/* Stat 2 */}
          <div style={{
            flex: 1,
            background: "#f4f6f8",
            border: "1px solid #babfc3",
            borderRadius: "12px",
            padding: "20px",
            textAlign: "center",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)"
          }}>
            <div style={{ fontSize: "36px", fontWeight: 700, color: "#2c6ecb" }}>{totalCount}</div>
            <div style={{ fontWeight: 600, fontSize: "14px", color: "#6d7175", marginTop: "4px" }}>Total Store Products</div>
          </div>
        </div>
      </s-section>

      {/* Onboarding Guide Card */}
      <s-section heading="Quick Start Guide">
        <s-paragraph>Follow these simple steps to configure personalization for your store products:</s-paragraph>
        
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
              <div style={{ fontWeight: 600, fontSize: "16px" }}>Configure Personalization Options</div>
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
              <div style={{ fontWeight: 600, fontSize: "16px" }}>Enable Checkout UI Extension</div>
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
              <div style={{ fontWeight: 600, fontSize: "16px" }}>Process Personalized Orders</div>
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

      {/* Support section */}
      <s-section slot="aside" heading="Need Help?">
        <s-paragraph>
          If you have any questions or need custom styling adjustments to fit your brand identity, reach out to our team at support@productpersonalizer.com.
        </s-paragraph>
        <s-paragraph>
          <strong>API Status:</strong> Active 🟢
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
