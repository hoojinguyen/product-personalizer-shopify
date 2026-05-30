/* Dynamic Javascript for Product Personalizer (Zepto Mode) */

document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector(".personalizer-card");
  if (!container) return;

  const textInputs = container.querySelectorAll(".personalizer-input-text");
  const selectMenus = container.querySelectorAll(".personalizer-input-select");
  const swatchGroups = container.querySelectorAll(".personalizer-swatch-list");
  const checkboxes = container.querySelectorAll(".personalizer-input-checkbox");

  const previewText = container.querySelector(".personalizer-preview-text");
  const previewDetails = container.querySelector(".personalizer-preview-badge");
  const previewPlaceholder = container.querySelector(".personalizer-preview-placeholder");

  let currentText = "";
  let currentFont = "Arial";
  let currentColor = "#000000";

  // 1. Hook ALL personalization inputs into the Shopify Product Form
  function coupleInputsToForm() {
    const productForm = document.querySelector('form[action*="/cart/add"]');
    if (!productForm) {
      console.warn("Product Personalizer: Could not find active Add to Cart form. Retrying...");
      return;
    }

    let formId = productForm.id;
    if (!formId) {
      formId = `product-add-to-cart-form-${Math.random().toString(36).substr(2, 9)}`;
      productForm.id = formId;
    }

    // Capture all active inputs (texts, selects, hidden swatch values, and checkboxes)
    const inputs = container.querySelectorAll("input, select");
    inputs.forEach(input => {
      input.setAttribute("form", formId);
    });
  }

  coupleInputsToForm();
  setTimeout(coupleInputsToForm, 1000);
  setTimeout(coupleInputsToForm, 3000);

  // 2. Real-time Live Preview Handler
  function updatePreview() {
    // We will preview the first available text input's content
    const primaryTextInput = textInputs[0];
    currentText = primaryTextInput ? primaryTextInput.value : "";

    // Search for a select menu that controls font
    selectMenus.forEach(select => {
      const name = select.getAttribute("name").toLowerCase();
      if (name.includes("font") || name.includes("style")) {
        currentFont = select.value;
      }
    });

    if (currentText.trim() === "") {
      previewPlaceholder.style.display = "block";
      previewText.style.display = "none";
      previewDetails.style.display = "none";
    } else {
      previewPlaceholder.style.display = "none";
      previewText.style.display = "block";
      previewDetails.style.display = "inline-block";

      previewText.textContent = currentText;
      previewText.style.fontFamily = currentFont;
      previewText.style.color = currentColor;

      previewDetails.textContent = `Font: ${currentFont} | Color: ${currentColor}`;
    }
  }

  // 3. Register Event Listeners

  // Text Inputs: Truncation, character count, and preview update
  textInputs.forEach(input => {
    const maxChars = parseInt(input.getAttribute("maxlength")) || 50;
    const counter = container.querySelector(`[data-counter-for="${input.id}"]`);

    function handleTextChange() {
      if (input.value.length > maxChars) {
        input.value = input.value.substring(0, maxChars);
      }
      
      if (counter) {
        counter.textContent = `${input.value.length}/${maxChars}`;
        counter.className = "personalizer-char-count";
        
        const charsRemaining = maxChars - input.value.length;
        if (charsRemaining <= 0) {
          counter.classList.add("error");
        } else if (charsRemaining <= 10) {
          counter.classList.add("warning");
        }
      }
      updatePreview();
    }

    input.addEventListener("input", handleTextChange);
  });

  // Select Menus: Font selections and preview update
  selectMenus.forEach(select => {
    select.addEventListener("change", () => {
      updatePreview();
    });
  });

  // Color Swatch Lists
  swatchGroups.forEach(swatchList => {
    const targetInputId = swatchList.getAttribute("data-target-input");
    const targetHiddenInput = container.querySelector(`#${targetInputId}`);
    const buttons = swatchList.querySelectorAll(".personalizer-swatch-btn");

    // Initialize with first active swatch color
    const activeBtn = swatchList.querySelector(".personalizer-swatch-btn.active");
    if (activeBtn) {
      currentColor = activeBtn.getAttribute("data-color");
    }

    buttons.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        buttons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const colorVal = btn.getAttribute("data-color");
        if (targetHiddenInput) {
          targetHiddenInput.value = colorVal;
        }
        
        currentColor = colorVal;
        updatePreview();
      });
    });
  });

  // Checkboxes
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      // Simply trigger form sync just in case
      coupleInputsToForm();
    });
  });

  // Initial update
  updatePreview();
});
