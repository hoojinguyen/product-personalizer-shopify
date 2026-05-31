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

      // Extract properties passed from storefront cart addition
      const properties = line.properties || [];
      
      // Look for our hidden customized preview URL thumbnail
      const previewUrlAttr = properties.find((p: any) => p.key === "_preview_url");
      const previewUrl = previewUrlAttr ? previewUrlAttr.value : null;

      // Filter properties to only show buyer-visible attributes (skip hidden system properties starting with '_')
      const visibleProperties = properties.filter(
        (p: any) => p.key && !p.key.startsWith("_") && p.key !== "priceUpcharge"
      );

      // If this line item is not personalized, we do not render the custom block
      if (visibleProperties.length === 0 && !previewUrl) {
        return;
      }

      console.log(`Checkout UI: Rendering personalization summary for line item ${line.id}. Preview URL: ${previewUrl}`);

      // 1. Create outer card wrapper with subtle premium background and border
      const cardView = root.createComponent(View, {
        padding: "base",
        border: "base",
        borderRadius: "base",
        background: "subdued"
      } as any);

      const cardStack = root.createComponent(BlockStack, { spacing: "base" });

      // Title header
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

      // 2. Render live preview thumbnail if custom URL exists
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

      // 3. Render neat bulleted key-value list of choices
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

    // Subscribe to cart line changes
    api.target.subscribe((newLine) => {
      line = newLine;
      render();
    });
  }
);
