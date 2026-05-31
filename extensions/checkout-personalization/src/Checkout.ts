import {
  extension,
  BlockStack,
  InlineStack,
  Text,
  Image,
  View
} from "@shopify/ui-extensions/checkout";

export default extension(
  "purchase.checkout.cart-line-item.render-after",
  (root, api) => {
    let line: any = null;
    let allLines: any[] = [];

    // Create the outer premium layout card
    const mainStack = root.createComponent(BlockStack, { spacing: "tight" });
    root.appendChild(mainStack);

    // Dynamic Upcharge & Cart Sync validation matching ADR 0006
    async function validateAndSyncUpcharges(currentLines: any[]) {
      if (!api.applyCartLinesChange) return;

      const updates: any[] = [];
      const parentItemsMap = new Map<string, { qty: number; upchargeRatio: number; upchargeVarId: string }>();

      // 1. Gather all personalized products and their parent variant details
      currentLines.forEach((item: any) => {
        const properties = item.properties || [];
        const previewUrlAttr = properties.find((p: any) => p.key === "_preview_url");
        
        if (previewUrlAttr && previewUrlAttr.value) {
          const parentVarId = String(item.merchandise.id);
          const parentQty = item.quantity;

          // Search properties to calculate upcharge ratio
          let totalUpchargeRate = 0;
          properties.forEach((p: any) => {
            if (p.key.startsWith("_upcharge_amount_")) {
              totalUpchargeRate += parseFloat(p.value) || 0;
            }
          });

          // If no specific rate property is set, we can look at the upcharge items themselves
          // to determine the ratio. Let's register this parent.
          parentItemsMap.set(parentVarId, {
            qty: parentQty,
            upchargeRatio: totalUpchargeRate || 1, // fallback to 1:1 if unspecified
            upchargeVarId: ""
          });
        }
      });

      // 2. Identify corresponding Upcharge Items and coordinate quantities
      currentLines.forEach((item: any) => {
        const properties = item.properties || [];
        const parentVarAttr = properties.find((p: any) => p.key === "_parent_variant");

        if (parentVarAttr && parentVarAttr.value) {
          const parentVarId = String(parentVarAttr.value);
          
          if (parentItemsMap.has(parentVarId)) {
            const parent = parentItemsMap.get(parentVarId)!;
            parent.upchargeVarId = item.merchandise.id;

            // Coordinate quantity ratio
            const expectedUpchargeQty = parent.qty * parent.upchargeRatio;
            if (item.quantity !== expectedUpchargeQty) {
              updates.push({
                type: "updateCartLine",
                id: item.id,
                quantity: expectedUpchargeQty
              });
            }
          } else {
            // Orphaned Upcharge Item detected (no parent personalized item in checkout)
            // Automatically remove from cart line
            updates.push({
              type: "removeCartLine",
              id: item.id,
              quantity: 0
            });
          }
        }
      });

      // Execute required synchronization adjustments securely on Shopify servers
      if (updates.length > 0) {
        console.log("Checkout Security: Syncing upcharge items...", updates);
        for (const update of updates) {
          try {
            await api.applyCartLinesChange(update as any);
          } catch (err) {
            console.error("Cart adjustment failed in checkout validation:", err);
          }
        }
      }
    }

    function render() {
      // Clear previous children
      while (mainStack.children.length > 0) {
        mainStack.removeChild(mainStack.children[0]);
      }

      if (!line) return;

      const properties = line.properties || [];
      const previewUrlAttr = properties.find((p: any) => p.key === "_preview_url");
      const previewUrl = previewUrlAttr ? previewUrlAttr.value : null;

      // Filter visible personalization parameters
      const visibleProperties = properties.filter(
        (p: any) => p.key && !p.key.startsWith("_") && p.key !== "priceUpcharge" && p.key !== "Info"
      );

      // Skip non-personalized lines
      if (visibleProperties.length === 0 && !previewUrl) {
        return;
      }

      // 1. Create premium glassmorphism styling card
      const cardView = root.createComponent(View, {
        padding: "base",
        border: "base",
        borderRadius: "base",
        background: "subdued"
      } as any);

      const cardStack = root.createComponent(BlockStack, { spacing: "base" });

      // Heading block
      const headerStack = root.createComponent(InlineStack, {
        spacing: "extraTight",
        alignment: "center"
      } as any);
      
      const sparkIcon = root.createComponent(Text, { emphasis: "bold", size: "small" }, "✨");
      const headerText = root.createComponent(Text, {
        size: "small",
        emphasis: "bold"
      }, "Your Customization Choices");

      headerStack.appendChild(sparkIcon);
      headerStack.appendChild(headerText);
      cardStack.appendChild(headerStack);

      // 2. Dynamic live preview thumbnail
      if (previewUrl) {
        const imageWrapper = root.createComponent(View, {
          border: "base",
          borderRadius: "base",
          padding: "none",
          background: "canvas"
        } as any);

        const customizedImage = root.createComponent(Image, {
          source: previewUrl,
          description: "Your Customized Preview",
          aspectRatio: 1
        } as any);

        imageWrapper.appendChild(customizedImage);
        cardStack.appendChild(imageWrapper);
      }

      // 3. Bulleted customization specifications
      const choicesStack = root.createComponent(BlockStack, { spacing: "extraTight" });

      visibleProperties.forEach((prop: any) => {
        const itemStack = root.createComponent(InlineStack, {
          spacing: "extraTight",
          alignment: "center"
        } as any);

        const keyText = root.createComponent(Text, {
          size: "small",
          emphasis: "bold"
        }, `${prop.key}: `);

        const valText = root.createComponent(Text, {
          size: "small"
        }, prop.value || "(Not set)");

        itemStack.appendChild(keyText);
        itemStack.appendChild(valText);
        choicesStack.appendChild(itemStack);
      });

      cardStack.appendChild(choicesStack);
      cardView.appendChild(cardStack);
      mainStack.appendChild(cardView);
    }

    // Subscribe to specific target line changes
    api.target.subscribe((newLine) => {
      line = newLine;
      render();
    });

    // Subscribe to all cart lines changes for checkout sync validations
    if ((api as any).cartLines) {
      (api as any).cartLines.subscribe((newLines: any[]) => {
        allLines = newLines;
        validateAndSyncUpcharges(allLines);
      });
    }
  }
);
