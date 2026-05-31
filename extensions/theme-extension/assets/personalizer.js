document.addEventListener("DOMContentLoaded", () => {
  const card = document.querySelector(".personalizer-card");
  if (!card) return;

  const pId = card.getAttribute("data-product-id"), bgUrl = card.getAttribute("data-base-image"), isDemo = card.getAttribute("data-is-demo") === "true";
  let config = {};
  try {
    config = JSON.parse(card.getAttribute("data-config") || "{}");
  } catch (e) {
    console.error("Cfg err", e);
  }

  const cv = document.getElementById("personalizer-canvas"), cx = cv.getContext("2d");
  const loader = document.getElementById("personalizer-canvas-loader"), preInput = document.getElementById("personalizer-hidden-preview-url");

  const qs = (s, el = card) => el.querySelector(s);
  const qsa = (s, el = card) => el.querySelectorAll(s);

  const tInps = qsa(".personalizer-input-text"), selMenus = qsa(".personalizer-input-select"), swatches = qsa(".personalizer-swatch-list"), checks = qsa(".personalizer-input-checkbox"), files = qsa(".personalizer-file-input");
  let cvEl = { bg: null, img: null, text: "", font: "Arial", color: "#000000", size: 50 };
  const upchargeVarId = config.upchargeVariantId || "";

  cv.width = 800;
  cv.height = 800;

  if (bgUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = bgUrl;
    img.onload = () => { cvEl.bg = img; draw(); };
  }

  function draw() {
    cx.clearRect(0, 0, cv.width, cv.height);
    if (cvEl.bg) cx.drawImage(cvEl.bg, 0, 0, cv.width, cv.height);
    else { cx.fillStyle = "#fbfbfb"; cx.fillRect(0, 0, cv.width, cv.height); }

    if (cvEl.img) {
      cx.save();
      const sz = 300, x = (cv.width - sz) / 2, y = (cv.height - sz) / 2;
      cx.strokeStyle = "rgba(44,110,203,0.4)"; cx.lineWidth = 2;
      cx.strokeRect(x - 2, y - 2, sz + 4, sz + 4);
      cx.drawImage(cvEl.img, x, y, sz, sz);
      cx.restore();
    }

    if (cvEl.text && cvEl.text.trim() !== "") {
      cx.save();
      cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillStyle = cvEl.color;
      cx.font = `bold ${cvEl.size}px ${cvEl.font}, Arial, sans-serif`;
      cx.shadowColor = "rgba(0,0,0,0.15)"; cx.shadowBlur = 4;
      cx.shadowOffsetX = 2; cx.shadowOffsetY = 2;
      cx.fillText(cvEl.text, cv.width / 2, cv.height / 2 + (cvEl.img ? 200 : 0));
      cx.restore();
    }
  }

  function update() {
    const tInput = tInps[0];
    cvEl.text = tInput ? tInput.value : "";
    selMenus.forEach(s => {
      const name = s.getAttribute("name").toLowerCase();
      if (name.includes("font") || name.includes("style")) cvEl.font = s.value;
    });
    const actSwatch = qs(".personalizer-swatch-btn.active");
    if (actSwatch) cvEl.color = actSwatch.getAttribute("data-color");
    draw();
  }

  files.forEach(fInput => {
    const pGroup = fInput.closest(".personalizer-group");
    const pName = qs(".personalizer-file-preview-name", pGroup), hUrl = qs(".personalizer-input-file-url", pGroup);

    fInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      pName.textContent = file.name; loader.style.display = "flex";
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/apps/personalizer/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (data.success && data.url) {
          hUrl.value = data.url;
          const bImg = new Image();
          bImg.crossOrigin = "anonymous"; bImg.src = data.url;
          bImg.onload = () => { cvEl.img = bImg; draw(); };
        } else alert(`Upload error: ${data.error || "Unknown"}`);
      } catch (err) {
        console.error(err); alert("Upload failed.");
      } finally { loader.style.display = "none"; }
    });
  });

  function evalRules() {
    const list = config.options || [];
    const vals = {};

    tInps.forEach(i => { vals[i.closest(".personalizer-group").getAttribute("data-option-id")] = i.value; });
    selMenus.forEach(s => { vals[s.closest(".personalizer-group").getAttribute("data-option-id")] = s.value; });
    swatches.forEach(sw => {
      const optId = sw.getAttribute("data-target-input").replace("field-", "");
      const hVal = qs(`#field-${optId}`);
      if (hVal) vals[optId] = hVal.value;
    });
    checks.forEach(c => { vals[c.closest(".personalizer-group").getAttribute("data-option-id")] = c.checked ? "Yes" : ""; });

    list.forEach(opt => {
      const el = qs(`[data-option-id="${opt.id}"]`);
      if (!el) return;
      if (opt.conditionalRules && opt.conditionalRules.length > 0) {
        let show = true;
        opt.conditionalRules.forEach(r => {
          const pVal = vals[r.fieldId] || "";
          if (r.operator === "equals" && pVal !== r.value) show = false;
          else if (r.operator === "not_equals" && pVal === r.value) show = false;
          else if (r.operator === "checked" && !pVal) show = false;
          else if (r.operator === "unchecked" && pVal) show = false;
        });
        if (show) {
          el.style.display = "block"; el.classList.remove("personalizer-hidden");
        } else {
          el.style.display = "none"; el.classList.add("personalizer-hidden");
          const input = qs("input, select", el);
          if (input) {
            if (input.type === "checkbox") input.checked = false;
            else if (input.type === "text" || input.type === "hidden") input.value = "";
          }
        }
      }
    });
    update();
  }

  function syncForm() {
    const form = document.querySelector('form[action*="/cart/add"]');
    if (!form) return;
    let fId = form.id;
    if (!fId) {
      fId = `product-add-to-cart-form-${Math.random().toString(36).substr(2, 9)}`;
      form.id = fId;
    }
    qsa("input, select").forEach(i => i.setAttribute("form", fId));

    form.addEventListener("submit", async (e) => {
      if (!upchargeVarId || isDemo) return;
      e.preventDefault(); e.stopPropagation();

      const btn = form.querySelector('[type="submit"]');
      if (btn) { btn.disabled = true; btn.classList.add("loading"); }

      try {
        const thUrl = cv.toDataURL("image/png", 0.7);
        const bl = await (await fetch(thUrl)).blob();
        const pFile = new File([bl], `preview_${pId}.png`, { type: "image/png" });
        const fd = new FormData();
        fd.append("file", pFile);

        const upRes = await fetch("/apps/personalizer/upload", { method: "POST", body: fd });
        const upData = await upRes.json();
        if (upData.success && upData.url) preInput.value = upData.url;

        let fee = 0;
        qsa(".personalizer-group:not(.personalizer-hidden)").forEach(g => {
          const badge = qs(".personalizer-fee-tag", g);
          if (badge) {
            const val = parseFloat(badge.getAttribute("data-upcharge-amount")) || 0;
            const inp = qs("input, select", g);
            if (inp) {
              if (inp.type === "checkbox" && inp.checked) fee += val;
              else if (inp.type === "text" && inp.value.trim() !== "") fee += val;
              else if (inp.tagName === "SELECT" && inp.value) fee += val;
              else if (inp.type === "hidden" && inp.value) fee += val;
            }
          }
        });

        const props = {};
        qsa(".personalizer-group:not(.personalizer-hidden) input, .personalizer-group:not(.personalizer-hidden) select").forEach(inp => {
          const match = inp.getAttribute("name")?.match(/properties\[(.*?)\]/);
          if (match && match[1]) props[match[1]] = inp.value;
        });
        props["_preview_url"] = preInput.value;

        const qInput = form.querySelector('[name="quantity"]');
        const qty = qInput ? parseInt(qInput.value) || 1 : 1;
        const vInput = form.querySelector('[name="id"]');
        const vId = vInput ? vInput.value : "";

        const items = [{ id: vId, quantity: qty, properties: props }];
        if (fee > 0) {
          items.push({
            id: upchargeVarId,
            quantity: Math.round(fee * qty),
            properties: { "_parent_variant": vId, "Info": "Customizations upcharge" }
          });
        }

        const addRes = await fetch("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        if (addRes.ok) window.location.href = "/cart";
        else throw new Error();
      } catch (err) {
        console.error(err); alert("Cart insertion failed.");
      } finally {
        if (btn) { btn.disabled = false; btn.classList.remove("loading"); }
      }
    });
  }

  tInps.forEach(i => {
    const max = parseInt(i.getAttribute("maxlength")) || 50;
    const cntr = qs(`[data-counter-for="${i.id}"]`);
    i.addEventListener("input", () => {
      if (i.value.length > max) i.value = i.value.substring(0, max);
      if (cntr) {
        cntr.textContent = `${i.value.length}/${max}`;
        cntr.className = "personalizer-char-count";
        const rem = max - i.value.length;
        if (rem <= 0) cntr.classList.add("error");
        else if (rem <= 10) cntr.classList.add("warning");
      }
      evalRules();
    });
  });

  selMenus.forEach(s => s.addEventListener("change", evalRules));
  swatches.forEach(sw => {
    const tId = sw.getAttribute("data-target-input");
    const hInp = qs(`#${tId}`);
    const btns = qsa(".personalizer-swatch-btn", sw);
    btns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        btns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        if (hInp) hInp.value = btn.getAttribute("data-color");
        evalRules();
      });
    });
  });

  checks.forEach(c => c.addEventListener("change", evalRules));

  syncForm();
  setTimeout(syncForm, 1000);
  setTimeout(syncForm, 3000);
  evalRules();
});
