import {
  extension,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Select,
  Image,
  Button,
  View
} from "@shopify/ui-extensions/checkout";

export default extension(
  "purchase.checkout.cart-line-item.render-after",
  (root, api) => {
    let isOpen = false;
    let text = "";
    let font = "Arial";
    let color = "#000000";
    let isSaved = false;
    let isSubmitting = false;
    let config: any = null;
    let line: any = null;

    // Create the outer wrapper component
    const mainStack = root.createComponent(BlockStack, { spacing: "tight" });
    root.appendChild(mainStack);

    // Track if we have performed initial subscriptions
    let targetLoaded = false;
    let metafieldsLoaded = false;

    // A helper to safely check if everything is ready to render
    function isReady() {
      return targetLoaded && metafieldsLoaded && line && config;
    }

    function render() {
      // Clear mainStack
      while (mainStack.children.length > 0) {
        mainStack.removeChild(mainStack.children[0]);
      }

      if (!isReady()) {
        return;
      }

      if (!config || !config.enabled) {
        return;
      }

      const maxChars = config.maxChars || 50;
      const fee = config.fee || 0;
      const fontOptions = config.fontOptions || ["Arial", "Script", "Gothic"];
      const colorOptions = config.colorOptions || ["#000000", "#E63946", "#457B9D", "#1D3557"];

      // 1. Saved status or Personalize button
      const actionView = root.createComponent(View, { border: "none", padding: "none" });
      
      if (isSaved) {
        const savedStack = root.createComponent(InlineStack, {
          spacing: "base",
          alignment: "center"
        } as any);

        const savedText = root.createComponent(Text, {
          size: "small",
          appearance: "success"
        }, `✓ Customized: "${text}" (${font}, ${color})`);
        savedStack.appendChild(savedText);

        if (fee > 0) {
          const feeText = root.createComponent(Text, {
            size: "small",
            emphasis: "bold"
          }, `(+$${fee.toFixed(2)})`);
          savedStack.appendChild(feeText);
        }

        const editBtn = root.createComponent(Button, {
          kind: "secondary",
          disabled: isSubmitting,
          onPress: () => {
            isOpen = true;
            render();
          }
        }, "Edit");
        savedStack.appendChild(editBtn);

        const removeBtn = root.createComponent(Button, {
          kind: "secondary",
          disabled: isSubmitting,
          onPress: handleRemove
        }, "Remove");
        savedStack.appendChild(removeBtn);

        actionView.appendChild(savedStack);
      } else {
        const toggleBtn = root.createComponent(Button, {
          kind: "secondary",
          disabled: isSubmitting,
          onPress: () => {
            isOpen = !isOpen;
            render();
          }
        }, isOpen ? "Close Personalizer" : `✨ Personalize this Item${fee > 0 ? ` (+$${fee.toFixed(2)})` : ""}`);
        actionView.appendChild(toggleBtn);
      }

      mainStack.appendChild(actionView);

      // 2. Open options panel
      if (isOpen) {
        const panelView = root.createComponent(View, {
          border: "base",
          padding: "loose",
          borderRadius: "base"
        });

        const panelStack = root.createComponent(BlockStack, { spacing: "base" });

        const titleText = root.createComponent(Text, {
          size: "medium",
          emphasis: "bold"
        }, "Personalization Options");
        panelStack.appendChild(titleText);

        const inputField = root.createComponent(TextField, {
          label: `Custom Engraving Text (Max ${maxChars} chars)`,
          value: text,
          onChange: (val) => {
            text = val.substring(0, maxChars);
            render();
          }
        });
        panelStack.appendChild(inputField);

        const fontSelect = root.createComponent(Select, {
          label: "Choose Font",
          value: font,
          onChange: (val) => {
            font = val;
            render();
          },
          options: fontOptions.map((f: string) => ({ value: f, label: f }))
        });
        panelStack.appendChild(fontSelect);

        const colorSelect = root.createComponent(Select, {
          label: "Choose Color",
          value: color,
          onChange: (val) => {
            color = val;
            render();
          },
          options: colorOptions.map((c: string) => ({ value: c, label: c }))
        });
        panelStack.appendChild(colorSelect);

        // 3. Live Preview
        if (text) {
          const previewStack = root.createComponent(BlockStack, { spacing: "tight" });
          
          const previewTitle = root.createComponent(Text, {
            size: "small",
            emphasis: "bold"
          }, "Live Preview:");
          previewStack.appendChild(previewTitle);

          const previewBox = root.createComponent(View, {
            border: "base",
            padding: "base",
            borderRadius: "base",
            background: "subdued"
          });

          const boxStack = root.createComponent(BlockStack, {
            spacing: "base"
          });

          if (line?.merchandise?.image?.url) {
            const prodImage = root.createComponent(Image, {
              source: line.merchandise.image.url,
              description: "Product Preview",
              aspectRatio: 1
            } as any);
            boxStack.appendChild(prodImage);
          }

          const previewTextGroup = root.createComponent(View, { padding: "base" });
          
          const liveText = root.createComponent(Text, {
            size: "extraLarge",
            emphasis: "bold"
          }, text);
          previewTextGroup.appendChild(liveText);

          const liveDetails = root.createComponent(Text, {
            size: "small",
            appearance: "subdued"
          }, `Rendered in ${font} / ${color}`);
          previewTextGroup.appendChild(liveDetails);

          boxStack.appendChild(previewTextGroup);
          previewBox.appendChild(boxStack);
          previewStack.appendChild(previewBox);
          panelStack.appendChild(previewStack);
        }

        // 4. Panel buttons
        const btnStack = root.createComponent(InlineStack, { spacing: "base" });

        const applyBtn = root.createComponent(Button, {
          kind: "primary",
          disabled: !text.trim() || isSubmitting,
          onPress: handleApply
        }, isSubmitting ? "Applying..." : "Apply Customization");
        btnStack.appendChild(applyBtn);

        const cancelBtn = root.createComponent(Button, {
          kind: "secondary",
          disabled: isSubmitting,
          onPress: () => {
            isOpen = false;
            render();
          }
        }, "Cancel");
        btnStack.appendChild(cancelBtn);

        panelStack.appendChild(btnStack);
        panelView.appendChild(panelStack);
        mainStack.appendChild(panelView);
      }
    }

    async function handleApply() {
      isSubmitting = true;
      render();
      try {
        const result = await api.applyCartLinesChange({
          type: "updateCartLine",
          id: line.id,
          attributes: [
            { key: "engraving_text", value: text },
            { key: "engraving_font", value: font },
            { key: "engraving_color", value: color }
          ]
        });

        if (result.type === "success") {
          isSaved = true;
          isOpen = false;
        } else {
          console.error("Failed to update cart line attributes", result.message);
        }
      } catch (e) {
        console.error("Error applying personalization", e);
      } finally {
        isSubmitting = false;
        render();
      }
    }

    async function handleRemove() {
      isSubmitting = true;
      render();
      try {
        const result = await api.applyCartLinesChange({
          type: "updateCartLine",
          id: line.id,
          attributes: [
            { key: "engraving_text", value: "" },
            { key: "engraving_font", value: "" },
            { key: "engraving_color", value: "" }
          ]
        });

        if (result.type === "success") {
          text = "";
          isSaved = false;
        }
      } catch (e) {
        console.error("Error removing personalization", e);
      } finally {
        isSubmitting = false;
        render();
      }
    }

    function updateConfig() {
      if (config) {
        const fontOptions = config.fontOptions || ["Arial", "Script", "Gothic"];
        const colorOptions = config.colorOptions || ["#000000", "#E63946", "#457B9D", "#1D3557"];
        if (fontOptions.length > 0 && !fontOptions.includes(font)) font = fontOptions[0];
        if (colorOptions.length > 0 && !colorOptions.includes(color)) color = colorOptions[0];
      }
    }

    // Subscribe to APIs
    api.target.subscribe((newLine) => {
      line = newLine;
      targetLoaded = true;

      // Load existing values if already personalized in cart line attributes
      const textAttr = line?.attributes?.find((a: any) => a.key === "engraving_text")?.value;
      const fontAttr = line?.attributes?.find((a: any) => a.key === "engraving_font")?.value;
      const colorAttr = line?.attributes?.find((a: any) => a.key === "engraving_color")?.value;

      if (textAttr) {
        text = textAttr;
        isOpen = true;
        isSaved = true;
      }
      if (fontAttr) font = fontAttr;
      if (colorAttr) color = colorAttr;

      updateConfig();
      render();
    });

    api.appMetafields.subscribe((newMetafields) => {
      metafieldsLoaded = true;

      if (!line) {
        // We need line target data first to know which product metafield to find
        render();
        return;
      }

      // Check if customization is enabled for this product
      const productMetafield = newMetafields.find(
        (mf) => 
          mf.target.type === "product" && 
          mf.target.id === line?.merchandise?.product?.id && 
          mf.metafield.namespace === "app" && 
          mf.metafield.key === "customization_config"
      );

      // Parse customization config from metafield value
      if (productMetafield?.metafield?.value) {
        try {
          config = JSON.parse(String(productMetafield.metafield.value));
        } catch (e) {
          console.error("Failed to parse personalization config", e);
        }
      } else {
        config = null;
      }

      updateConfig();
      render();
    });
  }
);
