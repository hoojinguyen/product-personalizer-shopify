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

    // Create the outer premium layout card
    const mainStack = root.createComponent(BlockStack, { spacing: "tight" });
    root.appendChild(mainStack);

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
  }
);
