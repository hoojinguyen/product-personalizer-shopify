import {
  reactExtension,
  useCartLineTarget,
  useAppMetafields,
  useApplyCartLinesChange,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Select,
  Image,
  Button,
  View,
  Divider
} from "@shopify/ui-extensions-react/checkout";
import { useState, useEffect } from "react";

// Register the extension target
export default reactExtension(
  "purchase.checkout.cart-line-item.render-after",
  () => <CheckoutExtension />
);

function CheckoutExtension() {
  const line = useCartLineTarget();
  const appMetafields = useAppMetafields();
  const applyCartLinesChange = useApplyCartLinesChange();

  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [font, setFont] = useState("Arial");
  const [color, setColor] = useState("#000000");
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if customization is enabled for this product
  // 1. We find the metafield associated with the current cart line's product
  const productMetafield = appMetafields.find(
    (mf) => 
      mf.target.type === "Product" && 
      mf.target.id === line.merchandise.product.id && 
      mf.metafield.namespace === "app" && 
      mf.metafield.key === "customization_config"
  );

  // Parse customization config from metafield value
  let config: any = null;
  if (productMetafield?.metafield?.value) {
    try {
      config = JSON.parse(productMetafield.metafield.value);
    } catch (e) {
      console.error("Failed to parse personalization config", e);
    }
  }

  // If not enabled or no config, do not render the customizer
  if (!config || !config.enabled) {
    return null;
  }

  const maxChars = config.maxChars || 50;
  const fee = config.fee || 0;
  const fontOptions = config.fontOptions || ["Arial", "Script", "Gothic"];
  const colorOptions = config.colorOptions || ["#000000", "#E63946", "#457B9D", "#1D3557"];

  // Set default state when config loads
  useEffect(() => {
    if (fontOptions.length > 0) setFont(fontOptions[0]);
    if (colorOptions.length > 0) setColor(colorOptions[0]);
  }, [config]);

  // Load existing values if already personalized in cart line attributes
  useEffect(() => {
    const textAttr = line.attributes?.find((a) => a.key === "engraving_text")?.value;
    const fontAttr = line.attributes?.find((a) => a.key === "engraving_font")?.value;
    const colorAttr = line.attributes?.find((a) => a.key === "engraving_color")?.value;

    if (textAttr) {
      setText(textAttr);
      setIsOpen(true);
      setIsSaved(true);
    }
    if (fontAttr) setFont(fontAttr);
    if (colorAttr) setColor(colorAttr);
  }, [line]);

  const handleApply = async () => {
    setIsSubmitting(true);
    try {
      const result = await applyCartLinesChange({
        type: "updateCartLine",
        id: line.id,
        attributes: [
          { key: "engraving_text", value: text },
          { key: "engraving_font", value: font },
          { key: "engraving_color", value: color }
        ]
      });

      if (result.type === "success") {
        setIsSaved(true);
        setIsOpen(false);
      } else {
        console.error("Failed to update cart line attributes", result.message);
      }
    } catch (e) {
      console.error("Error applying personalization", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    setIsSubmitting(true);
    try {
      const result = await applyCartLinesChange({
        type: "updateCartLine",
        id: line.id,
        attributes: [
          { key: "engraving_text", value: "" },
          { key: "engraving_font", value: "" },
          { key: "engraving_color", value: "" }
        ]
      });

      if (result.type === "success") {
        setText("");
        setIsSaved(false);
      }
    } catch (e) {
      console.error("Error removing personalization", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BlockStack spacing="tight">
      <View border="none" padding="none">
        {isSaved ? (
          <InlineStack spacing="base" alignment="center">
            <Text size="small" appearance="success">
              ✓ Customized: &quot;{text}&quot; ({font}, {color})
            </Text>
            {fee > 0 && (
              <Text size="small" weight="bold">
                (+${fee.toFixed(2)})
              </Text>
            )}
            <Button
              kind="secondary"
              size="small"
              onClick={() => setIsOpen(true)}
              disabled={isSubmitting}
            >
              Edit
            </Button>
            <Button
              kind="secondary"
              size="small"
              onClick={handleRemove}
              disabled={isSubmitting}
            >
              Remove
            </Button>
          </InlineStack>
        ) : (
          <Button
            kind="secondary"
            onClick={() => setIsOpen(!isOpen)}
            disabled={isSubmitting}
          >
            {isOpen ? "Close Personalizer" : "✨ Personalize this Item"}
            {fee > 0 ? ` (+$${fee.toFixed(2)})` : ""}
          </Button>
        )}
      </View>

      {isOpen && (
        <View
          border="base"
          padding="loose"
          borderRadius="base"
          spacing="base"
        >
          <BlockStack spacing="base">
            <Text size="medium" weight="bold">
              Personalization Options
            </Text>
            
            <TextField
              label={`Custom Engraving Text (Max ${maxChars} chars)`}
              value={text}
              onChange={(val) => setText(val.substring(0, maxChars))}
            />
            
            <Select
              label="Choose Font"
              value={font}
              onChange={(val) => setFont(val)}
              options={fontOptions.map((f: string) => ({ value: f, label: f }))}
            />

            <Select
              label="Choose Color"
              value={color}
              onChange={(val) => setColor(val)}
              options={colorOptions.map((c: string) => ({ value: c, label: c }))}
            />

            {/* Premium Custom Preview Box */}
            {text && (
              <BlockStack spacing="tight">
                <Text size="small" weight="bold">Live Preview:</Text>
                <View
                  border="base"
                  padding="base"
                  borderRadius="base"
                  background="subdued"
                >
                  <BlockStack alignment="center" spacing="base">
                    {line.merchandise.image?.url && (
                      <Image
                        source={line.merchandise.image.url}
                        alt="Product Preview"
                        aspectRatio={1}
                      />
                    )}
                    <View padding="base">
                      <Text
                        size="extraLarge"
                        weight="bold"
                        alignment="center"
                      >
                        {text}
                      </Text>
                      <Text
                        size="small"
                        appearance="subdued"
                        alignment="center"
                      >
                        Rendered in {font} / {color}
                      </Text>
                    </View>
                  </BlockStack>
                </View>
              </BlockStack>
            )}

            <InlineStack spacing="base">
              <Button
                kind="primary"
                onClick={handleApply}
                disabled={!text.trim() || isSubmitting}
              >
                {isSubmitting ? "Applying..." : "Apply Customization"}
              </Button>
              <Button
                kind="secondary"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </InlineStack>
          </BlockStack>
        </View>
      )}
    </BlockStack>
  );
}
