import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { useEffect, useState, useRef } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

// The GraphQL query to fetch products and their personalization metafields
const PRODUCTS_QUERY = `#graphql
  query getProducts {
    products(first: 100) {
      edges {
        node {
          id
          title
          handle
          vendor
          tags
          featuredImage {
            url
          }
          metafield(namespace: "app", key: "customization_config") {
            id
            value
          }
        }
      }
    }
  }
`;

// Loader: Fetch products and assets from Shopify & DB
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  // Programmatically verify and create metafield definitions to ensure the app is self-healing
  try {
    await admin.graphql(
      `#graphql
      mutation createProductMetafieldDef {
        metafieldDefinitionCreate(definition: {
          namespace: "app"
          key: "customization_config"
          type: "json"
          ownerType: PRODUCT
          name: "Product Customization Config"
          access: {
            storefront: PUBLIC_READ
          }
        }) {
          metafieldDefinition {
            id
          }
          userErrors {
            message
          }
        }
      }`
    );
  } catch (err) {
    console.log("Metafield definition already exists or failed to create, skipping...", err);
  }

  const response = await admin.graphql(PRODUCTS_QUERY);
  const responseJson = await response.json();
  const products = responseJson.data?.products?.edges?.map((e: any) => e.node) || [];

  const assets = await db.asset.findMany({
    where: { shop }
  });

  return { products, assets };
};

// Action: Save customization configuration
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const productId = formData.get("productId") as string;
  const enabled = formData.get("enabled") === "true";
  const optionsJson = formData.get("options") as string;
  const upchargeVariantId = formData.get("upchargeVariantId") as string;

  let options = [];
  try {
    options = JSON.parse(optionsJson);
  } catch (e) {
    console.error("Error parsing options JSON in action", e);
  }

  const config = {
    enabled,
    options,
    upchargeVariantId: upchargeVariantId || ""
  };

  const response = await admin.graphql(
    `#graphql
    mutation setProductMetafield($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          value
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId: productId,
            namespace: "app",
            key: "customization_config",
            type: "json",
            value: JSON.stringify(config)
          }
        ]
      }
    }
  );

  const responseJson = await response.json();
  return { ok: true, errors: responseJson.data?.metafieldsSet?.userErrors || [] };
};

interface ConditionalRule {
  fieldId: string;
  operator: "equals" | "not_equals" | "checked" | "unchecked";
  value: string;
}

interface CustomizationOption {
  id: string;
  type: "text" | "textarea" | "select" | "swatch" | "file" | "checkbox" | "clipart" | "font" | "number" | "info";
  label: string;
  required: boolean;
  priceUpcharge: number;
  placeholder?: string;
  maxChars?: number;
  choices?: string;
  choicesType?: "custom" | "global";
  assetSetId?: string;
  conditionalRules?: ConditionalRule[];
  description?: string;
  caseConstraint?: "uppercase" | "lowercase" | "normal";
  allowedSymbols?: string;
  allowShopperColor?: boolean;
  linkedColorSetId?: string;
  
  // Coordinate positioning attributes (800x800 logical coordinate matrix)
  canvasX?: number;
  canvasY?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  canvasRotation?: number;
  canvasFontSize?: number;
}

export default function ConfigureProductOptions() {
  const { products: initialProducts, assets } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  // Custom UI layout states
  const [viewMode, setViewMode] = useState<"list" | "editor">("list");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  
  // Customizer Configuration State
  const [enabled, setEnabled] = useState(false);
  const [options, setOptions] = useState<CustomizationOption[]>([]);
  const [upchargeVariantId, setUpchargeVariantId] = useState("");
  
  // Canvas Alignment and Drag States
  const [showGrid, setShowGrid] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [hoveredOptionId, setHoveredOptionId] = useState<string | null>(null);
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

  // List View Pagination & Search/Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortKey, setSortKey] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);
  const [savingStatusToggleId, setSavingStatusToggleId] = useState<string | null>(null);
  const [activeFlyoutId, setActiveFlyoutId] = useState<string | null>(null);
  const [activeAccordion, setActiveAccordion] = useState<string>("basic");

  // Shopper storefront inputs testing states
  const [shopperValues, setShopperValues] = useState<Record<string, any>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Modal selector list search state
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [modalSearchBy, setModalSearchBy] = useState("all");
  const [modalSelectedProductId, setModalSelectedProductId] = useState<string | null>(null);
  
  // Table row actions dropdown state
  const [activeActionsDropdownId, setActiveActionsDropdownId] = useState<string | null>(null);

  // Drag and drop / Rotate Canvas State
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    isResizing: boolean;
    isRotating: boolean;
    resizeHandle: "nw" | "ne" | "sw" | "se" | null;
    startMouseX: number;
    startMouseY: number;
    startCanvasX: number;
    startCanvasY: number;
    startWidth: number;
    startHeight: number;
    startFontSize: number;
    startRotation: number;
  }>({
    isDragging: false,
    isResizing: false,
    isRotating: false,
    resizeHandle: null,
    startMouseX: 0,
    startMouseY: 0,
    startCanvasX: 0,
    startCanvasY: 0,
    startWidth: 250,
    startHeight: 250,
    startFontSize: 48,
    startRotation: 0
  });

  // Filter asset listings
  const fontAssets = assets.filter(a => a.type === "FONT" || a.type === "FONTS");
  const colorAssets = assets.filter(a => a.type === "COLOR" || a.type === "COLORS");
  const optionAssets = assets.filter(a => a.type === "OPTION" || a.type === "OPTIONS");

  // Load custom typography @font-face rules on mount
  useEffect(() => {
    fontAssets.forEach(f => {
      try {
        const val = JSON.parse(f.value);
        const fontName = f.name;
        const fontUrl = val.url;
        const format = val.format || "truetype";
        if (fontUrl) {
          const newStyle = document.createElement("style");
          newStyle.appendChild(document.createTextNode(`@font-face { font-family: "${fontName}"; src: url("${fontUrl}") format("${format}"); }`));
          document.head.appendChild(newStyle);
        }
      } catch (e) {}
    });
  }, [fontAssets]);

  // Handle selected product loading
  useEffect(() => {
    if (selectedProduct) {
      const configVal = selectedProduct.metafield?.value;
      if (configVal) {
        try {
          const config = JSON.parse(configVal);
          if (config.options) {
            setOptions(config.options);
            setEnabled(config.enabled ?? false);
            setUpchargeVariantId(config.upchargeVariantId || "");
          } else {
            // self-healing default option
            setOptions([
              {
                id: "opt-default-text",
                type: "text",
                label: "Engraving Text",
                required: true,
                priceUpcharge: 0.0,
                maxChars: 30,
                placeholder: "Enter text to engrave",
                canvasX: 400,
                canvasY: 400,
                canvasFontSize: 48,
                canvasWidth: 250,
                canvasHeight: 250,
                canvasRotation: 0
              }
            ]);
            setEnabled(config.enabled ?? false);
            setUpchargeVariantId("");
          }
        } catch (e) {
          setOptions([]);
          setEnabled(false);
          setUpchargeVariantId("");
        }
      } else {
        setEnabled(false);
        setUpchargeVariantId("");
        setOptions([
          {
            id: "opt-default-text",
            type: "text",
            label: "Engraving Text",
            required: true,
            priceUpcharge: 0.0,
            maxChars: 30,
            placeholder: "Enter text to engrave",
            canvasX: 400,
            canvasY: 400,
            canvasFontSize: 48,
            canvasWidth: 250,
            canvasHeight: 250,
            canvasRotation: 0
          }
        ]);
      }
      
      // Load background mockup image
      if (selectedProduct.featuredImage?.url) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = selectedProduct.featuredImage.url;
        img.onload = () => setBgImage(img);
        img.onerror = () => setBgImage(null);
      } else {
        setBgImage(null);
      }
      
      // Reset shopper testing values
      setShopperValues({});
    }
  }, [selectedProduct]);

  // Handle toast notification upon successful action triggers
  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Customization details saved successfully!");
      setSavingStatusToggleId(null);
    }
  }, [fetcher.data, shopify]);

  // List View Operations (Sorting, Filtering, Pagination)
  const vendors = Array.from(new Set(initialProducts.map((p: any) => p.vendor).filter(Boolean))) as string[];
  const tagsList = Array.from(new Set(initialProducts.flatMap((p: any) => p.tags || []).filter(Boolean))) as string[];

  const filteredProducts = initialProducts.filter((p: any) => {
    const titleMatch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
    const vendorMatch = vendorFilter ? p.vendor === vendorFilter : true;
    const tagMatch = tagFilter ? p.tags?.includes(tagFilter) : true;
    return titleMatch && vendorMatch && tagMatch;
  });

  const sortedProducts = [...filteredProducts].sort((a: any, b: any) => {
    const isAConfig = a.metafield?.value ? JSON.parse(a.metafield.value).enabled : false;
    const isBConfig = b.metafield?.value ? JSON.parse(b.metafield.value).enabled : false;
    
    if (sortKey === "alphabetical_asc") return a.title.localeCompare(b.title);
    if (sortKey === "alphabetical_desc") return b.title.localeCompare(a.title);
    if (sortKey === "status_active") return (isBConfig ? 1 : 0) - (isAConfig ? 1 : 0);
    // default/newest (by loading order)
    return 0;
  });

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage) || 1;
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Status Switch AJAX Mutator
  const handleToggleStatus = (product: any, currentEnabled: boolean) => {
    setSavingStatusToggleId(product.id);
    const configVal = product.metafield?.value;
    let configOptions = [];
    let configUpcharge = "";
    if (configVal) {
      try {
        const parsed = JSON.parse(configVal);
        configOptions = parsed.options || [];
        configUpcharge = parsed.upchargeVariantId || "";
      } catch (e) {}
    }
    
    if (configOptions.length === 0) {
      configOptions = [
        {
          id: "opt-default-text",
          type: "text",
          label: "Engraving Text",
          required: true,
          priceUpcharge: 0.0,
          maxChars: 30,
          placeholder: "Enter text to engrave",
          canvasX: 400,
          canvasY: 400,
          canvasFontSize: 48,
          canvasWidth: 250,
          canvasHeight: 250,
          canvasRotation: 0
        }
      ];
    }

    fetcher.submit(
      {
        productId: product.id,
        enabled: String(!currentEnabled),
        options: JSON.stringify(configOptions),
        upchargeVariantId: configUpcharge
      },
      { method: "POST" }
    );
  };

  // Bulk deleting option mappings
  const handleBulkDelete = () => {
    if (confirm(`Are you sure you want to delete personalization settings for ${bulkSelectedIds.length} products?`)) {
      bulkSelectedIds.forEach(id => {
        fetcher.submit(
          {
            productId: id,
            enabled: "false",
            options: JSON.stringify([]),
            upchargeVariantId: ""
          },
          { method: "POST" }
        );
      });
      setBulkSelectedIds([]);
      shopify.toast.show("Bulk deletion completed!");
    }
  };

  // Add elements picker logic
  const handleAddElementOption = (type: CustomizationOption["type"]) => {
    const label = type.charAt(0).toUpperCase() + type.slice(1) + " Personalization";
    const newOption: CustomizationOption = {
      id: `opt-${Date.now()}`,
      type,
      label,
      required: false,
      priceUpcharge: 0.0,
      canvasX: 400,
      canvasY: 400,
      canvasWidth: 240,
      canvasHeight: type === "textarea" ? 140 : type === "info" ? 100 : 240,
      canvasRotation: 0,
      canvasFontSize: type === "textarea" ? 32 : 48,
      placeholder: `Enter your customization...`,
      conditionalRules: []
    };

    if (type === "select") {
      newOption.choices = "Option A, Option B, Option C";
    } else if (type === "swatch") {
      newOption.choices = "#000000, #E63946, #457B9D, #1D3557";
      newOption.allowShopperColor = true;
    } else if (type === "clipart") {
      newOption.choices = "Heart, Star, Smiley Face";
    }

    setOptions([...options, newOption]);
    setActiveLayerId(newOption.id);
    setActiveFlyoutId(newOption.id);
    setIsAddDrawerOpen(false);
  };

  const handleRemoveOption = (id: string) => {
    if (confirm("Are you sure you want to remove this option layer?")) {
      setOptions(options.filter(o => o.id !== id));
      if (activeLayerId === id) setActiveLayerId(null);
      if (activeFlyoutId === id) setActiveFlyoutId(null);
    }
  };

  const handleUpdateOption = (id: string, updates: Partial<CustomizationOption>) => {
    setOptions(options.map(o => {
      if (o.id === id) {
        return { ...o, ...updates };
      }
      return o;
    }));
  };

  // Option Visibility Conditional Logic Evaluator
  const isOptionVisible = (opt: CustomizationOption) => {
    if (!opt.conditionalRules || opt.conditionalRules.length === 0) return true;
    return opt.conditionalRules.every(rule => {
      if (!rule.fieldId) return true;
      const val = shopperValues[rule.fieldId];
      if (rule.operator === "checked") return val === true || val === "true";
      if (rule.operator === "unchecked") return !val || val === false || val === "false";
      if (rule.operator === "equals") return String(val || "") === String(rule.value);
      if (rule.operator === "not_equals") return String(val || "") !== String(rule.value);
      return true;
    });
  };

  // Drag-and-drop layer reordering HTML5 Handlers
  const handleDragStart = (idx: number) => {
    setDraggedIndex(idx);
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === idx) return;
    const reordered = [...options];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(idx, 0, removed);
    setOptions(reordered);
    setDraggedIndex(idx);
  };
  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Canvas Mouse pos scaling math
  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 400;
    const y = ((e.clientY - rect.top) / rect.height) * 400;
    return { x, y };
  };

  // Bounding box selection, rotate & dragging handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasMousePos(e);
    const mappedX = x * 2;
    const mappedY = y * 2;

    if (activeLayerId) {
      const opt = options.find(o => o.id === activeLayerId);
      if (opt && isOptionVisible(opt)) {
        const cx = opt.canvasX ?? 400;
        const cy = opt.canvasY ?? 400;
        
        let shopperText = shopperValues[opt.id] !== undefined ? shopperValues[opt.id] : opt.label;
        if (opt.caseConstraint === "uppercase") shopperText = shopperText.toUpperCase();
        if (opt.caseConstraint === "lowercase") shopperText = shopperText.toLowerCase();

        const w = opt.type === "text" || opt.type === "textarea"
          ? ((opt.canvasFontSize ?? 48) * String(shopperText || "Text").length * 0.5) 
          : (opt.canvasWidth ?? 250);
        const h = opt.type === "text" || opt.type === "textarea" 
          ? (opt.canvasFontSize ?? 48) 
          : (opt.canvasHeight ?? 250);

        // Check rotation handle hit (25px above top-center)
        const handleX = cx;
        const handleY = cy - h/2 - 25;
        const distToRotation = Math.sqrt((mappedX - handleX) ** 2 + (mappedY - handleY) ** 2);
        
        if (distToRotation < 15) {
          setDragState({
            isDragging: false,
            isResizing: false,
            isRotating: true,
            resizeHandle: null,
            startMouseX: mappedX,
            startMouseY: mappedY,
            startCanvasX: cx,
            startCanvasY: cy,
            startWidth: opt.canvasWidth ?? 250,
            startHeight: opt.canvasHeight ?? 250,
            startFontSize: opt.canvasFontSize ?? 48,
            startRotation: opt.canvasRotation ?? 0
          });
          return;
        }

        // Check corners resize handles hits (nw, ne, sw, se)
        const threshold = 18;
        const left = cx - w/2;
        const right = cx + w/2;
        const top = cy - h/2;
        const bottom = cy + h/2;

        let handle: "nw" | "ne" | "sw" | "se" | null = null;
        if (Math.abs(mappedX - left) < threshold && Math.abs(mappedY - top) < threshold) handle = "nw";
        else if (Math.abs(mappedX - right) < threshold && Math.abs(mappedY - top) < threshold) handle = "ne";
        else if (Math.abs(mappedX - left) < threshold && Math.abs(mappedY - bottom) < threshold) handle = "sw";
        else if (Math.abs(mappedX - right) < threshold && Math.abs(mappedY - bottom) < threshold) handle = "se";

        if (handle) {
          setDragState({
            isDragging: false,
            isResizing: true,
            isRotating: false,
            resizeHandle: handle,
            startMouseX: mappedX,
            startMouseY: mappedY,
            startCanvasX: cx,
            startCanvasY: cy,
            startWidth: opt.canvasWidth ?? 250,
            startHeight: opt.canvasHeight ?? 250,
            startFontSize: opt.canvasFontSize ?? 48,
            startRotation: opt.canvasRotation ?? 0
          });
          return;
        }
      }
    }

    // Layer body selection checking
    for (let i = options.length - 1; i >= 0; i--) {
      const opt = options[i];
      if (!isOptionVisible(opt)) continue;
      
      const cx = opt.canvasX ?? 400;
      const cy = opt.canvasY ?? 400;
      let shopperText = shopperValues[opt.id] !== undefined ? shopperValues[opt.id] : opt.label;
      if (opt.caseConstraint === "uppercase") shopperText = shopperText.toUpperCase();
      if (opt.caseConstraint === "lowercase") shopperText = shopperText.toLowerCase();

      const w = opt.type === "text" || opt.type === "textarea"
        ? ((opt.canvasFontSize ?? 48) * String(shopperText || "Text").length * 0.5) 
        : (opt.canvasWidth ?? 250);
      const h = opt.type === "text" || opt.type === "textarea" 
        ? (opt.canvasFontSize ?? 48) 
        : (opt.canvasHeight ?? 250);

      if (
        mappedX >= cx - w/2 &&
        mappedX <= cx + w/2 &&
        mappedY >= cy - h/2 &&
        mappedY <= cy + h/2
      ) {
        setActiveLayerId(opt.id);
        setDragState({
          isDragging: true,
          isResizing: false,
          isRotating: false,
          resizeHandle: null,
          startMouseX: mappedX,
          startMouseY: mappedY,
          startCanvasX: cx,
          startCanvasY: cy,
          startWidth: opt.canvasWidth ?? 250,
          startHeight: opt.canvasHeight ?? 250,
          startFontSize: opt.canvasFontSize ?? 48,
          startRotation: opt.canvasRotation ?? 0
        });
        return;
      }
    }

    setActiveLayerId(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasMousePos(e);
    const mappedX = x * 2;
    const mappedY = y * 2;

    const opt = options.find(o => o.id === activeLayerId);

    if (dragState.isDragging && opt) {
      const dx = mappedX - dragState.startMouseX;
      const dy = mappedY - dragState.startMouseY;
      handleUpdateOption(opt.id, {
        canvasX: Math.round(dragState.startCanvasX + dx),
        canvasY: Math.round(dragState.startCanvasY + dy)
      });
    } else if (dragState.isResizing && opt) {
      const dx = mappedX - dragState.startMouseX;
      const dy = mappedY - dragState.startMouseY;
      const handle = dragState.resizeHandle;

      if (opt.type === "text" || opt.type === "textarea") {
        const factor = handle?.startsWith("s") ? 1 : -1;
        const sizeDelta = Math.round(dy * factor);
        const newSize = Math.max(12, dragState.startFontSize + sizeDelta);
        handleUpdateOption(opt.id, {
          canvasFontSize: newSize
        });
      } else {
        const wFactor = handle?.endsWith("e") ? 1 : -1;
        const hFactor = handle?.startsWith("s") ? 1 : -1;
        
        const newWidth = Math.max(40, dragState.startWidth + Math.round(dx * wFactor));
        const newHeight = Math.max(40, dragState.startHeight + Math.round(dy * hFactor));
        
        handleUpdateOption(opt.id, {
          canvasWidth: newWidth,
          canvasHeight: newHeight
        });
      }
    } else if (dragState.isRotating && opt) {
      // Angle math
      const dx = mappedX - opt.canvasX!;
      const dy = mappedY - opt.canvasY!;
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      angle = (angle + 90) % 360;
      handleUpdateOption(opt.id, {
        canvasRotation: Math.round(angle)
      });
    } else {
      // Hover checker logic
      let hoverId = null;
      for (let i = options.length - 1; i >= 0; i--) {
        const o = options[i];
        if (!isOptionVisible(o)) continue;
        
        const cx = o.canvasX ?? 400;
        const cy = o.canvasY ?? 400;
        let shopperText = shopperValues[o.id] !== undefined ? shopperValues[o.id] : o.label;
        if (o.caseConstraint === "uppercase") shopperText = shopperText.toUpperCase();
        if (o.caseConstraint === "lowercase") shopperText = shopperText.toLowerCase();

        const w = o.type === "text" || o.type === "textarea"
          ? ((o.canvasFontSize ?? 48) * String(shopperText || "Text").length * 0.5)
          : (o.canvasWidth ?? 250);
        const h = o.type === "text" || o.type === "textarea" 
          ? (o.canvasFontSize ?? 48) 
          : (o.canvasHeight ?? 250);

        if (
          mappedX >= cx - w/2 &&
          mappedX <= cx + w/2 &&
          mappedY >= cy - h/2 &&
          mappedY <= cy + h/2
        ) {
          hoverId = o.id;
          break;
        }
      }
      setHoveredOptionId(hoverId);
    }
  };

  const handleCanvasMouseUp = () => {
    setDragState(prev => ({
      ...prev,
      isDragging: false,
      isResizing: false,
      isRotating: false,
      resizeHandle: null
    }));
  };

  // Canvas drawing effect loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 400;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background image
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)"; // contrast screen
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Grid lines drawer
    if (showGrid) {
      ctx.strokeStyle = "rgba(0, 128, 96, 0.08)";
      ctx.lineWidth = 0.5;
      for (let x = 40; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 40; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    // Render layers sequentially (bottom to top)
    options.forEach((opt) => {
      if (!isOptionVisible(opt)) return;

      ctx.save();
      const cx = (opt.canvasX ?? 400) / 2;
      const cy = (opt.canvasY ?? 400) / 2;
      ctx.translate(cx, cy);

      if (opt.canvasRotation) {
        ctx.rotate((opt.canvasRotation * Math.PI) / 180);
      }

      let renderW = 0;
      let renderH = 0;

      // Extract fonts & swatches shopper selections
      let activeFont = "Arial";
      let activeColor = "#000000";

      // Link Font Option values to Text layer formatting
      const fontOption = options.find(o => o.type === "font");
      if (fontOption && shopperValues[fontOption.id]) {
        activeFont = shopperValues[fontOption.id];
      }

      // Link Swatch Option values to Text layer formatting
      const swatchOption = options.find(o => o.type === "swatch");
      if (swatchOption && shopperValues[swatchOption.id]) {
        activeColor = shopperValues[swatchOption.id];
      }

      if (opt.type === "text" || opt.type === "textarea") {
        ctx.fillStyle = activeColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const fontSize = (opt.canvasFontSize ?? 48) / 2;
        ctx.font = `bold ${fontSize}px "${activeFont}", Arial, sans-serif`;

        let shopperText = shopperValues[opt.id] !== undefined ? shopperValues[opt.id] : opt.label;
        if (opt.caseConstraint === "uppercase") shopperText = shopperText.toUpperCase();
        if (opt.caseConstraint === "lowercase") shopperText = shopperText.toLowerCase();

        ctx.fillText(shopperText, 0, 0);

        renderW = fontSize * String(shopperText).length * 0.5;
        renderH = fontSize;
      } else if (opt.type === "clipart") {
        renderW = (opt.canvasWidth ?? 250) / 2;
        renderH = (opt.canvasHeight ?? 250) / 2;
        
        ctx.fillStyle = "rgba(0, 128, 96, 0.08)";
        ctx.strokeStyle = "#008060";
        ctx.lineWidth = 1.5;
        ctx.fillRect(-renderW/2, -renderH/2, renderW, renderH);
        ctx.strokeRect(-renderW/2, -renderH/2, renderW, renderH);

        ctx.fillStyle = "#008060";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        const clipartVal = shopperValues[opt.id] || opt.label;
        ctx.fillText(`🎨 Clipart: ${clipartVal}`, 0, 0);
      } else if (opt.type === "file") {
        renderW = (opt.canvasWidth ?? 250) / 2;
        renderH = (opt.canvasHeight ?? 250) / 2;

        ctx.fillStyle = "rgba(44, 62, 80, 0.08)";
        ctx.strokeStyle = "#2c3e50";
        ctx.lineWidth = 1.5;
        ctx.fillRect(-renderW/2, -renderH/2, renderW, renderH);
        ctx.strokeRect(-renderW/2, -renderH/2, renderW, renderH);

        ctx.fillStyle = "#2c3e50";
        ctx.font = "bold 10px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(shopperValues[opt.id] ? `📸 Loaded: Image` : `📸 Upload: ${opt.label}`, 0, 0);
      }

      // Draw highlighted/active/hover boundaries
      const isSelected = opt.id === activeLayerId;
      const isHovered = opt.id === hoveredOptionId;

      if (isSelected || isHovered) {
        ctx.strokeStyle = isSelected ? "#008060" : "rgba(16, 185, 129, 0.6)";
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.setLineDash(isSelected ? [4, 4] : [2, 2]);
        ctx.strokeRect(-renderW/2 - 6, -renderH/2 - 6, renderW + 12, renderH + 12);
        ctx.setLineDash([]);

        if (isSelected) {
          // Draw rotation node hook (extending straight UP center)
          ctx.beginPath();
          ctx.moveTo(0, -renderH/2 - 6);
          ctx.lineTo(0, -renderH/2 - 25);
          ctx.strokeStyle = "#008060";
          ctx.stroke();

          // Draw rotation handle circle
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#008060";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, -renderH/2 - 25, 4, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();

          // Draw four corner resize handles
          const handleSize = 6;
          const corners = [
            { x: -renderW/2 - 6, y: -renderH/2 - 6 },
            { x: renderW/2 + 6, y: -renderH/2 - 6 },
            { x: -renderW/2 - 6, y: renderH/2 + 6 },
            { x: renderW/2 + 6, y: renderH/2 + 6 }
          ];

          corners.forEach(corner => {
            ctx.fillStyle = "#ffffff";
            ctx.strokeStyle = "#008060";
            ctx.fillRect(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
            ctx.strokeRect(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
          });
        }
      }

      ctx.restore();
    });

  }, [options, bgImage, showGrid, activeLayerId, hoveredOptionId, shopperValues]);

  // Saving all personalized settings configuration
  const handleSaveConfiguration = () => {
    if (!selectedProduct) return;
    fetcher.submit(
      {
        productId: selectedProduct.id,
        enabled: String(enabled),
        options: JSON.stringify(options),
        upchargeVariantId: upchargeVariantId
      },
      { method: "POST" }
    );
  };

  // Duplicate options template to another product
  const handleDuplicateOptions = (sourceProduct: any) => {
    const targetProductTitle = prompt("Enter target product title to duplicate these configurations to:");
    if (!targetProductTitle) return;
    
    const targetProduct = initialProducts.find((p: any) => p.title.toLowerCase().includes(targetProductTitle.toLowerCase()));
    if (!targetProduct) {
      alert("Target product not found in store.");
      return;
    }
    
    const sourceConfig = sourceProduct.metafield?.value ? JSON.parse(sourceProduct.metafield.value) : { enabled: true, options: [] };
    
    fetcher.submit(
      {
        productId: targetProduct.id,
        enabled: String(sourceConfig.enabled ?? true),
        options: JSON.stringify(sourceConfig.options || []),
        upchargeVariantId: sourceConfig.upchargeVariantId || ""
      },
      { method: "POST" }
    );
    shopify.toast.show(`Duplicated options from ${sourceProduct.title} to ${targetProduct.title}!`);
    setActiveActionsDropdownId(null);
  };

  // Export customization config template as local JSON file
  const handleExportJson = (product: any) => {
    const configVal = product.metafield?.value;
    let config = { enabled: true, options: [], upchargeVariantId: "" };
    if (configVal) {
      try {
        config = JSON.parse(configVal);
      } catch (e) {}
    }
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `zepto_config_${product.handle}.json`);
    dlAnchorElem.click();
    
    shopify.toast.show(`Exported options schema for ${product.title}!`);
    setActiveActionsDropdownId(null);
  };

  // Delete options configurations
  const handleDeleteOptions = (product: any) => {
    if (confirm(`Are you sure you want to completely remove personalization options for ${product.title}?`)) {
      fetcher.submit(
        {
          productId: product.id,
          enabled: "false",
          options: JSON.stringify([]),
          upchargeVariantId: ""
        },
        { method: "POST" }
      );
      shopify.toast.show(`Deleted options for ${product.title}!`);
      setActiveActionsDropdownId(null);
    }
  };

  // Add Product picker modal query filtering
  const pickerProducts = initialProducts.filter((p: any) => {
    const isConfig = p.metafield?.value ? JSON.parse(p.metafield.value).enabled : false;
    const query = modalSearchQuery.toLowerCase();
    
    // Only show unconfigured products in the add options modal to prevent duplicate setup
    if (isConfig) return false;
    
    if (modalSearchBy === "all") {
      return p.title.toLowerCase().includes(query) || p.vendor.toLowerCase().includes(query);
    }
    if (modalSearchBy === "title") {
      return p.title.toLowerCase().includes(query);
    }
    if (modalSearchBy === "vendor") {
      return p.vendor.toLowerCase().includes(query);
    }
    return true;
  });

  const handleOpenEditorForProduct = (product: any) => {
    setSelectedProduct(product);
    setViewMode("editor");
  };

  const handleAddSelectedProduct = () => {
    if (modalSelectedProductId) {
      const match = initialProducts.find((p: any) => p.id === modalSelectedProductId);
      if (match) {
        setSelectedProduct(match);
        setViewMode("editor");
        setIsAddModalOpen(false);
        setModalSelectedProductId(null);
      }
    }
  };

  // Upcharge computation logic
  const calculateTotalUpcharges = () => {
    let sum = 0;
    options.forEach(opt => {
      if (isOptionVisible(opt) && opt.priceUpcharge > 0) {
        const val = shopperValues[opt.id];
        if (opt.type === "checkbox") {
          if (val === true || val === "true") sum += opt.priceUpcharge;
        } else {
          if (val !== undefined && val !== "") sum += opt.priceUpcharge;
        }
      }
    });
    return sum;
  };

  return (
    <div className="personalizer-dashboard">
      
      {/* Custom Styles Injection */}
      <style>{`
        .personalizer-dashboard {
          font-family: -apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
          color: #202223;
          background-color: #f6f6f7;
          min-height: 100vh;
          padding: 24px;
        }
        
        .breadcrumb-container {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #6d7175;
          margin-bottom: 12px;
        }
        .breadcrumb-link {
          color: #008060;
          text-decoration: none;
          cursor: pointer;
          font-weight: 500;
        }
        .breadcrumb-link:hover {
          text-decoration: underline;
        }
        
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .page-title {
          font-size: 20px;
          font-weight: 700;
          color: #202223;
          margin: 0;
        }
        
        .btn-primary {
          background-color: #008060;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background-color 0.15s ease, transform 0.1s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .btn-primary:hover {
          background-color: #006e52;
        }
        .btn-primary:active {
          transform: scale(0.98);
        }
        .btn-primary:disabled {
          background-color: #ebebeb;
          color: #8c9196;
          cursor: not-allowed;
          box-shadow: none;
        }
        
        .btn-secondary {
          background-color: #ffffff;
          color: #202223;
          border: 1px solid #babfc3;
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background-color 0.15s ease;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .btn-secondary:hover {
          background-color: #f6f6f7;
        }
        
        .btn-danger {
          background-color: #ffffff;
          color: #d82c0d;
          border: 1px solid #d82c0d;
          border-radius: 6px;
          padding: 6px 12px;
          font-weight: 600;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.15s;
        }
        .btn-danger:hover {
          background-color: #fff4f4;
        }
        
        .search-filters-row {
          display: flex;
          gap: 12px;
          background: #ffffff;
          border: 1px solid #e1e3e5;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.01);
        }
        .search-wrapper {
          position: relative;
          flex: 1;
        }
        .search-input {
          width: 100%;
          padding: 8px 12px 8px 36px;
          border: 1px solid #babfc3;
          border-radius: 6px;
          font-size: 14px;
          outline: none;
          background: #ffffff;
        }
        .search-input:focus {
          border-color: #008060;
          box-shadow: 0 0 0 2px rgba(0, 128, 96, 0.15);
        }
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #8c9196;
          font-size: 14px;
        }
        
        .filter-select {
          padding: 8px 12px;
          border: 1px solid #babfc3;
          border-radius: 6px;
          font-size: 14px;
          background: #ffffff;
          color: #202223;
          cursor: pointer;
          outline: none;
          min-width: 160px;
        }
        .filter-select:focus {
          border-color: #008060;
        }
        
        .data-table-container {
          background: #ffffff;
          border: 1px solid #e1e3e5;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.015);
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .data-table th {
          background: #f6f6f7;
          padding: 14px 16px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: #6d7175;
          border-bottom: 1px solid #e1e3e5;
          letter-spacing: 0.05em;
        }
        .data-table td {
          padding: 14px 16px;
          font-size: 14px;
          border-bottom: 1px solid #ebebeb;
          vertical-align: middle;
          color: #202223;
        }
        .data-table tr:hover {
          background: #f9fafb;
        }
        
        .bulk-actions-bar {
          background: #f0fbf7;
          border: 1px solid #008060;
          padding: 10px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          animation: slideDown 0.2s ease-out;
        }
        
        .pill-tag {
          display: inline-block;
          padding: 2px 8px;
          background-color: #f1f1f1;
          color: #202223;
          font-size: 11px;
          font-weight: 600;
          border-radius: 12px;
          margin-right: 4px;
        }
        
        .status-toggle {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }
        .status-toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .status-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #e4e4e7;
          transition: 0.3s;
          border-radius: 24px;
        }
        .status-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .status-toggle input:checked + .status-slider {
          background-color: #10b981;
        }
        .status-toggle input:checked + .status-slider:before {
          transform: translateX(20px);
        }
        
        .spinner-overlay {
          position: absolute;
          top: 4px;
          left: 4px;
          border: 2px solid rgba(0,0,0,0.1);
          border-top: 2px solid #008060;
          border-radius: 50%;
          width: 10px;
          height: 10px;
          animation: spin 0.8s linear infinite;
        }
        
        .pagination-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #ffffff;
          border-top: 1px solid #e1e3e5;
        }
        .pagination-btn {
          border: 1px solid #babfc3;
          background: #ffffff;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .pagination-btn:hover:not(:disabled) {
          background: #f6f6f7;
        }
        .pagination-btn:disabled {
          background: #f1f1f1;
          color: #8c9196;
          cursor: not-allowed;
        }
        
        .modal-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-card {
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          width: 600px;
          max-width: 90%;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        /* Three-Column Fullscreen Visual Customizer Overlay */
        .editor-fullscreen {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: #f1f2f4;
          z-index: 999;
          display: flex;
          flex-direction: column;
        }
        .editor-header {
          height: 56px;
          background: #ffffff;
          border-bottom: 1px solid #e1e3e5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        .editor-body {
          flex: 1;
          display: flex;
          overflow: hidden;
        }
        
        .left-panel {
          width: 25%;
          min-width: 320px;
          background: #ffffff;
          border-right: 1px solid #e1e3e5;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        
        .center-panel {
          width: 50%;
          background: #f1f2f4;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
        }
        
        .right-panel {
          width: 25%;
          min-width: 320px;
          background: #ffffff;
          border-left: 1px solid #e1e3e5;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .option-layer-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          border: 1px solid #e1e3e5;
          border-radius: 8px;
          background: #ffffff;
          margin-bottom: 8px;
          cursor: grab;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .option-layer-card:hover {
          border-color: #008060;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
        }
        .option-layer-card.selected {
          border-color: #008060;
          background-color: #f0fbf7;
        }
        
        /* Flyout Slider */
        .flyout-panel {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: #ffffff;
          z-index: 100;
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          box-shadow: -4px 0 15px rgba(0,0,0,0.05);
        }
        .flyout-panel.active {
          transform: translateX(0);
        }
        
        .accordion-header {
          padding: 14px 16px;
          font-weight: 600;
          font-size: 14px;
          background: #f9fafb;
          border-bottom: 1px solid #e1e3e5;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
        }
        .accordion-content {
          padding: 16px;
          border-bottom: 1px solid #e1e3e5;
          background: #ffffff;
        }
        
        .swatch-circle {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 2px solid #e1e3e5;
          cursor: pointer;
          transition: transform 0.15s;
        }
        .swatch-circle:hover {
          transform: scale(1.15);
        }
        .swatch-circle.active {
          border-color: #008060;
          box-shadow: 0 0 0 2px rgba(0,128,96,0.25);
        }
        
        /* Coordinate Floating Tooltip Box */
        .coordinates-badge {
          background: rgba(32, 34, 35, 0.9);
          color: #ffffff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-family: monospace;
          position: absolute;
          top: -30px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        
        .upcharge-badge {
          background: #f0fbf7;
          border: 1px solid #10b981;
          color: #008060;
          padding: 6px 12px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
      `}</style>

      {viewMode === "list" ? (
        // ==========================================
        // 1. PRODUCT OPTIONS LIST VIEW
        // ==========================================
        <div>
          {/* Breadcrumb row */}
          <div className="breadcrumb-container">
            <span className="breadcrumb-link" onClick={() => shopify.toast.show("Already at Home")}>Home</span>
            <span>&gt;</span>
            <span className="breadcrumb-link" onClick={() => shopify.toast.show("Opening Apps Dashboard")}>Apps</span>
            <span>&gt;</span>
            <span className="breadcrumb-link" onClick={() => shopify.toast.show("Zepto Product Personalizer Index")}>Zepto Product Personalizer</span>
            <span>&gt;</span>
            <span className="breadcrumb-link" style={{ color: "#202223", cursor: "default" }}>Product Options</span>
          </div>

          {/* Heading title row */}
          <div className="page-header">
            <div>
              <h1 className="page-title">Product Options</h1>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6d7175" }}>
                Add engraving, swatches, conditional visibility form questions, and upsell upcharges.
              </p>
            </div>
            <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
              <span>+ Add Product Option</span>
            </button>
          </div>

          {/* Bulk Selection actions */}
          {bulkSelectedIds.length > 0 && (
            <div className="bulk-actions-bar">
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#008060" }}>
                {bulkSelectedIds.length} products selected for action
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn-secondary" onClick={() => setBulkSelectedIds([])}>Deselect All</button>
                <button className="btn-danger" onClick={handleBulkDelete}>Delete Options Configuration</button>
              </div>
            </div>
          )}

          {/* Search, filters, sort controls */}
          <div className="search-filters-row">
            <div className="search-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search products by title..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>
            
            <select
              value={vendorFilter}
              onChange={(e) => { setVendorFilter(e.target.value); setCurrentPage(1); }}
              className="filter-select"
            >
              <option value="">Filter Vendor: All</option>
              {vendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>

            <select
              value={tagFilter}
              onChange={(e) => { setTagFilter(e.target.value); setCurrentPage(1); }}
              className="filter-select"
            >
              <option value="">Filter Tag: All</option>
              {tagsList.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="filter-select"
            >
              <option value="newest">Sort: Newest Config</option>
              <option value="alphabetical_asc">Sort: A - Z</option>
              <option value="alphabetical_desc">Sort: Z - A</option>
              <option value="status_active">Sort: Active Status</option>
            </select>
          </div>

          {/* Data table */}
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "40px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={bulkSelectedIds.length === paginatedProducts.length && paginatedProducts.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setBulkSelectedIds(paginatedProducts.map((p: any) => p.id));
                        } else {
                          setBulkSelectedIds([]);
                        }
                      }}
                      style={{ cursor: "pointer", width: "16px", height: "16px" }}
                    />
                  </th>
                  <th style={{ width: "60px" }}>Thumbnail</th>
                  <th>Product Title</th>
                  <th>Vendor</th>
                  <th>Tags</th>
                  <th style={{ width: "120px" }}>Status</th>
                  <th style={{ width: "150px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#6d7175" }}>
                      No configured products matched your current filters. Click "+ Add Product Option" to configure a new product!
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product: any) => {
                    const configVal = product.metafield?.value;
                    let isConfigured = false;
                    let configEnabled = false;
                    if (configVal) {
                      try {
                        const parsed = JSON.parse(configVal);
                        isConfigured = parsed.options?.length > 0;
                        configEnabled = parsed.enabled ?? false;
                      } catch (e) {}
                    }
                    const isSaving = savingStatusToggleId === product.id;

                    return (
                      <tr key={product.id}>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={bulkSelectedIds.includes(product.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBulkSelectedIds([...bulkSelectedIds, product.id]);
                              } else {
                                setBulkSelectedIds(bulkSelectedIds.filter(id => id !== product.id));
                              }
                            }}
                            style={{ cursor: "pointer", width: "16px", height: "16px" }}
                          />
                        </td>
                        <td>
                          {product.featuredImage?.url ? (
                            <img
                              src={product.featuredImage.url}
                              alt=""
                              style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "4px", border: "1px solid #ebebeb" }}
                            />
                          ) : (
                            <div style={{ width: "50px", height: "50px", background: "#f1f2f4", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>📦</div>
                          )}
                        </td>
                        <td>
                          <span
                            onClick={() => handleOpenEditorForProduct(product)}
                            style={{ color: "#0066cc", fontWeight: 600, cursor: "pointer", textDecoration: "none" }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = "underline"}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = "none"}
                          >
                            {product.title}
                          </span>
                          <a
                            href={`https://africazones-store.myshopify.com/products/${product.handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View live Shopify storefront product page"
                            style={{ display: "inline-flex", alignItems: "center", color: "#8c9196", marginLeft: "8px", textDecoration: "none", fontSize: "11px" }}
                          >
                            ↗
                          </a>
                          <div style={{ fontSize: "11px", color: "#8c9196", marginTop: "2px" }}>
                            handle: {product.handle}
                          </div>
                        </td>
                        <td>{product.vendor}</td>
                        <td>
                          {product.tags && product.tags.slice(0, 3).map((t: string) => (
                            <span key={t} className="pill-tag" style={{ background: "#f1f1f1", color: "#202223", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, marginRight: "4px" }}>{t}</span>
                          ))}
                          {product.tags && product.tags.length > 3 && (
                            <span className="pill-tag" style={{ background: "#f1f1f1", color: "#202223", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 600 }}>+{product.tags.length - 3}</span>
                          )}
                        </td>
                        <td>
                          <label className="status-toggle">
                            <input
                              type="checkbox"
                              checked={configEnabled}
                              disabled={isSaving}
                              onChange={() => handleToggleStatus(product, configEnabled)}
                            />
                            <span className="status-slider">
                              {isSaving && <span className="spinner-overlay" />}
                            </span>
                          </label>
                          <span style={{ marginLeft: "8px", fontSize: "12px", color: configEnabled ? "#10b981" : "#6d7175", fontWeight: 600 }}>
                            {configEnabled ? "On" : "Off"}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "8px", position: "relative" }}>
                            <button
                              className="btn-secondary"
                              onClick={() => handleOpenEditorForProduct(product)}
                              style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 12px", fontSize: "13px" }}
                            >
                              📝 Edit
                            </button>
                            <div style={{ position: "relative" }}>
                              <button
                                className="btn-secondary"
                                onClick={() => setActiveActionsDropdownId(activeActionsDropdownId === product.id ? null : product.id)}
                                style={{ padding: "6px 10px", fontSize: "13px" }}
                              >
                                ...
                              </button>
                              
                              {activeActionsDropdownId === product.id && (
                                <div style={{
                                  position: "absolute",
                                  right: 0,
                                  top: "100%",
                                  marginTop: "6px",
                                  background: "#ffffff",
                                  border: "1px solid #e1e3e5",
                                  borderRadius: "8px",
                                  boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                                  zIndex: 99,
                                  minWidth: "180px",
                                  display: "flex",
                                  flexDirection: "column",
                                  padding: "4px 0"
                                }}>
                                  <button
                                    onClick={() => handleDuplicateOptions(product)}
                                    style={{
                                      padding: "10px 14px",
                                      background: "none",
                                      border: "none",
                                      textAlign: "left",
                                      fontSize: "13px",
                                      cursor: "pointer",
                                      width: "100%",
                                      color: "#202223"
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "#f6f6f7"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                                  >
                                    📋 Duplicate Config
                                  </button>
                                  <button
                                    onClick={() => handleExportJson(product)}
                                    style={{
                                      padding: "10px 14px",
                                      background: "none",
                                      border: "none",
                                      textAlign: "left",
                                      fontSize: "13px",
                                      cursor: "pointer",
                                      width: "100%",
                                      color: "#202223"
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "#f6f6f7"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                                  >
                                    📥 Export JSON Template
                                  </button>
                                  <hr style={{ border: 0, borderTop: "1px solid #e1e3e5", margin: "4px 0" }} />
                                  <button
                                    onClick={() => handleDeleteOptions(product)}
                                    style={{
                                      padding: "10px 14px",
                                      background: "none",
                                      border: "none",
                                      textAlign: "left",
                                      fontSize: "13px",
                                      cursor: "pointer",
                                      width: "100%",
                                      color: "#d82c0d"
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "#fff4f4"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                                  >
                                    🗑️ Delete Options
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="pagination-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "#ffffff", borderTop: "1px solid #e1e3e5" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#6d7175" }}>
                  <span>Show:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(parseInt(e.target.value) || 10); setCurrentPage(1); }}
                    className="filter-select"
                    style={{ minWidth: "70px", padding: "4px 8px", fontSize: "13px" }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                    <option value={30}>30</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div style={{ fontSize: "13px", color: "#6d7175" }}>
                  Showing {Math.min((currentPage - 1) * itemsPerPage + 1, sortedProducts.length)} - {Math.min(currentPage * itemsPerPage, sortedProducts.length)} of {sortedProducts.length} results
                </div>
              </div>
              
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  className="pagination-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  ◀ Prev
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    className="pagination-btn"
                    style={{
                      borderColor: currentPage === i + 1 ? "#008060" : "#babfc3",
                      background: currentPage === i + 1 ? "#f0fbf7" : "#ffffff",
                      color: currentPage === i + 1 ? "#008060" : "#202223",
                      fontWeight: currentPage === i + 1 ? "bold" : "normal"
                    }}
                    onClick={() => setCurrentPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  className="pagination-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Next ▶
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ==========================================
        // 2. THREE-COLUMN FULLSCREEN VISUAL CUSTOMIZER
        // ==========================================
        <div className="editor-fullscreen">
          
          {/* Header Bar */}
          <div className="editor-header">
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                className="btn-secondary"
                style={{ padding: "6px 12px", fontSize: "13px" }}
                onClick={() => setViewMode("list")}
              >
                ◀ Back to List
              </button>
              <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                Editing Options: <span style={{ color: "#008060" }}>{selectedProduct.title}</span>
              </h2>
            </div>
            
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="btn-secondary"
                onClick={() => { if(confirm("Discard all unsaved edits?")) setViewMode("list"); }}
              >
                Discard
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveConfiguration}
                disabled={fetcher.state === "submitting"}
              >
                {fetcher.state === "submitting" ? "Saving..." : "Save Config"}
              </button>
            </div>
          </div>

          <div className="editor-body">
            
            {/* ----------------- LEFT PANEL: LAYERS & ELEMENTS ----------------- */}
            <div className="left-panel">
              <div style={{ padding: "16px", borderBottom: "1px solid #e1e3e5", background: "#f9fafb" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#6d7175", display: "block", marginBottom: "6px" }}>
                  Active Mockup View
                </span>
                <select className="filter-select" style={{ width: "100%" }}>
                  <option>Front Mockup View</option>
                  <option>Back Mockup View</option>
                  <option>Engraving Close-Up</option>
                </select>
              </div>

              {/* Layers Checklist cards */}
              <div style={{ padding: "16px", flex: 1, overflowY: "auto" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "12px", color: "#6d7175" }}>
                  Option Layers List (Drag handles to stack order)
                </span>

                {options.length === 0 ? (
                  <div style={{ padding: "24px", border: "1px dashed #babfc3", borderRadius: "8px", textAlign: "center", color: "#6d7175" }}>
                    No customizable layer layers yet. Add elements below!
                  </div>
                ) : (
                  options.map((opt, idx) => {
                    const isSelected = activeLayerId === opt.id;
                    let typeIcon = "✏️";
                    if (opt.type === "text" || opt.type === "textarea") typeIcon = "🔤";
                    if (opt.type === "swatch") typeIcon = "🎨";
                    if (opt.type === "file") typeIcon = "📸";
                    if (opt.type === "checkbox") typeIcon = "☑️";
                    if (opt.type === "select") typeIcon = "🔻";
                    if (opt.type === "clipart") typeIcon = "🖼️";
                    if (opt.type === "font") typeIcon = "";
                    if (opt.type === "number") typeIcon = "🔢";
                    if (opt.type === "info") typeIcon = "ℹ️";

                    return (
                      <div
                        key={opt.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        onClick={() => { setActiveLayerId(opt.id); setActiveFlyoutId(opt.id); }}
                        className={`option-layer-card ${isSelected ? "selected" : ""}`}
                        style={{
                          opacity: draggedIndex === idx ? 0.4 : 1,
                          cursor: "grab"
                        }}
                      >
                        <span style={{ color: "#8c9196", fontSize: "14px", cursor: "grab" }}>☰</span>
                        <span style={{ fontSize: "14px" }}>{typeIcon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {opt.label}
                          </div>
                          <div style={{ fontSize: "11px", color: "#6d7175" }}>
                            Type: {opt.type} {opt.priceUpcharge > 0 && `• +$${opt.priceUpcharge.toFixed(2)}`}
                          </div>
                        </div>
                        <button
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px" }}
                          onClick={(e) => { e.stopPropagation(); setActiveLayerId(opt.id); setActiveFlyoutId(opt.id); }}
                        >
                          ⚙️
                        </button>
                        <button
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#d82c0d", fontSize: "13px" }}
                          onClick={(e) => { e.stopPropagation(); handleRemoveOption(opt.id); }}
                        >
                          🗑️
                        </button>
                      </div>
                    );
                  })
                )}

                <button
                  className="btn-secondary"
                  style={{ width: "100%", borderStyle: "dashed", borderColor: "#008060", color: "#008060", background: "#f0fbf7", marginTop: "12px", justifyContent: "center" }}
                  onClick={() => setIsAddDrawerOpen(true)}
                >
                  ➕ Add Custom Element
                </button>
              </div>

              {/* Elements addition drawer */}
              {isAddDrawerOpen && (
                <div style={{
                  position: "absolute",
                  bottom: 0, left: 0, right: 0,
                  background: "#ffffff",
                  borderTop: "2px solid #008060",
                  padding: "16px",
                  boxShadow: "0 -4px 15px rgba(0,0,0,0.1)",
                  zIndex: 200,
                  maxHeight: "80%",
                  overflowY: "auto"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: "14px" }}>Select Element Option Type</span>
                    <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px" }} onClick={() => setIsAddDrawerOpen(false)}>×</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <button className="btn-secondary" onClick={() => handleAddElementOption("text")}>🔤 Text Single Line</button>
                    <button className="btn-secondary" onClick={() => handleAddElementOption("textarea")}>📝 Text Area Multi-line</button>
                    <button className="btn-secondary" onClick={() => handleAddElementOption("select")}>🔻 Dropdown Menu</button>
                    <button className="btn-secondary" onClick={() => handleAddElementOption("swatch")}>🎨 Color Swatches</button>
                    <button className="btn-secondary" onClick={() => handleAddElementOption("file")}>📸 Buyer Image Upload</button>
                    <button className="btn-secondary" onClick={() => handleAddElementOption("checkbox")}>☑️ Checkbox Toggle</button>
                    <button className="btn-secondary" onClick={() => handleAddElementOption("clipart")}>🖼️ Clipart Choice</button>
                    <button className="btn-secondary" onClick={() => handleAddElementOption("font")}> Font Selector</button>
                    <button className="btn-secondary" onClick={() => handleAddElementOption("number")}>🔢 Numeric Input</button>
                    <button className="btn-secondary" onClick={() => handleAddElementOption("info")}>ℹ️ HTML / Info Block</button>
                  </div>
                </div>
              )}

              {/* Collapsible General settings footer bar */}
              <div style={{ borderTop: "1px solid #e1e3e5", padding: "12px 16px", background: "#f6f6f7" }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onClick={() => setIsSettingsDrawerOpen(!isSettingsDrawerOpen)}
                >
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>⚙️ Personalizer Settings</span>
                  <span>{isSettingsDrawerOpen ? "▼" : "▲"}</span>
                </div>

                {isSettingsDrawerOpen && (
                  <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }} onClick={(e)=>e.stopPropagation()}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="checkbox"
                        id="editor-enabled-chk"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                      />
                      <label htmlFor="editor-enabled-chk" style={{ fontSize: "12px", fontWeight: 600 }}>
                        Activate personalization storefront block
                      </label>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "4px" }}>
                        $1.00 Upcharge Product Variant GID
                      </label>
                      <input
                        type="text"
                        className="search-input"
                        style={{ padding: "6px 8px" }}
                        value={upchargeVariantId}
                        onChange={(e) => setUpchargeVariantId(e.target.value)}
                        placeholder="gid://shopify/ProductVariant/..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ==========================================
                  4. FLYOUT DETAILS CONFIGURATION PANEL
                  ========================================== */}
              {activeFlyoutId && (
                (() => {
                  const opt = options.find(o => o.id === activeFlyoutId);
                  if (!opt) return null;

                  return (
                    <div className={`flyout-panel ${activeFlyoutId ? "active" : ""}`}>
                      <div style={{ padding: "16px", borderBottom: "1px solid #e1e3e5", display: "flex", alignItems: "center", gap: "12px", background: "#f9fafb" }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: "4px 8px", fontSize: "11px" }}
                          onClick={() => setActiveFlyoutId(null)}
                        >
                          ◀ Back
                        </button>
                        <span style={{ fontWeight: 700, fontSize: "13px" }}>
                          Configuring: {opt.label}
                        </span>
                      </div>

                      <div style={{ flex: 1, overflowY: "auto" }}>
                        {/* Accordion 1: Basic Settings */}
                        <div className="accordion-item">
                          <div className="accordion-header" onClick={() => setActiveAccordion("basic")}>
                            <span>🔻 Basic Settings</span>
                            <span>{activeAccordion === "basic" ? "▼" : "▶"}</span>
                          </div>
                          {activeAccordion === "basic" && (
                            <div className="accordion-content">
                              <div style={{ marginBottom: "12px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Option Label</label>
                                <input
                                  type="text"
                                  className="search-input"
                                  style={{ padding: "6px 10px" }}
                                  value={opt.label}
                                  onChange={(e) => handleUpdateOption(opt.id, { label: e.target.value })}
                                />
                              </div>
                              <div style={{ marginBottom: "12px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Placeholder Text</label>
                                <input
                                  type="text"
                                  className="search-input"
                                  style={{ padding: "6px 10px" }}
                                  value={opt.placeholder || ""}
                                  onChange={(e) => handleUpdateOption(opt.id, { placeholder: e.target.value })}
                                />
                              </div>
                              <div style={{ display: "flex", gap: "16px", marginBottom: "12px" }}>
                                <div style={{ flex: 1 }}>
                                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Upcharge Price ($)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="search-input"
                                    style={{ padding: "6px 10px" }}
                                    value={opt.priceUpcharge}
                                    onChange={(e) => handleUpdateOption(opt.id, { priceUpcharge: parseFloat(e.target.value) || 0 })}
                                  />
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "18px" }}>
                                  <input
                                    type="checkbox"
                                    id={`req-${opt.id}`}
                                    checked={opt.required}
                                    onChange={(e) => handleUpdateOption(opt.id, { required: e.target.checked })}
                                  />
                                  <label htmlFor={`req-${opt.id}`} style={{ fontSize: "12px", fontWeight: 600 }}>Required?</label>
                                </div>
                              </div>
                              <div>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Description / Help Subtext</label>
                                <textarea
                                  className="search-input"
                                  style={{ height: "60px", padding: "6px 10px" }}
                                  value={opt.description || ""}
                                  onChange={(e) => handleUpdateOption(opt.id, { description: e.target.value })}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Accordion 2: Fonts & Characters */}
                        {(opt.type === "text" || opt.type === "textarea" || opt.type === "font") && (
                          <div className="accordion-item">
                            <div className="accordion-header" onClick={() => setActiveAccordion("fonts")}>
                              <span>🔻 Fonts & Characters</span>
                              <span>{activeAccordion === "fonts" ? "▼" : "▶"}</span>
                            </div>
                            {activeAccordion === "fonts" && (
                              <div className="accordion-content">
                                <div style={{ marginBottom: "12px" }}>
                                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Max Character Limit</label>
                                  <input
                                    type="number"
                                    className="search-input"
                                    style={{ padding: "6px 10px" }}
                                    value={opt.maxChars || 50}
                                    onChange={(e) => handleUpdateOption(opt.id, { maxChars: parseInt(e.target.value) || 50 })}
                                  />
                                </div>
                                <div style={{ marginBottom: "12px" }}>
                                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Case Constraints</label>
                                  <select
                                    value={opt.caseConstraint || "normal"}
                                    onChange={(e) => handleUpdateOption(opt.id, { caseConstraint: e.target.value as any })}
                                    className="filter-select"
                                    style={{ width: "100%" }}
                                  >
                                    <option value="normal">Normal / As Input</option>
                                    <option value="uppercase">FORCE UPPERCASE</option>
                                    <option value="lowercase">force lowercase</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Allowed Custom Symbols</label>
                                  <input
                                    type="text"
                                    className="search-input"
                                    style={{ padding: "6px 10px" }}
                                    value={opt.allowedSymbols || ""}
                                    onChange={(e) => handleUpdateOption(opt.id, { allowedSymbols: e.target.value })}
                                    placeholder="♥, ★, ⚓, ♾, ✝"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Accordion 3: Colors & Swatches */}
                        {(opt.type === "swatch") && (
                          <div className="accordion-item">
                            <div className="accordion-header" onClick={() => setActiveAccordion("colors")}>
                              <span>🔻 Colors & Swatches</span>
                              <span>{activeAccordion === "colors" ? "▼" : "▶"}</span>
                            </div>
                            {activeAccordion === "colors" && (
                              <div className="accordion-content">
                                <div style={{ marginBottom: "12px" }}>
                                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Color Hex List (comma-separated)</label>
                                  <textarea
                                    className="search-input"
                                    style={{ height: "60px", padding: "6px 10px" }}
                                    value={opt.choices || ""}
                                    onChange={(e) => handleUpdateOption(opt.id, { choices: e.target.value })}
                                    placeholder="#000000, #E63946, #457B9D"
                                  />
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <input
                                    type="checkbox"
                                    id={`allow-sh-color`}
                                    checked={opt.allowShopperColor}
                                    onChange={(e) => handleUpdateOption(opt.id, { allowShopperColor: e.target.checked })}
                                  />
                                  <label htmlFor={`allow-sh-color`} style={{ fontSize: "12px", fontWeight: 600 }}>Allow shopper to change text overlay color</label>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Accordion 4: Conditions & Logic */}
                        <div className="accordion-item">
                          <div className="accordion-header" onClick={() => setActiveAccordion("conditions")}>
                            <span>🔻 Conditions & Logic Rules</span>
                            <span>{activeAccordion === "conditions" ? "▼" : "▶"}</span>
                          </div>
                          {activeAccordion === "conditions" && (
                            <div className="accordion-content">
                              <span style={{ fontSize: "11px", color: "#6d7175", display: "block", marginBottom: "12px" }}>
                                Show this personalization layer only IF the following condition is matched:
                              </span>

                              {(!opt.conditionalRules || opt.conditionalRules.length === 0) ? (
                                <div style={{ fontSize: "12px", color: "#8c9196", fontStyle: "italic", marginBottom: "12px" }}>
                                  No visibility rules configured. This layer is always visible.
                                </div>
                              ) : (
                                opt.conditionalRules.map((rule, ruleIdx) => (
                                  <div
                                    key={ruleIdx}
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "8px",
                                      background: "#f9fafb",
                                      padding: "10px",
                                      borderRadius: "6px",
                                      border: "1px solid #ebebeb",
                                      marginBottom: "10px"
                                    }}
                                  >
                                    <select
                                      value={rule.fieldId}
                                      onChange={(e) => {
                                        const updatedRules = [...(opt.conditionalRules || [])];
                                        updatedRules[ruleIdx].fieldId = e.target.value;
                                        handleUpdateOption(opt.id, { conditionalRules: updatedRules });
                                      }}
                                      className="filter-select"
                                      style={{ width: "100%", padding: "6px" }}
                                    >
                                      <option value="">Select option field...</option>
                                      {options.filter(o => o.id !== opt.id).map(o => (
                                        <option key={o.id} value={o.id}>{o.label}</option>
                                      ))}
                                    </select>

                                    <select
                                      value={rule.operator}
                                      onChange={(e) => {
                                        const updatedRules = [...(opt.conditionalRules || [])];
                                        updatedRules[ruleIdx].operator = e.target.value as any;
                                        handleUpdateOption(opt.id, { conditionalRules: updatedRules });
                                      }}
                                      className="filter-select"
                                      style={{ width: "100%", padding: "6px" }}
                                    >
                                      <option value="equals">Equals</option>
                                      <option value="not_equals">Not Equals</option>
                                      <option value="checked">Checked</option>
                                      <option value="unchecked">Unchecked</option>
                                    </select>

                                    {rule.operator !== "checked" && rule.operator !== "unchecked" && (
                                      <input
                                        type="text"
                                        className="search-input"
                                        style={{ padding: "6px" }}
                                        placeholder="Value to match..."
                                        value={rule.value}
                                        onChange={(e) => {
                                          const updatedRules = [...(opt.conditionalRules || [])];
                                          updatedRules[ruleIdx].value = e.target.value;
                                          handleUpdateOption(opt.id, { conditionalRules: updatedRules });
                                        }}
                                      />
                                    )}

                                    <button
                                      className="btn-danger"
                                      style={{ alignSelf: "flex-end", padding: "4px 8px" }}
                                      onClick={() => {
                                        const updatedRules = (opt.conditionalRules || []).filter((_, rIdx) => rIdx !== ruleIdx);
                                        handleUpdateOption(opt.id, { conditionalRules: updatedRules });
                                      }}
                                    >
                                      Remove Rule
                                    </button>
                                  </div>
                                ))
                              )}

                              <button
                                className="btn-secondary"
                                style={{ width: "100%", padding: "6px", fontSize: "12px", borderStyle: "dashed" }}
                                onClick={() => {
                                  const updatedRules = [...(opt.conditionalRules || []), { fieldId: "", operator: "equals" as const, value: "" }];
                                  handleUpdateOption(opt.id, { conditionalRules: updatedRules });
                                }}
                              >
                                ➕ Add Conditional Logic Rule
                              </button>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })()
              )}

            </div>

            {/* ----------------- CENTER PANEL: WYSIWYG CANVAS ----------------- */}
            <div className="center-panel">
              {/* Canvas controls toolbar */}
              <div style={{
                position: "absolute",
                top: "16px",
                display: "flex",
                gap: "14px",
                background: "#ffffff",
                padding: "8px 16px",
                borderRadius: "24px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                zIndex: 10,
                alignItems: "center"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="checkbox"
                    id="grid-markers-toggle"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                  />
                  <label htmlFor="grid-markers-toggle" style={{ fontSize: "12px", fontWeight: 600 }}>Show Alignment Grid</label>
                </div>
                
                <span style={{ color: "#e1e3e5" }}>|</span>
                
                <span style={{ fontSize: "12px", color: "#6d7175" }}>
                  Status: <strong style={{ color: "#008060" }}>Edit Mode</strong>
                </span>
              </div>

              <div style={{ position: "relative" }}>
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                  style={{
                    border: "1px solid #babfc3",
                    borderRadius: "8px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                    background: "#ffffff",
                    cursor: dragState.isDragging ? "grabbing" : dragState.isResizing ? "nwse-resize" : dragState.isRotating ? "crosshair" : "default"
                  }}
                />

                {/* Floating Coordinates Badge */}
                {activeLayerId && (() => {
                  const opt = options.find(o => o.id === activeLayerId);
                  if (!opt || !isOptionVisible(opt)) return null;
                  return (
                    <div className="coordinates-badge">
                      X: {opt.canvasX} | Y: {opt.canvasY} | Rotation: {opt.canvasRotation}° {opt.canvasWidth && `| W: ${opt.canvasWidth} H: ${opt.canvasHeight}`}
                    </div>
                  );
                })()}
              </div>

              <div style={{ marginTop: "16px", textAlign: "center", fontSize: "12px", color: "#6d7175" }}>
                💡 Click any canvas layer to select, drag to position, drag corners to resize, and top node to rotate!
              </div>
            </div>

            {/* ----------------- RIGHT PANEL: SHOPPER PREVIEW ----------------- */}
            <div className="right-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e1e3e5", paddingBottom: "12px" }}>
                <span style={{ fontWeight: 700, fontSize: "14px" }}>🛍️ Shopper Form Preview</span>
                <span className="upcharge-badge">
                  + ${calculateTotalUpcharges().toFixed(2)} Upcharge
                </span>
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                {options.map((opt) => {
                  if (!isOptionVisible(opt)) return null;

                  return (
                    <div key={opt.id} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <label style={{ fontSize: "13px", fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
                        <span>
                          {opt.label} {opt.required && <span style={{ color: "#d82c0d" }}>*</span>}
                        </span>
                        {opt.priceUpcharge > 0 && (
                          <span style={{ color: "#008060", fontSize: "11px" }}>(+${opt.priceUpcharge.toFixed(2)})</span>
                        )}
                      </label>

                      {opt.type === "text" && (
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            maxLength={opt.maxChars}
                            placeholder={opt.placeholder || "Enter engraving text..."}
                            className="search-input"
                            style={{ padding: "8px 12px" }}
                            value={shopperValues[opt.id] || ""}
                            onChange={(e) => handleShopperValueChange(opt.id, e.target.value)}
                          />
                          {opt.maxChars && (
                            <span style={{ fontSize: "10px", color: "#8c9196", position: "absolute", right: "10px", bottom: "-14px" }}>
                              {opt.maxChars - String(shopperValues[opt.id] || "").length} characters left
                            </span>
                          )}
                        </div>
                      )}

                      {opt.type === "textarea" && (
                        <div>
                          <textarea
                            maxLength={opt.maxChars}
                            placeholder={opt.placeholder || "Enter special instructions..."}
                            className="search-input"
                            style={{ padding: "8px 12px", height: "60px" }}
                            value={shopperValues[opt.id] || ""}
                            onChange={(e) => handleShopperValueChange(opt.id, e.target.value)}
                          />
                        </div>
                      )}

                      {opt.type === "select" && (
                        <select
                          className="filter-select"
                          style={{ width: "100%" }}
                          value={shopperValues[opt.id] || ""}
                          onChange={(e) => handleShopperValueChange(opt.id, e.target.value)}
                        >
                          <option value="">Choose option...</option>
                          {opt.choices?.split(",").map(c => (
                            <option key={c.trim()} value={c.trim()}>{c.trim()}</option>
                          ))}
                        </select>
                      )}

                      {opt.type === "swatch" && (
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                          {opt.choices?.split(",").map(colorHex => {
                            const cleanHex = colorHex.trim();
                            const isActive = shopperValues[opt.id] === cleanHex;
                            return (
                              <span
                                key={cleanHex}
                                className={`swatch-circle ${isActive ? "active" : ""}`}
                                style={{ backgroundColor: cleanHex }}
                                onClick={() => handleShopperValueChange(opt.id, cleanHex)}
                              />
                            );
                          })}
                        </div>
                      )}

                      {opt.type === "file" && (
                        <div style={{
                          border: "1px dashed #babfc3",
                          padding: "16px",
                          borderRadius: "6px",
                          textAlign: "center",
                          background: "#f9fafb"
                        }}>
                          <input
                            type="file"
                            style={{ display: "none" }}
                            id={`file-sh-${opt.id}`}
                            onChange={() => handleShopperValueChange(opt.id, "uploaded_file_mock")}
                          />
                          <label
                            htmlFor={`file-sh-${opt.id}`}
                            style={{ color: "#006e52", fontWeight: 600, cursor: "pointer", fontSize: "12px" }}
                          >
                            {shopperValues[opt.id] ? "✓ File selected (Click to replace)" : "📁 Choose File Upload"}
                          </label>
                        </div>
                      )}

                      {opt.type === "checkbox" && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                          <input
                            type="checkbox"
                            id={`chk-sh-${opt.id}`}
                            checked={!!shopperValues[opt.id]}
                            onChange={(e) => handleShopperValueChange(opt.id, e.target.checked)}
                          />
                          <label htmlFor={`chk-sh-${opt.id}`} style={{ fontSize: "13px", cursor: "pointer" }}>
                            Yes, I want this option!
                          </label>
                        </div>
                      )}

                      {opt.type === "clipart" && (
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {opt.choices?.split(",").map(clipartVal => {
                            const cleanVal = clipartVal.trim();
                            const isActive = shopperValues[opt.id] === cleanVal;
                            return (
                              <button
                                key={cleanVal}
                                className="btn-secondary"
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "11px",
                                  borderColor: isActive ? "#008060" : "#babfc3",
                                  background: isActive ? "#f0fbf7" : "#ffffff"
                                }}
                                onClick={() => handleShopperValueChange(opt.id, cleanVal)}
                              >
                                {cleanVal}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {opt.type === "font" && (
                        <select
                          className="filter-select"
                          style={{ width: "100%" }}
                          value={shopperValues[opt.id] || ""}
                          onChange={(e) => handleShopperValueChange(opt.id, e.target.value)}
                        >
                          <option value="Arial">Choose typography style...</option>
                          <option value="Arial">Arial</option>
                          <option value="Times New Roman">Times New Roman</option>
                          {fontAssets.map(f => (
                            <option key={f.id} value={f.name}>{f.name}</option>
                          ))}
                        </select>
                      )}

                      {opt.type === "number" && (
                        <input
                          type="number"
                          className="search-input"
                          style={{ padding: "8px" }}
                          placeholder="e.g. 5"
                          value={shopperValues[opt.id] || ""}
                          onChange={(e) => handleShopperValueChange(opt.id, e.target.value)}
                        />
                      )}

                      {opt.type === "info" && (
                        <div
                          style={{ fontSize: "11px", color: "#6d7175", padding: "8px", background: "#f6f6f7", borderRadius: "4px" }}
                          dangerouslySetInnerHTML={{ __html: opt.choices || "No instruction details provided." }}
                        />
                      )}

                      {opt.description && (
                        <span style={{ fontSize: "11px", color: "#6d7175", fontStyle: "italic" }}>
                          {opt.description}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add to Cart simulator */}
              <div style={{ borderTop: "1px solid #e1e3e5", paddingTop: "16px", marginTop: "auto" }}>
                <button
                  className="btn-primary"
                  style={{ width: "100%", height: "44px", justifyContent: "center", fontSize: "15px", background: "#008060" }}
                  onClick={() => shopify.toast.show("Customization validation successful! Adding mock item to shopper cart.")}
                >
                  🛒 Add to Cart Simulation
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ==========================================
          5. ADD PRODUCT OPTION MODAL (PRODUCT PICKER)
          ========================================== */}
      {isAddModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            
            <div className="modal-header">
              <h3>Add product</h3>
              <button className="modal-close" onClick={() => setIsAddModalOpen(false)}>×</button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: "13px", color: "#6d7175", margin: "0 0 16px 0" }}>
                Choose one of your active Shopify store products below.
              </p>

              {/* Search & scope picker inside modal */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                <div className="search-wrapper" style={{ flex: 2 }}>
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Search store catalog..."
                    className="search-input"
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                  />
                </div>
                
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#6d7175", whiteSpace: "nowrap" }}>Search by:</span>
                  <select
                    value={modalSearchBy}
                    onChange={(e) => setModalSearchBy(e.target.value)}
                    className="filter-select"
                    style={{ padding: "6px 10px", fontSize: "13px", minWidth: "120px" }}
                  >
                    <option value="all">All</option>
                    <option value="title">Product Title</option>
                    <option value="id">Product ID</option>
                    <option value="barcode">Barcode</option>
                    <option value="sku">SKU</option>
                  </select>
                  <button
                    className="btn-secondary"
                    style={{ padding: "6px 10px", fontSize: "12px" }}
                    onClick={() => shopify.toast.show("Custom query filter rules expanded")}
                  >
                    + Add filter
                  </button>
                </div>
              </div>

              {/* Product rows container */}
              <div style={{ maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                {pickerProducts.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px", color: "#8c9196" }}>
                    No unconfigured store products found matching current query.
                  </div>
                ) : (
                  pickerProducts.map((p: any) => {
                    const isSelected = modalSelectedProductId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setModalSelectedProductId(p.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "10px",
                          border: isSelected ? "2px solid #008060" : "1px solid #e1e3e5",
                          borderRadius: "8px",
                          background: isSelected ? "#f0fbf7" : "#ffffff",
                          cursor: "pointer",
                          transition: "all 0.15s"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          style={{ accentColor: "#008060", width: "16px", height: "16px", cursor: "pointer" }}
                        />
                        {p.featuredImage?.url ? (
                          <img src={p.featuredImage.url} alt="" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }} />
                        ) : (
                          <div style={{ width: "40px", height: "40px", background: "#f1f2f4", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>📦</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.title}
                          </div>
                          <div style={{ fontSize: "11px", color: "#6d7175" }}>
                            Vendor: {p.vendor}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="modal-footer">
              <span style={{ fontSize: "13px", fontWeight: 600 }}>
                {modalSelectedProductId ? "1 / 1 products selected" : "0 / 1 products selected"}
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setModalSelectedProductId(null);
                  }}
                  style={{ border: "1px solid #babfc3", color: "#6d7175", background: "#ffffff" }}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  disabled={!modalSelectedProductId}
                  onClick={handleAddSelectedProduct}
                  style={{
                    backgroundColor: modalSelectedProductId ? "#008060" : "#ebebeb",
                    color: modalSelectedProductId ? "#ffffff" : "#8c9196",
                    cursor: modalSelectedProductId ? "pointer" : "not-allowed",
                    border: "none",
                    padding: "8px 16px",
                    fontWeight: 600,
                    borderRadius: "6px"
                  }}
                >
                  Add
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );

  function handleShopperValueChange(optionId: string, value: any) {
    setShopperValues(prev => ({
      ...prev,
      [optionId]: value
    }));
  }
}
