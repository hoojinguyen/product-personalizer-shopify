document.addEventListener("DOMContentLoaded", () => {
  const card = document.querySelector(".personalizer-card");
  if (!card) return;

  const productId = card.getAttribute("data-product-id");
  const baseImageUrl = card.getAttribute("data-base-image");
  const isDemo = card.getAttribute("data-is-demo") === "true";

  let config = {};
  try {
    config = JSON.parse(card.getAttribute("data-config") || "{}");
  } catch (e) {
    console.error("Configuration parse error:", e);
  }

  const canvas = document.getElementById("personalizer-canvas");
  const canvasCtx = canvas.getContext("2d");
  const loader = document.getElementById("personalizer-canvas-loader");
  const hiddenPreviewInput = document.getElementById("personalizer-hidden-preview-url");

  const upchargeVariantId = config.upchargeVariantId || "";
  const layoutMode = config.layoutMode || "stacked";

  // Elements selectors
  const textInputs = card.querySelectorAll(".personalizer-input-text");
  const selectMenus = card.querySelectorAll(".personalizer-input-select");
  const swatches = card.querySelectorAll(".personalizer-swatch-list");
  const checkboxes = card.querySelectorAll(".personalizer-input-checkbox");
  const fileInputs = card.querySelectorAll(".personalizer-file-input");

  let canvasElements = {
    bg: null,
    img: null,
    text: "",
    font: "Arial",
    color: "#000000",
    size: 45
  };

  canvas.width = 800;
  canvas.height = 800;

  // Load product base image onto canvas
  if (baseImageUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = baseImageUrl;
    img.onload = () => {
      canvasElements.bg = img;
      drawCanvas();
    };
  }

  // Unified rendering canvas logic matching ADR 0001
  function drawCanvas() {
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    if (canvasElements.bg) {
      canvasCtx.drawImage(canvasElements.bg, 0, 0, canvas.width, canvas.height);
    } else {
      canvasCtx.fillStyle = "#fbfbfb";
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (canvasElements.img) {
      canvasCtx.save();
      const size = 320;
      const x = (canvas.width - size) / 2;
      const y = (canvas.height - size) / 2;
      canvasCtx.strokeStyle = "rgba(44,110,203,0.3)";
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeRect(x - 2, y - 2, size + 4, size + 4);
      canvasCtx.drawImage(canvasElements.img, x, y, size, size);
      canvasCtx.restore();
    }

    if (canvasElements.text && canvasElements.text.trim() !== "") {
      canvasCtx.save();
      canvasCtx.textAlign = "center";
      canvasCtx.textBaseline = "middle";
      canvasCtx.fillStyle = canvasElements.color;
      canvasCtx.font = `bold ${canvasElements.size}px "${canvasElements.font}", Arial, sans-serif`;
      canvasCtx.shadowColor = "rgba(0,0,0,0.15)";
      canvasCtx.shadowBlur = 4;
      canvasCtx.shadowOffsetX = 2;
      canvasCtx.shadowOffsetY = 2;
      // Adjust baseline if image overlay exists
      const textY = canvas.height / 2 + (canvasElements.img ? 220 : 0);
      canvasCtx.fillText(canvasElements.text, canvas.width / 2, textY);
      canvasCtx.restore();
    }
  }

  // Dynamic `@font-face` wait-loading matching ADR 0003
  async function loadTypography(fontName) {
    if (!fontName || fontName === "Arial" || fontName === "Georgia") return;
    try {
      loader.style.display = "flex";
      // Wait for typography loading to prevent canvas fallback drifts
      await document.fonts.load(`16px "${fontName}"`);
    } catch (e) {
      console.warn("Font preloading error, rendering default:", e);
    } finally {
      loader.style.display = "none";
    }
  }

  async function updateCanvasElements() {
    const textInp = textInputs[0];
    canvasElements.text = textInp ? textInp.value : "";

    let fontStyle = "Arial";
    selectMenus.forEach(s => {
      const name = s.getAttribute("name")?.toLowerCase() || "";
      if (name.includes("font") || name.includes("style")) {
        fontStyle = s.value;
      }
    });
    canvasElements.font = fontStyle;

    const activeSwatch = card.querySelector(".personalizer-swatch-btn.active");
    if (activeSwatch) {
      canvasElements.color = activeSwatch.getAttribute("data-color");
    }

    await loadTypography(fontStyle);
    drawCanvas();
  }

  // Image assets staged upload pipeline
  fileInputs.forEach(fInput => {
    const pGroup = fInput.closest(".personalizer-group");
    const previewName = pGroup.querySelector(".personalizer-file-preview-name");
    const hiddenUrlInput = pGroup.querySelector(".personalizer-input-file-url");

    fInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      previewName.textContent = file.name;
      loader.style.display = "flex";

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/apps/personalizer/upload", {
          method: "POST",
          body: formData
        });
        if (!response.ok) throw new Error();
        
        const data = await response.json();
        if (data.success && data.url) {
          hiddenUrlInput.value = data.url;
          const userImg = new Image();
          userImg.crossOrigin = "anonymous";
          userImg.src = data.url;
          userImg.onload = () => {
            canvasElements.img = userImg;
            drawCanvas();
          };
        } else {
          alert(`Upload failed: ${data.error || "Unknown"}`);
        }
      } catch (err) {
        console.error("AJAX upload exception:", err);
        alert("Uploading customization graphic failed.");
      } finally {
        loader.style.display = "none";
      }
    });
  });

  // Conditional Logic validations
  function evaluateConditionalRules() {
    const optionsList = config.options || [];
    const fieldValues = {};

    textInputs.forEach(i => {
      const parentGroup = i.closest(".personalizer-group");
      if (parentGroup) fieldValues[parentGroup.getAttribute("data-option-id")] = i.value;
    });
    selectMenus.forEach(s => {
      const parentGroup = s.closest(".personalizer-group");
      if (parentGroup) fieldValues[parentGroup.getAttribute("data-option-id")] = s.value;
    });
    swatches.forEach(sw => {
      const targetId = sw.getAttribute("data-target-input");
      const hiddenInput = card.querySelector(`#${targetId}`);
      const optId = targetId.replace("field-", "");
      if (hiddenInput) fieldValues[optId] = hiddenInput.value;
    });
    checkboxes.forEach(c => {
      const parentGroup = c.closest(".personalizer-group");
      if (parentGroup) fieldValues[parentGroup.getAttribute("data-option-id")] = c.checked ? "Yes" : "";
    });

    optionsList.forEach(opt => {
      const element = card.querySelector(`[data-option-id="${opt.id}"]`);
      if (!element) return;

      if (opt.conditionalRules && opt.conditionalRules.length > 0) {
        let isVisible = true;
        opt.conditionalRules.forEach(rule => {
          const value = fieldValues[rule.fieldId] || "";
          if (rule.operator === "equals" && value !== rule.value) isVisible = false;
          else if (rule.operator === "not_equals" && value === rule.value) isVisible = false;
          else if (rule.operator === "checked" && !value) isVisible = false;
          else if (rule.operator === "unchecked" && value) isVisible = false;
        });

        if (isVisible) {
          element.style.display = "flex";
          element.classList.remove("personalizer-hidden");
        } else {
          element.style.display = "none";
          element.classList.add("personalizer-hidden");
          const input = element.querySelector("input, select");
          if (input) {
            if (input.type === "checkbox") input.checked = false;
            else if (input.type === "text" || input.type === "hidden") input.value = "";
          }
        }
      }
    });

    updateCanvasElements();
  }

  // Layout presentation builders matching ADR 0005
  function buildTabsLayout() {
    if (layoutMode !== "tabs") return;
    const groups = card.querySelectorAll(".personalizer-group");
    if (groups.length <= 1) return;

    // Inject tabs navigation
    const nav = document.createElement("div");
    nav.className = "personalizer-tabs-nav";
    
    // Group fields into tabs
    groups.forEach((g, idx) => {
      const labelText = g.querySelector(".personalizer-label span")?.textContent || `Step ${idx + 1}`;
      if (labelText.toLowerCase().includes("preview") || g.querySelector("canvas")) return;

      const tabBtn = document.createElement("button");
      tabBtn.type = "button";
      tabBtn.className = `personalizer-tab-trigger${idx === 0 ? " active" : ""}`;
      tabBtn.textContent = labelText.split("+")[0].trim();
      tabBtn.setAttribute("data-tab-index", idx);

      tabBtn.addEventListener("click", (e) => {
        e.preventDefault();
        nav.querySelectorAll(".personalizer-tab-trigger").forEach(b => b.classList.remove("active"));
        tabBtn.classList.add("active");
        groups.forEach((el, elIdx) => {
          if (el.querySelector("canvas")) return;
          if (Number(elIdx) === Number(idx)) {
            el.style.display = "flex";
          } else {
            el.style.display = "none";
          }
        });
      });

      nav.appendChild(tabBtn);
    });

    card.insertBefore(nav, groups[0]);

    // Initial show first tab only
    groups.forEach((el, idx) => {
      if (el.querySelector("canvas")) return;
      if (idx !== 0) el.style.display = "none";
    });
  }

  function buildModalLayout() {
    if (layoutMode !== "modal") return;

    // Build launcher trigger
    const productForm = document.querySelector('form[action*="/cart/add"]');
    if (!productForm) return;

    const launchBtn = document.createElement("button");
    launchBtn.type = "button";
    launchBtn.className = "personalizer-launcher-btn";
    launchBtn.innerHTML = `✨ ${config.heading || "Personalize Your Item"}`;

    // Insert launcher before product form submit button
    const submitBtn = productForm.querySelector('[type="submit"], [name="add"]');
    if (submitBtn) {
      submitBtn.parentNode.insertBefore(launchBtn, submitBtn);
    } else {
      productForm.appendChild(launchBtn);
    }

    // Hide original personalizer card in DOM flow, move it into overlay modal structure
    card.style.display = "none";

    const modalOverlay = document.createElement("div");
    modalOverlay.className = "personalizer-modal-overlay";

    const modalContent = document.createElement("div");
    modalContent.className = "personalizer-modal-content";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "personalizer-modal-close-btn";
    closeBtn.innerHTML = "×";

    closeBtn.addEventListener("click", () => {
      modalOverlay.classList.remove("active");
    });

    modalContent.appendChild(closeBtn);
    
    // Reparent personalizer card inside the modal structure
    card.style.display = "flex";
    modalContent.appendChild(card);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    launchBtn.addEventListener("click", (e) => {
      e.preventDefault();
      modalOverlay.classList.add("active");
      evaluateConditionalRules();
    });

    // Add a confirm personalization button at the bottom of the modal card
    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "personalizer-launcher-btn";
    confirmBtn.style.width = "100%";
    confirmBtn.style.marginTop = "16px";
    confirmBtn.textContent = "Confirm Customizations ✓";
    confirmBtn.addEventListener("click", (e) => {
      e.preventDefault();
      modalOverlay.classList.remove("active");
      shopify.toast.show("Personalization saved! Add item to cart now.");
    });
    card.appendChild(confirmBtn);
  }

  // Coordinated Cart Quantities Sync and Form Integrations matching ADR 0006
  function hookCartSubmission() {
    const form = document.querySelector('form[action*="/cart/add"]');
    if (!form) return;

    let formId = form.id;
    if (!formId) {
      formId = `product-add-to-cart-form-${Math.random().toString(36).substring(2, 9)}`;
      form.id = formId;
    }
    card.querySelectorAll("input, select").forEach(i => i.setAttribute("form", formId));

    form.addEventListener("submit", async (e) => {
      if (!upchargeVariantId || isDemo) return;
      e.preventDefault();
      e.stopPropagation();

      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add("loading");
      }

      try {
        // Step 1: Upload preview image to App Proxy uploads directory
        const base64Url = canvas.toDataURL("image/png", 0.7);
        const blob = await (await fetch(base64Url)).blob();
        const fileObj = new File([blob], `preview_${productId}.png`, { type: "image/png" });
        
        const uploadForm = new FormData();
        uploadForm.append("file", fileObj);

        const uploadRes = await fetch("/apps/personalizer/upload", {
          method: "POST",
          body: uploadForm
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.url) {
          hiddenPreviewInput.value = uploadData.url;
        }

        // Step 2: Compile upcharges
        let upchargeTotal = 0;
        card.querySelectorAll(".personalizer-group:not(.personalizer-hidden)").forEach(g => {
          const badge = g.querySelector(".personalizer-fee-tag");
          if (badge) {
            const amount = parseFloat(badge.getAttribute("data-upcharge-amount")) || 0;
            const input = g.querySelector("input, select");
            if (input) {
              if (input.type === "checkbox" && input.checked) upchargeTotal += amount;
              else if (input.type === "text" && input.value.trim() !== "") upchargeTotal += amount;
              else if (input.tagName === "SELECT" && input.value) upchargeTotal += amount;
              else if (input.type === "hidden" && input.value) upchargeTotal += amount;
            }
          }
        });

        // Step 3: Package properties
        const properties = {};
        card.querySelectorAll(".personalizer-group:not(.personalizer-hidden) input, .personalizer-group:not(.personalizer-hidden) select").forEach(inp => {
          const match = inp.getAttribute("name")?.match(/properties\[(.*?)\]/);
          if (match && match[1]) properties[match[1]] = inp.value;
        });
        properties["_preview_url"] = hiddenPreviewInput.value;

        const qtyInput = form.querySelector('[name="quantity"]');
        const quantity = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
        
        const varInput = form.querySelector('[name="id"]');
        const variantId = varInput ? varInput.value : "";

        // Add parent product with customization properties
        const items = [{ id: variantId, quantity, properties }];

        // Bundle Upcharge Item variant
        if (upchargeTotal > 0) {
          items.push({
            id: upchargeVariantId.split("/").pop(), // Extract ID number from GID
            quantity: Math.round(upchargeTotal * quantity),
            properties: {
              "_parent_variant": variantId,
              "Info": "Dynamic Customization Upcharge"
            }
          });
        }

        const addRes = await fetch("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items })
        });

        if (addRes.ok) {
          window.location.href = "/cart";
        } else {
          throw new Error("Add to cart rejected by Shopify");
        }
      } catch (err) {
        console.error("Cart submit exception:", err);
        alert("Adding personalized item to cart failed.");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove("loading");
        }
      }
    });
  }

  // Intercept window.fetch to trigger synchronized Upcharge adjustments in real-time
  function interceptAJAXCartSync() {
    const nativeFetch = window.fetch;
    window.fetch = async function(...args) {
      const url = args[0];
      if (typeof url === 'string' && (url.includes('/cart/change') || url.includes('/cart/update') || url.includes('/cart/clear'))) {
        const response = await nativeFetch.apply(this, args);
        try {
          await synchronizeCartQuantities();
        } catch (e) {
          console.warn("Real-time cart sync error:", e);
        }
        return response;
      }
      return nativeFetch.apply(this, args);
    };
  }

  async function synchronizeCartQuantities() {
    // 1. Fetch current cart
    const cartRes = await fetch("/cart.js");
    const cart = await cartRes.json();
    
    const items = cart.items || [];
    const updates = {};
    let changesRequired = false;

    // Group items by variant IDs
    items.forEach(item => {
      // Find personalized parent item
      if (item.properties && item.properties._preview_url) {
        const parentVarId = String(item.variant_id);
        const parentQty = item.quantity;

        // Find associated Upcharge line item
        const matchingUpcharge = items.find(u => {
          return u.sku === "upcharge" || 
                 (u.properties && u.properties._parent_variant === parentVarId);
        });

        if (matchingUpcharge) {
          const correctUpchargeQty = Math.round(matchingUpcharge.quantity / matchingUpcharge.quantity) * parentQty; // Scale ratio
          if (matchingUpcharge.quantity !== correctUpchargeQty) {
            updates[matchingUpcharge.key] = correctUpchargeQty;
            changesRequired = true;
          }
        }
      }

      // Identify orphaned upcharges (no parent personalized item exists in cart)
      if (item.properties && item.properties._parent_variant) {
        const parentId = item.properties._parent_variant;
        const parentExists = items.some(p => String(p.variant_id) === String(parentId));
        if (!parentExists) {
          updates[item.key] = 0; // Remove orphaned upcharge
          changesRequired = true;
        }
      }
    });

    if (changesRequired) {
      await fetch("/cart/update.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates })
      });
      // Refresh current viewport
      window.location.reload();
    }
  }

  // Forms event hooks
  textInputs.forEach(i => {
    const max = parseInt(i.getAttribute("maxlength")) || 50;
    const cntr = card.querySelector(`[data-counter-for="${i.id}"]`);
    i.addEventListener("input", () => {
      if (i.value.length > max) i.value = i.value.substring(0, max);
      if (cntr) {
        cntr.textContent = `${i.value.length}/${max}`;
        cntr.className = "personalizer-char-count";
        const rem = max - i.value.length;
        if (rem <= 0) cntr.classList.add("error");
        else if (rem <= 10) cntr.classList.add("warning");
      }
      evaluateConditionalRules();
    });
  });

  selectMenus.forEach(s => s.addEventListener("change", evaluateConditionalRules));
  checkboxes.forEach(c => c.addEventListener("change", evaluateConditionalRules));

  swatches.forEach(sw => {
    const targetInputId = sw.getAttribute("data-target-input");
    const hiddenValInput = card.querySelector(`#${targetInputId}`);
    const btns = sw.querySelectorAll(".personalizer-swatch-btn");

    btns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        btns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        if (hiddenValInput) {
          hiddenValInput.value = btn.getAttribute("data-color");
        }
        evaluateConditionalRules();
      });
    });
  });

  // Layout builders executions
  buildTabsLayout();
  buildModalLayout();

  hookCartSubmission();
  interceptAJAXCartSync();
  evaluateConditionalRules();
  
  // Double hook Cart Sync to ensure page loads synchronize cleanly
  setTimeout(synchronizeCartQuantities, 800);
});
