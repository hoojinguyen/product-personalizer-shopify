import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { useAppBridge } from "@shopify/app-bridge-react";

// Loader: returns the currently selected/mocked plan
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  // We will retrieve the plan from searchParams or default to "Moderate" (matching the spec)
  const url = new URL(request.url);
  const activePlan = url.searchParams.get("plan") || "Moderate";
  return { activePlan };
};

// Action: mocks plan activation
export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const selectedPlan = formData.get("plan") as string;
  return { success: true, plan: selectedPlan };
};

export default function SubscriptionPlans() {
  const { activePlan: loaderPlan } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [currentPlan, setCurrentPlan] = useState(loaderPlan);

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data.plan) {
      setCurrentPlan(fetcher.data.plan);
      shopify.toast.show(`Successfully upgraded to ${fetcher.data.plan} Plan!`);
    }
  }, [fetcher.data, shopify]);

  const handleSelectPlan = (planName: string) => {
    fetcher.submit({ plan: planName }, { method: "POST" });
  };

  const plans = [
    {
      name: "Starter",
      price: "$9.99",
      period: "/month",
      description: "Perfect for small stores starting with item personalization options.",
      productsLimit: "Up to 50",
      ordersLimit: "Up to 100 / mo",
      storage: "50 MB",
      features: [
        "100% Polaris Integrated layouts",
        "Engraving & Text inputs",
        "Conditional display logic rules",
        "Line-item upcharge fees rules",
        "Standard transparent PNG downloads"
      ],
      badgeColor: "#6d7175",
      isPopular: false
    },
    {
      name: "Basic",
      price: "$19.99",
      period: "/month",
      description: "Ideal for growing stores requiring multiple options templates.",
      productsLimit: "Up to 200",
      ordersLimit: "Up to 300 / mo",
      storage: "200 MB",
      features: [
        "Everything in Starter",
        "Centralized global brand Assets",
        "Centralized reusable templates sets",
        "Clipart graphic selection grids",
        "Customer file upload boundaries"
      ],
      badgeColor: "#2c6ecb",
      isPopular: false
    },
    {
      name: "Moderate",
      price: "$29.99",
      period: "/month",
      description: "Best for established stores requiring high resolution print coordinates.",
      productsLimit: "Up to 500",
      ordersLimit: "Up to 500 / mo",
      storage: "1.00 GB",
      features: [
        "Everything in Basic",
        "300 DPI high-res print files",
        "DPI output custom specs overrides",
        "Dynamic custom font sets",
        "Priority dedicated styling support"
      ],
      badgeColor: "#008060",
      isPopular: true
    },
    {
      name: "Unlimited",
      price: "$49.99",
      period: "/month",
      description: "For high-volume brands seeking zero bounds and custom overrides.",
      productsLimit: "Unlimited",
      ordersLimit: "Unlimited",
      storage: "5.00 GB",
      features: [
        "Everything in Moderate",
        "Unlimited customizer products",
        "Unlimited customized orders sync",
        "Granular custom CSS/JS consoles",
        "Beta-access checkout UI extensions"
      ],
      badgeColor: "#47c1bf",
      isPopular: false
    }
  ];

  return (
    <s-page heading="Pricing Plans">
      <s-section heading="Personalizer Account Plans & Quotas Matrix">
        <s-paragraph>
          Select a subscription tier that fits your store size. All transactions are billed securely via Shopify&apos;s standard App Billing API.
        </s-paragraph>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "24px",
          marginTop: "24px"
        }}>
          {plans.map((plan) => {
            const isActive = currentPlan.toLowerCase() === plan.name.toLowerCase();

            return (
              <div
                key={plan.name}
                style={{
                  background: isActive ? "hsla(160, 100%, 98%, 0.5)" : "#ffffff",
                  border: isActive ? `3px solid ${plan.badgeColor}` : "1px solid #e1e3e5",
                  borderRadius: "16px",
                  padding: "24px",
                  boxShadow: isActive ? "0 10px 30px rgba(0, 128, 96, 0.1)" : "0 4px 12px rgba(0,0,0,0.02)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  transition: "all 0.3s ease",
                  transform: plan.isPopular ? "scale(1.02)" : "none"
                }}
              >
                {/* Popular Badge */}
                {plan.isPopular && (
                  <span style={{
                    position: "absolute",
                    top: "-12px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: plan.badgeColor,
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "4px 12px",
                    borderRadius: "20px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
                  }}>
                    Popular / Recommended
                  </span>
                )}

                <div>
                  {/* Plan Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <h3 style={{ fontSize: "20px", fontWeight: 700, margin: 0, color: "#1a1a1a" }}>
                      {plan.name}
                    </h3>
                    {isActive && (
                      <span style={{
                        background: plan.badgeColor,
                        color: "#ffffff",
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "8px",
                        textTransform: "uppercase"
                      }}>
                        Active
                      </span>
                    )}
                  </div>

                  {/* Pricing */}
                  <div style={{ display: "flex", alignItems: "baseline", marginBottom: "12px" }}>
                    <span style={{ fontSize: "32px", fontWeight: 800, color: "#1a1a1a" }}>{plan.price}</span>
                    <span style={{ fontSize: "14px", color: "#6d7175", marginLeft: "4px" }}>{plan.period}</span>
                  </div>

                  <p style={{ fontSize: "13px", color: "#6d7175", marginBottom: "16px", lineHeight: "1.4" }}>
                    {plan.description}
                  </p>

                  <hr style={{ border: 0, borderTop: "1px solid #e1e3e5", margin: "16px 0" }} />

                  {/* Quotas */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <span style={{ color: "#6d7175", fontWeight: 500 }}>Customizable Products:</span>
                      <span style={{ fontWeight: 600, color: "#1a1a1a" }}>{plan.productsLimit}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <span style={{ color: "#6d7175", fontWeight: 500 }}>Customized Orders:</span>
                      <span style={{ fontWeight: 600, color: "#1a1a1a" }}>{plan.ordersLimit}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                      <span style={{ color: "#6d7175", fontWeight: 500 }}>CDN Storage limits:</span>
                      <span style={{ fontWeight: 600, color: "#1a1a1a" }}>{plan.storage}</span>
                    </div>
                  </div>

                  <hr style={{ border: 0, borderTop: "1px solid #e1e3e5", margin: "16px 0" }} />

                  {/* Features List */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "#6d7175", letterSpacing: "0.05em" }}>
                      Features Included:
                    </span>
                    {plan.features.map((f, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "8px", fontSize: "13px", color: "#2c3e50" }}>
                        <span style={{ color: plan.badgeColor }}>✓</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Select Button */}
                <button
                  type="button"
                  disabled={isActive || fetcher.state === "submitting"}
                  onClick={() => handleSelectPlan(plan.name)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: isActive ? "#f1f2f4" : plan.badgeColor,
                    color: isActive ? "#8c9196" : "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: isActive ? "default" : "pointer",
                    transition: "all 0.2s ease",
                    outline: "none"
                  }}
                >
                  {isActive ? "Current Active Plan" : `Upgrade to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </s-section>
    </s-page>
  );
}
