import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { PersonalizationConfigSync } from "../utils/templateSync";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

// The GraphQL query to fetch store products for link selection
const PRODUCTS_QUERY = `#graphql
  query getProducts {
    products(first: 50) {
      edges {
        node {
          id
          title
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const templates = await db.template.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" }
  });

  const assets = await db.asset.findMany({
    where: { shop }
  });

  const response = await admin.graphql(PRODUCTS_QUERY);
  const responseJson = await response.json();
  const products = responseJson.data?.products?.edges?.map((e: any) => e.node) || [];

  return { templates, assets, products, shop };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "save_template") {
    const id = (formData.get("id") as string) || undefined;
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const optionsJson = formData.get("options") as string;
    const productLinksJson = formData.get("productLinks") as string;

    let productLinks: string[] = [];
    try {
      productLinks = JSON.parse(productLinksJson);
    } catch (e) {}

    try {
      const result = await PersonalizationConfigSync.syncTemplate(
        { admin, shop, db },
        { id, name, description, options: optionsJson },
        productLinks
      );

      const template = await db.template.findFirst({
        where: { id: result.templateId },
      });

      return { success: result.success, template, userErrors: result.errors };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  if (intent === "duplicate_template") {
    const id = formData.get("id") as string;
    const sourceTemplate = await db.template.findFirst({
      where: { id, shop }
    });
    if (!sourceTemplate) {
      return { error: "Source template not found" };
    }
    const duplicate = await db.template.create({
      data: {
        shop,
        name: `${sourceTemplate.name} Copy`,
        description: sourceTemplate.description,
        options: sourceTemplate.options,
        enabled: sourceTemplate.enabled
      }
    });
    return { success: true, template: duplicate };
  }

  if (intent === "link_products") {
    const templateId = formData.get("templateId") as string;
    const productLinksJson = formData.get("productLinks") as string;

    let productLinks: string[] = [];
    try {
      productLinks = JSON.parse(productLinksJson);
    } catch (e) {}

    try {
      const result = await PersonalizationConfigSync.syncTemplate(
        { admin, shop, db },
        { id: templateId },
        productLinks
      );
      return { success: result.success, userErrors: result.errors };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  if (intent === "delete_template") {
    const id = formData.get("id") as string;
    try {
      const result = await PersonalizationConfigSync.unsyncTemplate({ admin, shop, db }, id);
      return { success: result.success, deleted: id, userErrors: result.errors };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  return { error: "Unknown intent" };
};

interface ConditionalRule {
  fieldId: string;
  operator: "equals" | "not_equals" | "checked" | "unchecked";
  value: string;
}

interface CustomizationOption {
  id: string;
  type: "text" | "select" | "swatch" | "checkbox" | "file" | "clipart";
  label: string;
  required: boolean;
  priceUpcharge: number;
  defaultValue?: string;
  maxChars?: number;
  choices?: string; // Comma-separated or linked asset Set ID
  choicesType?: "custom" | "global"; // Whether it uses custom list or links to an AssetSet
  assetSetId?: string; // Links to global colors/options/images AssetSet
  conditionalRules?: ConditionalRule[];
  
  // Coordinate positioning attributes (Phase 3 parity features)
  canvasX?: number;
  canvasY?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  canvasRotation?: number;
  canvasFontSize?: number;
}

const BUILT_IN_TEMPLATES = [
  {
    id: "builtin-chronos",
    name: "Chronos C-200 Series",
    description: "Preset Watch Dial Monogram & Custom Leather Strap options layout.",
    tags: ["custom text", "color swatch", "+ 2 elements"],
    options: JSON.stringify({
      heading: "Custom Watch Monogram & Dial Engraving",
      layoutMode: "tabs",
      brandColor: "#008060",
      buttonColor: "#008060",
      buttonTextColor: "#ffffff",
      canvasW: 1000,
      canvasH: 1000,
      viewName: "Main View",
      viewBackground: "Blank Canvas",
      cartSettings: {
        generatePreview: true,
        previewSize: "Compressed",
        additionalFile: true,
        hideBackground: false,
        customCartLabel: false
      },
      options: [
        {
          id: "watch-face-text",
          type: "text",
          label: "Watch Dial Engraving Initials",
          required: true,
          priceUpcharge: 5.0,
          maxChars: 4,
          canvasX: 500,
          canvasY: 480,
          canvasFontSize: 50,
          canvasWidth: 400,
          canvasHeight: 150,
          canvasRotation: 0
        },
        {
          id: "watch-band-color",
          type: "swatch",
          label: "Leather Strap Color",
          required: true,
          priceUpcharge: 0,
          choices: "#000000, #3E2723, #1A237E"
        }
      ]
    })
  },
  {
    id: "builtin-neon",
    name: "Create Your Neon",
    description: "Custom Neon Glow Sign custom text and glow color picker layout.",
    tags: ["custom text", "color swatch", "+ 2 elements"],
    options: JSON.stringify({
      heading: "Build Your Custom Neon Glow Sign",
      layoutMode: "stacked",
      brandColor: "#008060",
      buttonColor: "#008060",
      buttonTextColor: "#ffffff",
      canvasW: 1000,
      canvasH: 1000,
      viewName: "Main View",
      viewBackground: "Blank Canvas",
      cartSettings: {
        generatePreview: true,
        previewSize: "Compressed",
        additionalFile: true,
        hideBackground: false,
        customCartLabel: false
      },
      options: [
        {
          id: "neon-glow-text",
          type: "text",
          label: "Neon Text Content",
          required: true,
          priceUpcharge: 10.0,
          maxChars: 15,
          canvasX: 500,
          canvasY: 500,
          canvasFontSize: 80,
          canvasWidth: 700,
          canvasHeight: 300,
          canvasRotation: 0
        },
        {
          id: "neon-glow-color",
          type: "swatch",
          label: "Glow Color Swatch",
          required: true,
          priceUpcharge: 0,
          choices: "#FF007F, #00FFFF, #39FF14, #FFD700"
        }
      ]
    })
  },
  {
    id: "builtin-pillow",
    name: "Monogram Pillow Layout",
    description: "High-impact pillow monogram layout with customizable font sizes.",
    tags: ["custom text", "+ 1 element"],
    options: JSON.stringify({
      heading: "Custom Monogram Pillow",
      layoutMode: "stacked",
      brandColor: "#008060",
      buttonColor: "#008060",
      buttonTextColor: "#ffffff",
      canvasW: 1000,
      canvasH: 1000,
      viewName: "Main View",
      viewBackground: "Blank Canvas",
      cartSettings: {
        generatePreview: true,
        previewSize: "Compressed",
        additionalFile: true,
        hideBackground: false,
        customCartLabel: false
      },
      options: [
        {
          id: "pillow-monogram-initials",
          type: "text",
          label: "Monogram Initials (3 letters)",
          required: true,
          priceUpcharge: 3.5,
          maxChars: 3,
          canvasX: 500,
          canvasY: 500,
          canvasFontSize: 120,
          canvasWidth: 400,
          canvasHeight: 400,
          canvasRotation: 0
        }
      ]
    })
  }
];

export default function TemplatesPanel() {
  const { templates, assets, products } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<any>();
  const shopify = useAppBridge();

  // Navigation and Layout modes
  const [activeTab, setActiveTab] = useState<"built_in" | "yours">("built_in");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Customizer Overlay Modal status
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  // Create Naming Modal status and form states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");
  const [newTemplateError, setNewTemplateError] = useState("");
  const [selectedStyleCard, setSelectedStyleCard] = useState<"watch" | "neon" | "pillow" | "generic">("generic");

  // Template Form Configuration States
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [heading, setHeading] = useState("Personalize Your Item");
  const [layoutMode, setLayoutMode] = useState<"stacked" | "tabs" | "modal">("stacked");
  const [brandColor, setBrandColor] = useState("#008060");
  const [buttonColor, setButtonColor] = useState("#008060");
  const [buttonTextColor, setButtonTextColor] = useState("#ffffff");
  const [options, setOptions] = useState<CustomizationOption[]>([]);
  
  // Customizer Canvas Spec Accordion Settings
  const [viewName, setViewName] = useState("Main View");
  const [viewBackground, setViewBackground] = useState("Blank Canvas");
  const [canvasW, setCanvasW] = useState(1000);
  const [canvasH, setCanvasH] = useState(1000);
  
  // Cart & Order Settings Accordion
  const [generatePreview, setGeneratePreview] = useState(true);
  const [previewSize, setPreviewSize] = useState("Compressed");
  const [additionalFile, setAdditionalFile] = useState(true);
  const [hideBackground, setHideBackground] = useState(false);
  const [customCartLabel, setCustomCartLabel] = useState(false);

  // Live Preview Settings
  const [livePreview, setLivePreview] = useState(true);

  // Product Linkage lists
  const [linkedProducts, setLinkedProducts] = useState<string[]>([]);
  const [initialLinkedProducts, setInitialLinkedProducts] = useState<string[]>([]);

  // Pagination for Your Templates
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Customizer Loading Skeleton Status
  const [customizerLoading, setCustomizerLoading] = useState(false);

  // Unsaved changes tracking (P0)
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const initialStateRef = useRef<string>("");

  // Element removal confirmation (P1)
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);

  // Canvas zoom (P2)
  const [canvasZoom, setCanvasZoom] = useState(100);

  // Element reordering drag state (P2)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Undo/Redo options history tracking states
  const [optionHistory, setOptionHistory] = useState<CustomizationOption[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const pushHistory = (newOptions: CustomizationOption[]) => {
    const updatedHistory = optionHistory.slice(0, historyIndex + 1);
    updatedHistory.push(JSON.parse(JSON.stringify(newOptions)));
    setOptionHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
  };

  // Compute current state snapshot for dirty tracking (P0)
  const getCurrentStateSnapshot = useCallback(() => {
    return JSON.stringify({
      templateName, templateDescription, heading, layoutMode,
      brandColor, buttonColor, buttonTextColor, viewName, viewBackground,
      canvasW, canvasH, generatePreview, previewSize, additionalFile,
      hideBackground, customCartLabel, options, linkedProducts
    });
  }, [templateName, templateDescription, heading, layoutMode, brandColor,
      buttonColor, buttonTextColor, viewName, viewBackground, canvasW, canvasH,
      generatePreview, previewSize, additionalFile, hideBackground,
      customCartLabel, options, linkedProducts]);

  const isDirty = isModalOpen && initialStateRef.current !== "" && getCurrentStateSnapshot() !== initialStateRef.current;

  // Safe close handler — checks for unsaved changes before closing (P0)
  const handleSafeClose = useCallback(() => {
    if (isDirty) {
      setIsCloseConfirmOpen(true);
    } else {
      setIsModalOpen(false);
      setCanvasZoom(100);
    }
  }, [isDirty]);

  const handleForceClose = () => {
    setIsCloseConfirmOpen(false);
    setIsModalOpen(false);
    setCanvasZoom(100);
  };

  // Element reorder handler (P2)
  const handleReorderOption = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const newOptions = [...options];
    const [moved] = newOptions.splice(fromIdx, 1);
    newOptions.splice(toIdx, 0, moved);
    setOptions(newOptions);
    pushHistory(newOptions);
    setDragOverIdx(null);
  };


  // Preview and Linker modal statuses
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkingTemplateId, setLinkingTemplateId] = useState<string | null>(null);

  // Canvas Interactivity states
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewText, setPreviewText] = useState("Jane");
  const [previewFont, setPreviewFont] = useState("Arial");
  const [previewColor, setPreviewColor] = useState("#000000");

  // Selection & dragging state variables
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    isResizing: boolean;
    resizeHandle: "nw" | "ne" | "sw" | "se" | null;
    startMouseX: number;
    startMouseY: number;
    startCanvasX: number;
    startCanvasY: number;
    startWidth: number;
    startHeight: number;
    startFontSize: number;
  }>({
    isDragging: false,
    isResizing: false,
    resizeHandle: null,
    startMouseX: 0,
    startMouseY: 0,
    startCanvasX: 0,
    startCanvasY: 0,
    startWidth: 250,
    startHeight: 250,
    startFontSize: 48
  });

  const fontAssets = assets.filter(a => a.type === "FONT" || a.type === "FONTS");
  const colorAssets = assets.filter(a => a.type === "COLOR" || a.type === "COLORS");
  const optionAssets = assets.filter(a => a.type === "OPTION" || a.type === "OPTIONS");
  const clipartAssets = assets.filter(a => a.type === "IMAGE" || a.type === "IMAGES");

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

  // Load selected template configurations
  useEffect(() => {
    if (selectedTemplate) {
      setTemplateName(selectedTemplate.name);
      setTemplateDescription(selectedTemplate.description || "");
      try {
        const config = JSON.parse(selectedTemplate.options);
        setHeading(config.heading || "Personalize Your Item");
        setLayoutMode(config.layoutMode || "stacked");
        setBrandColor(config.brandColor || "#008060");
        setButtonColor(config.buttonColor || "#008060");
        setButtonTextColor(config.buttonTextColor || "#ffffff");
        
        const loadedOptions = config.options || [];
        setOptions(loadedOptions);
        setOptionHistory([JSON.parse(JSON.stringify(loadedOptions))]);
        setHistoryIndex(0);
        
        setViewName(config.viewName || "Main View");
        setViewBackground(config.viewBackground || "Blank Canvas");
        setCanvasW(config.canvasW || 1000);
        setCanvasH(config.canvasH || 1000);

        if (config.cartSettings) {
          setGeneratePreview(config.cartSettings.generatePreview !== false);
          setPreviewSize(config.cartSettings.previewSize || "Compressed");
          setAdditionalFile(config.cartSettings.additionalFile !== false);
          setHideBackground(!!config.cartSettings.hideBackground);
          setCustomCartLabel(!!config.cartSettings.customCartLabel);
        } else {
          setGeneratePreview(true);
          setPreviewSize("Compressed");
          setAdditionalFile(true);
          setHideBackground(false);
          setCustomCartLabel(false);
        }

        // Find products linked to this template
        const linked: string[] = [];
        products.forEach((p: any) => {
          if (p.metafield?.value) {
            try {
              const pf = JSON.parse(p.metafield.value);
              if (pf.templateId === selectedTemplate.id) linked.push(p.id);
            } catch (e) {}
          }
        });
        setLinkedProducts(linked);
        setInitialLinkedProducts(linked);
      } catch (e) {
        setOptions([]);
        setLinkedProducts([]);
        setInitialLinkedProducts([]);
      }
    } else {
      // Clear for new template
      setTemplateName("New Customization Blueprint");
      setTemplateDescription("");
      setHeading("Personalize Your Item");
      setLayoutMode("stacked");
      setBrandColor("#008060");
      setButtonColor("#008060");
      setButtonTextColor("#ffffff");
      
      setViewName("Main View");
      setViewBackground("Blank Canvas");
      setCanvasW(1000);
      setCanvasH(1000);
      
      setGeneratePreview(true);
      setPreviewSize("Compressed");
      setAdditionalFile(true);
      setHideBackground(false);
      setCustomCartLabel(false);

      const defaultOptions: CustomizationOption[] = [
        {
          id: "opt-default-text",
          type: "text",
          label: "Engraving Custom Text",
          required: true,
          priceUpcharge: 0,
          maxChars: 30,
          canvasX: 500,
          canvasY: 500,
          canvasFontSize: 80,
          canvasWidth: 500,
          canvasHeight: 150,
          canvasRotation: 0
        }
      ];
      setOptions(defaultOptions);
      setOptionHistory([JSON.parse(JSON.stringify(defaultOptions))]);
      setHistoryIndex(0);
      setLinkedProducts([]);
      setInitialLinkedProducts([]);
    }
  }, [selectedTemplate, products]);

  // Load custom background image for canvas if any
  const [bgImageObj, setBgImageObj] = useState<HTMLImageElement | null>(null);
  const [bgImageLoading, setBgImageLoading] = useState(false);
  useEffect(() => {
    if (viewBackground && viewBackground !== "Blank Canvas") {
      setBgImageLoading(true);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = viewBackground;
      img.onload = () => {
        setBgImageObj(img);
        setBgImageLoading(false);
      };
      img.onerror = () => {
        setBgImageObj(null);
        setBgImageLoading(false);
      };
    } else {
      setBgImageObj(null);
      setBgImageLoading(false);
    }
  }, [viewBackground]);

  // WYSIWYG Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.getContext("2d");
    if (!cx) return;

    // We set logical dimensions from state
    canvas.width = canvasW;
    canvas.height = canvasH;

    cx.clearRect(0, 0, canvas.width, canvas.height);

    if (bgImageObj) {
      cx.drawImage(bgImageObj, 0, 0, canvas.width, canvas.height);
    } else {
      cx.fillStyle = "#ffffff";
      cx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (bgImageLoading) {
      cx.fillStyle = "rgba(240, 240, 240, 0.8)";
      cx.fillRect(0, 0, canvas.width, canvas.height);
      cx.fillStyle = "#6d7175";
      cx.font = "bold 28px sans-serif";
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.fillText("Loading background image...", canvas.width / 2, canvas.height / 2);
    }

    if (livePreview) {
      // Draw grid helper if no image or user wants alignment support
      cx.strokeStyle = "rgba(0,128,96,0.1)";
      cx.lineWidth = 2;
      cx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

      // Draw dotted alignment grid
      cx.save();
      cx.strokeStyle = "rgba(0, 128, 96, 0.08)";
      cx.lineWidth = 1;
      cx.setLineDash([5, 5]);
      for (let x = 100; x < canvas.width; x += 100) {
        cx.beginPath();
        cx.moveTo(x, 0);
        cx.lineTo(x, canvas.height);
        cx.stroke();
      }
      for (let y = 100; y < canvas.height; y += 100) {
        cx.beginPath();
        cx.moveTo(0, y);
        cx.lineTo(canvas.width, y);
        cx.stroke();
      }
      cx.restore();

      options.forEach(opt => {
        cx.save();
        
        const x = opt.canvasX ?? 500;
        const y = opt.canvasY ?? 500;
        cx.translate(x, y);

        if (opt.canvasRotation) {
          cx.rotate((opt.canvasRotation * Math.PI) / 180);
        }

        let renderW = 0;
        let renderH = 0;

        if (opt.type === "text") {
          cx.fillStyle = opt.id === "opt-default-text" ? previewColor : "#1a1a1a";
          cx.textAlign = "center";
          cx.textBaseline = "middle";
          const fontSize = opt.canvasFontSize ?? 80;
          cx.font = `bold ${fontSize}px "${opt.id === "opt-default-text" ? previewFont : "Arial"}", Arial, sans-serif`;
          
          const textVal = opt.id === "opt-default-text" ? (previewText || opt.label || "Custom Text") : (opt.label || "Custom Text");
          cx.fillText(textVal, 0, 0);

          renderW = fontSize * textVal.length * 0.5;
          renderH = fontSize;
        } else if (opt.type === "clipart") {
          cx.fillStyle = "rgba(0, 128, 96, 0.08)";
          cx.strokeStyle = "#008060";
          cx.lineWidth = 3;
          renderW = opt.canvasWidth ?? 250;
          renderH = opt.canvasHeight ?? 250;
          cx.fillRect(-renderW/2, -renderH/2, renderW, renderH);
          cx.strokeRect(-renderW/2, -renderH/2, renderW, renderH);
          
          cx.fillStyle = "#008060";
          cx.font = "bold 20px Arial";
          cx.textAlign = "center";
          cx.textBaseline = "middle";
          cx.fillText(`🖼️ Clipart: ${opt.label}`, 0, 0);
        } else if (opt.type === "file") {
          cx.fillStyle = "rgba(44, 62, 80, 0.08)";
          cx.strokeStyle = "#2c3e50";
          cx.lineWidth = 3;
          renderW = opt.canvasWidth ?? 250;
          renderH = opt.canvasHeight ?? 250;
          cx.fillRect(-renderW/2, -renderH/2, renderW, renderH);
          cx.strokeRect(-renderW/2, -renderH/2, renderW, renderH);
          
          cx.fillStyle = "#2c3e50";
          cx.font = "bold 20px Arial";
          cx.textAlign = "center";
          cx.textBaseline = "middle";
          cx.fillText(`📸 Upload: ${opt.label}`, 0, 0);
        }

        // Selected outline bounding bounds
        if (opt.id === selectedOptionId) {
          cx.strokeStyle = "#008060";
          cx.lineWidth = 3;
          cx.setLineDash([8, 8]);
          cx.strokeRect(-renderW/2 - 10, -renderH/2 - 10, renderW + 20, renderH + 20);
          cx.setLineDash([]);

          // Draw Drag & Resize placement tooltip badge
          cx.save();
          cx.fillStyle = "#008060";
          const tooltipW = 150;
          const tooltipH = 26;
          const tooltipX = -tooltipW / 2;
          const tooltipY = -renderH / 2 - 45;
          if (cx.roundRect) {
            cx.beginPath();
            cx.roundRect(tooltipX, tooltipY, tooltipW, tooltipH, 4);
            cx.fill();
          } else {
            cx.fillRect(tooltipX, tooltipY, tooltipW, tooltipH);
          }
          cx.fillStyle = "#ffffff";
          cx.font = "bold 11px sans-serif";
          cx.textAlign = "center";
          cx.textBaseline = "middle";
          cx.fillText("Drag & Resize to Place", 0, tooltipY + tooltipH / 2);
          cx.restore();

          // Resize handles
          cx.fillStyle = "#ffffff";
          cx.strokeStyle = "#008060";
          cx.lineWidth = 2.5;
          const handleSize = 14;
          const corners = [
            { x: -renderW/2 - 10, y: -renderH/2 - 10 },
            { x: renderW/2 + 10, y: -renderH/2 - 10 },
            { x: -renderW/2 - 10, y: renderH/2 + 10 },
            { x: renderW/2 + 10, y: renderH/2 + 10 }
          ];
          corners.forEach(corner => {
            cx.fillRect(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
            cx.strokeRect(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
          });
        }

        cx.restore();
      });
    }

    // Indicator tag
    cx.fillStyle = "#6d7175";
    cx.font = "bold 14px monospace";
    cx.textAlign = "right";
    cx.fillText(`${canvasW}x${canvasH}px logical viewport`, canvas.width - 20, canvas.height - 20);
  }, [previewText, previewFont, previewColor, options, selectedOptionId, canvasW, canvasH, livePreview, bgImageObj, bgImageLoading]);

  // Handle toast notifications upon actions completion
  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.deleted) {
        shopify.toast.show("Template blueprint deleted successfully.");
      } else if (fetcher.data.template) {
        shopify.toast.show("Template is saved! Redirecting to template configure page.");
        setIsModalOpen(false);
      } else {
        shopify.toast.show("Action completed successfully!");
      }
    } else if (fetcher.data?.error) {
      shopify.toast.show(`Error: ${fetcher.data.error}`);
    }
  }, [fetcher.data, shopify]);

  // Keyboard shortcuts for the Customizer (P1)
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = tag === "input" || tag === "textarea" || tag === "select";
      const isMeta = e.metaKey || e.ctrlKey;

      // Ctrl+S / Cmd+S → Save
      if (isMeta && e.key === "s") {
        e.preventDefault();
        handleSaveTemplate();
        return;
      }

      // Ctrl+Z / Cmd+Z → Undo (without Shift)
      if (isMeta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl+Shift+Z / Ctrl+Y → Redo
      if ((isMeta && e.key === "z" && e.shiftKey) || (isMeta && e.key === "y")) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Escape → Close with dirty check
      if (e.key === "Escape" && !isInput) {
        e.preventDefault();
        // Don't close if a sub-modal is open
        if (!isLinkModalOpen && !isPreviewModalOpen && !isCloseConfirmOpen) {
          handleSafeClose();
        } else if (isCloseConfirmOpen) {
          setIsCloseConfirmOpen(false);
        }
        return;
      }

      // Delete/Backspace → Remove selected element (only when not in an input)
      if ((e.key === "Delete" || e.key === "Backspace") && !isInput && selectedOptionId) {
        e.preventDefault();
        setPendingRemoveId(selectedOptionId);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, isLinkModalOpen, isPreviewModalOpen, isCloseConfirmOpen, selectedOptionId, handleSafeClose]);


  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasMousePos(e);

    if (selectedOptionId) {
      const opt = options.find(o => o.id === selectedOptionId);
      if (opt) {
        const textVal = opt.id === "opt-default-text" ? previewText : opt.label;
        const w = opt.type === "text" ? ((opt.canvasFontSize ?? 80) * textVal.length * 0.5) : (opt.canvasWidth ?? 250);
        const h = opt.type === "text" ? (opt.canvasFontSize ?? 80) : (opt.canvasHeight ?? 250);
        
        const cxVal = opt.canvasX ?? 500;
        const cyVal = opt.canvasY ?? 500;

        const left = cxVal - w/2;
        const right = cxVal + w/2;
        const top = cyVal - h/2;
        const bottom = cyVal + h/2;

        const threshold = 40;

        let handle: "nw" | "ne" | "sw" | "se" | null = null;
        if (Math.abs(x - left) < threshold && Math.abs(y - top) < threshold) handle = "nw";
        else if (Math.abs(x - right) < threshold && Math.abs(y - top) < threshold) handle = "ne";
        else if (Math.abs(x - left) < threshold && Math.abs(y - bottom) < threshold) handle = "sw";
        else if (Math.abs(x - right) < threshold && Math.abs(y - bottom) < threshold) handle = "se";

        if (handle) {
          setDragState({
            isDragging: false,
            isResizing: true,
            resizeHandle: handle,
            startMouseX: x,
            startMouseY: y,
            startCanvasX: cxVal,
            startCanvasY: cyVal,
            startWidth: opt.canvasWidth ?? 250,
            startHeight: opt.canvasHeight ?? 250,
            startFontSize: opt.canvasFontSize ?? 80
          });
          return;
        }
      }
    }

    for (let i = options.length - 1; i >= 0; i--) {
      const opt = options[i];
      const textVal = opt.id === "opt-default-text" ? previewText : opt.label;
      const w = opt.type === "text" ? ((opt.canvasFontSize ?? 80) * textVal.length * 0.5) : (opt.canvasWidth ?? 250);
      const h = opt.type === "text" ? (opt.canvasFontSize ?? 80) : (opt.canvasHeight ?? 250);
      
      const cxVal = opt.canvasX ?? 500;
      const cyVal = opt.canvasY ?? 500;

      if (
        x >= cxVal - w/2 &&
        x <= cxVal + w/2 &&
        y >= cyVal - h/2 &&
        y <= cyVal + h/2
      ) {
        setSelectedOptionId(opt.id);
        setDragState({
          isDragging: true,
          isResizing: false,
          resizeHandle: null,
          startMouseX: x,
          startMouseY: y,
          startCanvasX: cxVal,
          startCanvasY: cyVal,
          startWidth: opt.canvasWidth ?? 250,
          startHeight: opt.canvasHeight ?? 250,
          startFontSize: opt.canvasFontSize ?? 80
        });
        return;
      }
    }

    setSelectedOptionId(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState.isDragging && !dragState.isResizing) return;
    const { x, y } = getCanvasMousePos(e);

    const opt = options.find(o => o.id === selectedOptionId);
    if (!opt) return;

    const dx = x - dragState.startMouseX;
    const dy = y - dragState.startMouseY;

    if (dragState.isDragging) {
      handleUpdateOption(opt.id, {
        canvasX: Math.round(dragState.startCanvasX + dx),
        canvasY: Math.round(dragState.startCanvasY + dy)
      });
    } else if (dragState.isResizing && dragState.resizeHandle) {
      const handle = dragState.resizeHandle;
      if (opt.type === "text") {
        const sizeDelta = Math.round(dy * (handle.startsWith("s") ? 1 : -1));
        const newFontSize = Math.max(12, dragState.startFontSize + sizeDelta);
        handleUpdateOption(opt.id, {
          canvasFontSize: newFontSize
        });
      } else {
        const wFactor = handle.endsWith("e") ? 1 : -1;
        const hFactor = handle.startsWith("s") ? 1 : -1;
        
        const newWidth = Math.max(40, dragState.startWidth + Math.round(dx * wFactor));
        const newHeight = Math.max(40, dragState.startHeight + Math.round(dy * hFactor));
        
        handleUpdateOption(opt.id, {
          canvasWidth: newWidth,
          canvasHeight: newHeight
        });
      }
    }
  };

  const handleCanvasMouseUp = () => {
    if (dragState.isDragging || dragState.isResizing) {
      pushHistory(options);
    }
    setDragState(prev => ({ ...prev, isDragging: false, isResizing: false, resizeHandle: null }));
  };

  const handleAddOption = () => {
    const newId = `opt-${Date.now()}`;
    const newOptions: CustomizationOption[] = [
      ...options,
      {
        id: newId,
        type: "text",
        label: "Custom Choice Field",
        required: false,
        priceUpcharge: 0,
        maxChars: 30,
        canvasX: 500,
        canvasY: 500,
        canvasFontSize: 60,
        canvasWidth: 300,
        canvasHeight: 150,
        canvasRotation: 0
      }
    ];
    setOptions(newOptions);
    setSelectedOptionId(newId);
    pushHistory(newOptions);
  };

  const handleRemoveOption = (id: string) => {
    const newOptions = options.filter(o => o.id !== id);
    setOptions(newOptions);
    if (selectedOptionId === id) setSelectedOptionId(null);
    pushHistory(newOptions);
  };

  const handleUpdateOption = (id: string, updates: Partial<CustomizationOption>) => {
    const newOptions = options.map(o => {
      if (o.id === id) {
        const u = { ...o, ...updates };
        if (updates.type && updates.type !== o.type) {
          if (u.type === "text") {
            u.maxChars = 30;
            u.canvasX = 500;
            u.canvasY = 500;
            u.canvasFontSize = 80;
          } else if (u.type === "select" || u.type === "swatch") {
            u.choicesType = "custom";
            u.choices = "Option X, Option Y";
          } else if (u.type === "clipart" || u.type === "file") {
            u.canvasX = 500;
            u.canvasY = 500;
            u.canvasWidth = 300;
            u.canvasHeight = 300;
            u.canvasRotation = 0;
          }
        }
        return u;
      }
      return o;
    });
    setOptions(newOptions);
  };

  const handleUpdateOptionAndPush = (id: string, updates: Partial<CustomizationOption>) => {
    const newOptions = options.map(o => {
      if (o.id === id) {
        const u = { ...o, ...updates };
        if (updates.type && updates.type !== o.type) {
          if (u.type === "text") {
            u.maxChars = 30;
            u.canvasX = 500;
            u.canvasY = 500;
            u.canvasFontSize = 80;
          } else if (u.type === "select" || u.type === "swatch") {
            u.choicesType = "custom";
            u.choices = "Option X, Option Y";
          } else if (u.type === "clipart" || u.type === "file") {
            u.canvasX = 500;
            u.canvasY = 500;
            u.canvasWidth = 300;
            u.canvasHeight = 300;
            u.canvasRotation = 0;
          }
        }
        return u;
      }
      return o;
    });
    setOptions(newOptions);
    pushHistory(newOptions);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setOptions(JSON.parse(JSON.stringify(optionHistory[prevIndex])));
      setSelectedOptionId(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < optionHistory.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setOptions(JSON.parse(JSON.stringify(optionHistory[nextIndex])));
      setSelectedOptionId(null);
    }
  };

  const handleConfirmCreateTemplate = () => {
    let defaultName = "";
    let defaultDesc = "";

    if (selectedStyleCard === "watch") {
      defaultName = "New Watch Preset Template";
      defaultDesc = "Monogram engraving and strap options preset config.";
    } else if (selectedStyleCard === "neon") {
      defaultName = "New Neon Sign Template";
      defaultDesc = "Dynamic glow sign preset config.";
    } else if (selectedStyleCard === "pillow") {
      defaultName = "New Custom Monogram Pillow Template";
      defaultDesc = "Large text initials centerpiece preset config.";
    } else {
      defaultName = "New Custom Template";
      defaultDesc = "A fresh blank custom template configuration.";
    }

    setTemplateName(defaultName);
    setTemplateDescription(defaultDesc);
    
    let activePreset: CustomizationOption[] = [];

    if (selectedStyleCard === "watch") {
      setHeading("Custom Watch Monogram & Dial Engraving");
      setLayoutMode("tabs");
      setCanvasW(1000);
      setCanvasH(1000);
      setViewBackground("Blank Canvas");
      activePreset = [
        {
          id: "watch-face-text",
          type: "text",
          label: "Watch Dial Engraving Initials",
          required: true,
          priceUpcharge: 5.0,
          maxChars: 4,
          canvasX: 500,
          canvasY: 480,
          canvasFontSize: 50,
          canvasWidth: 400,
          canvasHeight: 150,
          canvasRotation: 0
        },
        {
          id: "watch-band-color",
          type: "swatch",
          label: "Leather Strap Color",
          required: true,
          priceUpcharge: 0,
          choices: "#000000, #3E2723, #1A237E"
        }
      ];
    } else if (selectedStyleCard === "neon") {
      setHeading("Build Your Custom Neon Glow Sign");
      setLayoutMode("stacked");
      setCanvasW(1000);
      setCanvasH(1000);
      setViewBackground("Blank Canvas");
      activePreset = [
        {
          id: "neon-glow-text",
          type: "text",
          label: "Neon Text Content",
          required: true,
          priceUpcharge: 10.0,
          maxChars: 15,
          canvasX: 500,
          canvasY: 500,
          canvasFontSize: 80,
          canvasWidth: 700,
          canvasHeight: 300,
          canvasRotation: 0
        },
        {
          id: "neon-glow-color",
          type: "swatch",
          label: "Glow Color Swatch",
          required: true,
          priceUpcharge: 0,
          choices: "#FF007F, #00FFFF, #39FF14, #FFD700"
        }
      ];
    } else if (selectedStyleCard === "pillow") {
      setHeading("Custom Monogram Pillow");
      setLayoutMode("stacked");
      setCanvasW(1000);
      setCanvasH(1000);
      setViewBackground("Blank Canvas");
      activePreset = [
        {
          id: "pillow-monogram-initials",
          type: "text",
          label: "Monogram Initials (3 letters)",
          required: true,
          priceUpcharge: 3.5,
          maxChars: 3,
          canvasX: 500,
          canvasY: 500,
          canvasFontSize: 120,
          canvasWidth: 400,
          canvasHeight: 400,
          canvasRotation: 0
        }
      ];
    } else {
      setHeading("Personalize Your Item");
      setLayoutMode("stacked");
      setCanvasW(1000);
      setCanvasH(1000);
      setViewBackground("Blank Canvas");
      activePreset = [
        {
          id: "opt-default-text",
          type: "text",
          label: "Engraving Custom Text",
          required: true,
          priceUpcharge: 0,
          maxChars: 30,
          canvasX: 500,
          canvasY: 500,
          canvasFontSize: 80,
          canvasWidth: 500,
          canvasHeight: 150,
          canvasRotation: 0
        }
      ];
    }

    setOptions(activePreset);
    setOptionHistory([JSON.parse(JSON.stringify(activePreset))]);
    setHistoryIndex(0);

    setLinkedProducts([]);
    setInitialLinkedProducts([]);
    setSelectedTemplate(null);
    setIsCreateModalOpen(false);

    setIsModalOpen(true);
    setCustomizerLoading(true);
    setCanvasZoom(100);
    setTimeout(() => {
      setCustomizerLoading(false);
      // Capture initial state snapshot for dirty tracking after state has settled
      setTimeout(() => { initialStateRef.current = getCurrentStateSnapshot(); }, 50);
    }, 800);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      shopify.toast.show("Please enter a template name");
      return;
    }

    const payload = {
      heading,
      layoutMode,
      brandColor,
      buttonColor,
      buttonTextColor,
      viewName,
      viewBackground,
      canvasW,
      canvasH,
      cartSettings: {
        generatePreview,
        previewSize,
        additionalFile,
        hideBackground,
        customCartLabel
      },
      options
    };

    // Calculate which products to unlink
    const unlinked = initialLinkedProducts.filter(id => !linkedProducts.includes(id));

    fetcher.submit(
      {
        intent: "save_template",
        id: selectedTemplate?.id || "",
        name: templateName,
        description: templateDescription,
        options: JSON.stringify(payload),
        productLinks: JSON.stringify(linkedProducts),
        unlinkedProducts: JSON.stringify(unlinked)
      },
      { method: "POST" }
    );
  };

  const handleDeleteTemplate = (id: string, linkedPIds: string[]) => {
    if (confirm("Delete this template? Linked products will have their personalization options removed.")) {
      fetcher.submit(
        {
          intent: "delete_template",
          id,
          linkedProducts: JSON.stringify(linkedPIds)
        },
        { method: "POST" }
      );
    }
  };

  const handleDuplicateTemplate = (id: string) => {
    if (confirm("Duplicate this template? This will create a copy of the template configuration.")) {
      fetcher.submit(
        {
          intent: "duplicate_template",
          id
        },
        { method: "POST" }
      );
    }
  };

  const handleDuplicateBuiltIn = (builtin: any) => {
    if (confirm(`Duplicate "${builtin.name}" to your templates?`)) {
      fetcher.submit(
        {
          intent: "save_template",
          id: "",
          name: `${builtin.name} Copy`,
          description: builtin.description,
          options: builtin.options,
          productLinks: JSON.stringify([]),
          unlinkedProducts: JSON.stringify([])
        },
        { method: "POST" }
      );
    }
  };

  const handleOpenLinkModal = (templateId: string) => {
    setLinkingTemplateId(templateId);
    
    // Find already linked products
    const linked: string[] = [];
    products.forEach((p: any) => {
      if (p.metafield?.value) {
        try {
          const pf = JSON.parse(p.metafield.value);
          if (pf.templateId === templateId) linked.push(p.id);
        } catch (e) {}
      }
    });
    
    setLinkedProducts(linked);
    setInitialLinkedProducts(linked);
    setIsLinkModalOpen(true);
  };

  const handleSaveProductLinks = () => {
    if (!linkingTemplateId) return;

    const unlinked = initialLinkedProducts.filter(id => !linkedProducts.includes(id));

    // If it's a built-in virtual template, we need to create it in DB first!
    const builtin = BUILT_IN_TEMPLATES.find(b => b.id === linkingTemplateId);
    if (builtin) {
      fetcher.submit(
        {
          intent: "save_template",
          id: "",
          name: builtin.name,
          description: builtin.description,
          options: builtin.options,
          productLinks: JSON.stringify(linkedProducts),
          unlinkedProducts: JSON.stringify([])
        },
        { method: "POST" }
      );
    } else {
      fetcher.submit(
        {
          intent: "link_products",
          templateId: linkingTemplateId,
          productLinks: JSON.stringify(linkedProducts),
          unlinkedProducts: JSON.stringify(unlinked)
        },
        { method: "POST" }
      );
    }
    setIsLinkModalOpen(false);
  };

  const toggleProductLink = (id: string) => {
    if (linkedProducts.includes(id)) {
      setLinkedProducts(linkedProducts.filter(pId => pId !== id));
    } else {
      setLinkedProducts([...linkedProducts, id]);
    }
  };

  // Searching and Filtering
  const filteredTemplates = templates.filter((t: any) => {
    const s = searchTerm.toLowerCase();
    return t.name.toLowerCase().includes(s) || (t.description && t.description.toLowerCase().includes(s));
  });

  const filteredBuiltIn = BUILT_IN_TEMPLATES.filter(b => {
    const s = searchTerm.toLowerCase();
    return b.name.toLowerCase().includes(s) || b.description.toLowerCase().includes(s);
  });

  // Pagination Math
  const totalItems = filteredTemplates.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedTemplates = filteredTemplates.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Compute option priceupcharges
  const optionPriceSum = options.reduce((sum, opt) => sum + (opt.priceUpcharge || 0), 0);

  return (
    <s-page heading="Templates">
      
      {/* Visual styling override */}
      <style>{`
        /* Premium custom design elements */
        .templates-tab-container {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #ebebeb;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
          overflow: hidden;
          margin-top: 20px;
        }
        
        .templates-tab-bar {
          display: flex;
          background: #fafafa;
          border-bottom: 1px solid #ebebeb;
          padding: 0 16px;
        }

        .templates-tab-item {
          padding: 14px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #6d7175;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          transition: all 0.2s ease;
        }

        .templates-tab-item:hover {
          color: #000000;
        }

        .templates-tab-item.active {
          color: #008060;
          border-bottom-color: #008060;
        }

        .search-and-filters {
          padding: 16px;
          display: flex;
          gap: 12px;
          align-items: center;
          border-bottom: 1px solid #ebebeb;
        }

        .search-field-wrapper {
          position: relative;
          flex: 1;
        }

        .search-field-input {
          width: 100%;
          padding: 8px 12px 8px 36px;
          border: 1px solid #babfc3;
          border-radius: 6px;
          font-size: 14px;
          outline: none;
          background: #ffffff;
        }

        .search-field-input:focus {
          border-color: #008060;
          box-shadow: 0 0 0 2px rgba(0, 128, 96, 0.15);
        }

        .search-field-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #8c9196;
        }

        .template-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .template-table th {
          background: #fafafa;
          padding: 14px 16px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          color: #6d7175;
          border-bottom: 1px solid #ebebeb;
        }

        .template-table td {
          padding: 16px;
          font-size: 14px;
          border-bottom: 1px solid #f3f3f3;
          vertical-align: middle;
        }

        .template-table tr:hover td {
          background-color: #fcfcfc;
        }

        .badge-tag {
          display: inline-block;
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 12px;
          margin-right: 6px;
          background-color: #f1f2f4;
          color: #2c3e50;
          border: 1px solid #e1e3e6;
        }

        .action-icon-btn {
          background: none;
          border: none;
          padding: 6px;
          color: #6d7175;
          cursor: pointer;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .action-icon-btn:hover {
          color: #000;
          background: #f1f2f4;
        }

        .action-icon-btn.danger:hover {
          color: #d93838;
          background: #fde8e8;
        }

        .btn-text-action {
          background: none;
          border: none;
          color: #008060;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
          padding: 6px 10px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .btn-text-action:hover {
          background: rgba(0, 128, 96, 0.08);
        }

        /* Overlay blocker modal styles */
        .customizer-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeInOverlay 0.2s ease-out;
        }

        @keyframes fadeInOverlay {
          from { opacity: 0; } to { opacity: 1; }
        }

        .customizer-card {
          width: 90vw;
          height: 90vh;
          background: #ffffff;
          border-radius: 14px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUpCard 0.25s cubic-bezier(0.1, 0.8, 0.3, 1);
        }

        @keyframes slideUpCard {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .customizer-header {
          padding: 16px 24px;
          border-bottom: 1px solid #e1e3e5;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }

        .customizer-header h2 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #202223;
        }

        .customizer-pane {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .customizer-sidebar {
          width: 360px;
          border-right: 1px solid #ebebeb;
          display: flex;
          flex-direction: column;
          background: #ffffff;
        }

        .customizer-main {
          flex: 1;
          background: #f4f5f6;
          background-image: radial-gradient(#e3e4e6 1px, transparent 1px);
          background-size: 20px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow-y: auto;
        }

        .customizer-subtabs {
          display: flex;
          background: #f1f2f4;
          border-bottom: 1px solid #ebebeb;
          padding: 4px 12px;
        }

        .customizer-subtab {
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 600;
          color: #6d7175;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .customizer-subtab.active {
          color: #000;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        /* Custom Accordion Styling */
        .sidebar-accordion {
          border-bottom: 1px solid #ebebeb;
        }

        .sidebar-accordion summary {
          padding: 14px 16px;
          font-size: 13px;
          font-weight: 700;
          color: #2c3e50;
          cursor: pointer;
          list-style: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
          user-select: none;
          background: #ffffff;
        }

        .sidebar-accordion summary::-webkit-details-marker {
          display: none;
        }

        .sidebar-accordion summary::after {
          content: "➔";
          font-size: 10px;
          color: #8c9196;
          transition: transform 0.2s ease;
        }

        .sidebar-accordion[open] summary::after {
          transform: rotate(90deg);
        }

        .accordion-content {
          padding: 0 16px 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #ffffff;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .input-group label {
          font-size: 11px;
          font-weight: 600;
          color: #6d7175;
          text-transform: uppercase;
        }

        .custom-input {
          padding: 8px;
          border: 1px solid #babfc3;
          border-radius: 6px;
          font-size: 13px;
          background: #ffffff;
          outline: none;
        }

        .custom-input:focus {
          border-color: #008060;
          box-shadow: 0 0 0 2px rgba(0, 128, 96, 0.1);
        }

        .toggle-switch-wrapper {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
        }

        .toggle-switch-label {
          font-size: 12px;
          font-weight: 500;
          color: #1a1a1a;
        }

        /* Toggle checkbox slider */
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 38px;
          height: 20px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #ccc;
          transition: .3s;
          border-radius: 20px;
        }

        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .3s;
          border-radius: 50%;
        }

        .toggle-switch input:checked + .toggle-slider {
          background-color: #008060;
        }

        .toggle-switch input:checked + .toggle-slider:before {
          transform: translateX(18px);
        }

        /* Canvas visual preview */
        .canvas-frame-container {
          background: #ffffff;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 6px 30px rgba(0,0,0,0.06);
          border: 1px solid #ebebeb;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .canvas-interactive {
          border: 1px solid #d2d5d8;
          border-radius: 6px;
          background: #ffffff;
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.03);
          max-width: 100%;
          max-height: 480px;
          object-fit: contain;
        }

        /* Small previews/links modal styles */
        .generic-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.4);
          z-index: 10001;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(4px);
        }

        .generic-modal-card {
          background: #ffffff;
          border-radius: 12px;
          width: 480px;
          max-width: 90vw;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 30px rgba(0,0,0,0.15);
          overflow: hidden;
        }

        .generic-modal-header {
          padding: 14px 20px;
          border-bottom: 1px solid #ebebeb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fafafa;
        }

        .generic-modal-header h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
        }

        .generic-modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .generic-modal-footer {
          padding: 12px 20px;
          border-top: 1px solid #ebebeb;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          background: #fafafa;
        }

        .customizer-btn {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #babfc3;
          background: #ffffff;
          color: #2c3e50;
        }

        .customizer-btn:hover {
          background: #f1f2f4;
        }

        .customizer-btn.primary {
          background: #008060;
          border-color: #008060;
          color: #ffffff;
        }

        .customizer-btn.primary:hover {
          background: #006e52;
        }

        .customizer-btn.danger {
          background: #d93838;
          border-color: #d93838;
          color: #ffffff;
        }

        .customizer-btn.danger:hover {
          background: #be2e2e;
        }

        /* Pagination overrides */
        .pagination-bar {
          padding: 12px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #ebebeb;
          background: #fafafa;
        }

        .pagination-nav {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .pagination-arrow {
          border: 1px solid #babfc3;
          background: #ffffff;
          padding: 6px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
        }

        .pagination-arrow:disabled {
          background: #f1f2f4;
          color: #8c9196;
          cursor: not-allowed;
          border-color: #e1e3e6;
        }

        .page-num {
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 4px;
          cursor: pointer;
          border: 1px solid transparent;
        }

        .page-num.active {
          background: #e1f5fe;
          color: #0288d1;
          border-color: #b3e5fc;
        }

        /* Skeleton pulse animation */
        .skeleton-pulse {
          background: linear-gradient(90deg, #f2f2f2 25%, #e6e6e6 50%, #f2f2f2 75%);
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite ease-in-out;
        }

        @keyframes skeleton-loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        /* Tooltip styling */
        .help-tooltip-container {
          position: relative;
          display: inline-flex;
          align-items: center;
          margin-left: 6px;
          cursor: help;
        }

        .help-tooltip-icon {
          color: #8c9196;
          transition: color 0.15s ease;
          display: inline-flex;
          align-items: center;
        }

        .help-tooltip-icon:hover {
          color: #5c5f62;
        }

        .help-tooltip-text {
          visibility: hidden;
          position: absolute;
          bottom: 125%;
          left: 50%;
          transform: translateX(-50%);
          background-color: #303030;
          color: #ffffff;
          text-align: center;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11px;
          line-height: 1.4;
          white-space: normal;
          width: 180px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          opacity: 0;
          transition: opacity 0.2s, transform 0.2s;
          z-index: 10005;
          pointer-events: none;
          font-weight: normal;
          text-transform: none;
        }

        .help-tooltip-text::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          margin-left: -5px;
          border-width: 5px;
          border-style: solid;
          border-color: #303030 transparent transparent transparent;
        }

        .help-tooltip-container:hover .help-tooltip-text {
          visibility: visible;
          opacity: 1;
          transform: translateX(-50%) translateY(-2px);
        }

        /* Save Button Spinner */
        .save-spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: #ffffff;
          animation: save-spin 0.6s linear infinite;
          margin-right: 4px;
        }
        @keyframes save-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* 🔴 TEMPLATES LIST VIEW */}
      <div className="templates-tab-container">
        
        {/* App Title inside card with tab buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 0 20px" }}>
          <h1 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "#1a1a1a" }}>Templates</h1>
          <button
            onClick={() => {
              setNewTemplateName("");
              setNewTemplateDesc("");
              setNewTemplateError("");
              setSelectedStyleCard("generic");
              setIsCreateModalOpen(true);
            }}
            className="customizer-btn primary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create new Template
          </button>
        </div>

        {/* Tab switcher */}
        <div className="templates-tab-bar">
          <div
            className={`templates-tab-item ${activeTab === "built_in" ? "active" : ""}`}
            onClick={() => { setActiveTab("built_in"); setSearchTerm(""); }}
          >
            Built-in Templates
          </div>
          <div
            className={`templates-tab-item ${activeTab === "yours" ? "active" : ""}`}
            onClick={() => { setActiveTab("yours"); setSearchTerm(""); }}
          >
            Your Templates
          </div>
        </div>

        {/* Search bar below tabs */}
        <div className="search-and-filters">
          <div className="search-field-wrapper">
            <svg className="search-field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              className="search-field-input"
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Tab 1: Built-in Templates */}
        {activeTab === "built_in" && (
          <table className="template-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Tags</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredBuiltIn.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "#6d7175", padding: "40px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <span>No built-in templates match your search.</span>
                      <button
                        type="button"
                        className="btn-text-action"
                        style={{ border: "1px solid #babfc3", padding: "4px 12px", fontSize: "12px" }}
                        onClick={() => setSearchTerm("")}
                      >
                        Clear search
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBuiltIn.map((builtin) => (
                  <tr key={builtin.id}>
                    <td style={{ fontWeight: 600 }}>{builtin.name}</td>
                    <td>
                      {builtin.tags.map((tag, i) => (
                        <span key={i} className="badge-tag">{tag}</span>
                      ))}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                        <button
                          title="Preview Template Design"
                          aria-label="Preview Template Design"
                          className="action-icon-btn"
                          onClick={() => {
                            setSelectedTemplate({
                              id: builtin.id,
                              name: builtin.name,
                              description: builtin.description,
                              options: builtin.options
                            });
                            setIsPreviewModalOpen(true);
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button
                          title="Duplicate to Your Templates"
                          aria-label="Duplicate to Your Templates"
                          className="action-icon-btn"
                          onClick={() => handleDuplicateBuiltIn(builtin)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </button>
                        <button
                          className="btn-text-action"
                          onClick={() => handleOpenLinkModal(builtin.id)}
                        >
                          Use Template
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Tab 2: Your Custom Templates */}
        {activeTab === "yours" && (
          <>
            <table className="template-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Description</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTemplates.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", color: "#6d7175", padding: "40px" }}>
                      {templates.length === 0 ? (
                        "You haven't created any templates yet. Click \"Create new Template\" to begin."
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                          <span>No custom templates match your search.</span>
                          <button
                            type="button"
                            className="btn-text-action"
                            style={{ border: "1px solid #babfc3", padding: "4px 12px", fontSize: "12px" }}
                            onClick={() => setSearchTerm("")}
                          >
                            Clear search
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedTemplates.map((t: any) => {
                    // Count GIDs linked to this template ID
                    const linkedCount = products.filter((p: any) => {
                      if (p.metafield?.value) {
                        try {
                          return JSON.parse(p.metafield.value).templateId === t.id;
                        } catch (err) {}
                      }
                      return false;
                    }).map((p: any) => p.id);

                    return (
                      <tr key={t.id}>
                        <td>
                          <button
                            onClick={() => {
                              setSelectedTemplate(t);
                              setIsModalOpen(true);
                              setCustomizerLoading(true);
                              setCanvasZoom(100);
                              setTimeout(() => {
                                setCustomizerLoading(false);
                                setTimeout(() => { initialStateRef.current = getCurrentStateSnapshot(); }, 50);
                              }, 800);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              font: "inherit",
                              fontWeight: 700,
                              color: "#2c3e50",
                              cursor: "pointer",
                              textAlign: "left"
                            }}
                          >
                            {t.name}
                          </button>
                          {linkedCount.length > 0 && (
                            <span style={{ marginLeft: "8px", fontSize: "11px", color: "#008060", background: "rgba(0,128,96,0.08)", padding: "2px 6px", borderRadius: "10px", fontWeight: "bold" }}>
                              Linked: {linkedCount.length}
                            </span>
                          )}
                        </td>
                        <td style={{ color: "#6d7175", fontSize: "13px" }}>
                          {t.description || <span style={{ fontStyle: "italic", color: "#b2b2b2" }}>No description provided</span>}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                            <button
                              className="btn-text-action"
                              onClick={() => handleOpenLinkModal(t.id)}
                            >
                              Use Template
                            </button>
                            <button
                              title="Edit Template Blueprint"
                              aria-label="Edit Template Blueprint"
                              className="action-icon-btn"
                              onClick={() => {
                                setSelectedTemplate(t);
                                setIsModalOpen(true);
                                setCustomizerLoading(true);
                                setCanvasZoom(100);
                                setTimeout(() => {
                                  setCustomizerLoading(false);
                                  setTimeout(() => { initialStateRef.current = getCurrentStateSnapshot(); }, 50);
                                }, 800);
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            </button>
                            <button
                              title="Duplicate Template"
                              aria-label="Duplicate Template"
                              className="action-icon-btn"
                              onClick={() => handleDuplicateTemplate(t.id)}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            </button>
                            <button
                              title="Delete Template"
                              aria-label="Delete Template"
                              className="action-icon-btn danger"
                              onClick={() => handleDeleteTemplate(t.id, linkedCount)}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {totalItems > 0 && (
              <div className="pagination-bar">
                <div style={{ display: "flex", gap: "10px", alignItems: "center", fontSize: "13px" }}>
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(parseInt(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #babfc3", background: "#fff" }}
                  >
                    {[5, 10, 15, 20, 30, 50, 100].map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <span style={{ color: "#6d7175" }}>
                    Showing {Math.min(totalItems, (currentPage - 1) * pageSize + 1)} - {Math.min(totalItems, currentPage * pageSize)} of {totalItems} results
                  </span>
                </div>
                
                <div className="pagination-nav">
                  <button
                    className="pagination-arrow"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  >
                    ←
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      className={`page-num ${currentPage === i + 1 ? "active" : ""}`}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    className="pagination-arrow"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 🟢 CREATE TEMPLATE MODAL */}
      {isCreateModalOpen && (
        <div className="generic-modal-overlay">
          <div className="generic-modal-card" style={{ width: "520px" }}>
            <div className="generic-modal-header" style={{ background: "#ffffff", borderBottom: "1px solid #ebebeb", padding: "16px 20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a1a" }}>Create New Template</h3>
              <button
                style={{ border: "none", background: "none", fontSize: "18px", cursor: "pointer", color: "#6d7175" }}
                onClick={() => setIsCreateModalOpen(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="generic-modal-body" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="input-group" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "13px", fontWeight: 600, color: "#212529" }}>Select Style Category / Thumbnail</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                  
                  <div
                    onClick={() => setSelectedStyleCard("watch")}
                    style={{
                      border: selectedStyleCard === "watch" ? "2px solid #008060" : "1px solid #babfc3",
                      background: selectedStyleCard === "watch" ? "#f4fbf7" : "#ffffff",
                      borderRadius: "8px",
                      padding: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px"
                    }}
                  >
                    <span style={{ fontSize: "24px" }}>⌚</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px" }}>Watch Dial Preset</div>
                      <div style={{ fontSize: "11px", color: "#6d7175" }}>Initials engraving preset</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedStyleCard("neon")}
                    style={{
                      border: selectedStyleCard === "neon" ? "2px solid #008060" : "1px solid #babfc3",
                      background: selectedStyleCard === "neon" ? "#f4fbf7" : "#ffffff",
                      borderRadius: "8px",
                      padding: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px"
                    }}
                  >
                    <span style={{ fontSize: "24px" }}>💡</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px" }}>Neon Sign Preset</div>
                      <div style={{ fontSize: "11px", color: "#6d7175" }}>Glow color & text options</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedStyleCard("pillow")}
                    style={{
                      border: selectedStyleCard === "pillow" ? "2px solid #008060" : "1px solid #babfc3",
                      background: selectedStyleCard === "pillow" ? "#f4fbf7" : "#ffffff",
                      borderRadius: "8px",
                      padding: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px"
                    }}
                  >
                    <span style={{ fontSize: "24px" }}>🛋️</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px" }}>Pillow Monogram</div>
                      <div style={{ fontSize: "11px", color: "#6d7175" }}>Large text centerpiece</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setSelectedStyleCard("generic")}
                    style={{
                      border: selectedStyleCard === "generic" ? "2px solid #008060" : "1px solid #babfc3",
                      background: selectedStyleCard === "generic" ? "#f4fbf7" : "#ffffff",
                      borderRadius: "8px",
                      padding: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px"
                    }}
                  >
                    <span style={{ fontSize: "24px" }}>🎨</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px" }}>Generic Canvas</div>
                      <div style={{ fontSize: "11px", color: "#6d7175" }}>Blank slate builder</div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <div className="generic-modal-footer" style={{ borderTop: "1px solid #ebebeb", padding: "12px 20px", background: "#ffffff" }}>
              <button
                className="customizer-btn"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ padding: "8px 16px", borderRadius: "6px" }}
              >
                Cancel
              </button>
              <button
                className="customizer-btn primary"
                onClick={handleConfirmCreateTemplate}
                style={{ padding: "8px 16px", borderRadius: "6px" }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 TEMPLATE CUSTOMIZER OVERLAY MODAL */}
      {isModalOpen && (
        <div className="customizer-overlay">
          <div className="customizer-card">
            
            {customizerLoading ? (
              <div className="skeleton-customizer-container" style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
                {/* Skeleton Header */}
                <div className="skeleton-header" style={{ height: "64px", borderBottom: "1px solid #ebebeb", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div className="skeleton-pulse" style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#f0f0f0" }} />
                    <div className="skeleton-pulse" style={{ width: "250px", height: "20px", borderRadius: "4px", background: "#f0f0f0" }} />
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div className="skeleton-pulse" style={{ width: "120px", height: "36px", borderRadius: "6px", background: "#f0f0f0" }} />
                    <div className="skeleton-pulse" style={{ width: "120px", height: "36px", borderRadius: "6px", background: "#f0f0f0" }} />
                  </div>
                </div>
                {/* Skeleton Body */}
                <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                  {/* Skeleton Sidebar */}
                  <div style={{ width: "320px", borderRight: "1px solid #ebebeb", padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
                    <div className="skeleton-pulse" style={{ width: "80px", height: "16px", borderRadius: "4px", background: "#f0f0f0" }} />
                    <div className="skeleton-pulse" style={{ width: "100%", height: "40px", borderRadius: "6px", background: "#f0f0f0" }} />
                    <div className="skeleton-pulse" style={{ width: "100%", height: "40px", borderRadius: "6px", background: "#f0f0f0" }} />
                    <div className="skeleton-pulse" style={{ width: "100%", height: "40px", borderRadius: "6px", background: "#f0f0f0" }} />
                    <div className="skeleton-pulse" style={{ width: "100%", height: "150px", borderRadius: "8px", background: "#f0f0f0" }} />
                  </div>
                  {/* Skeleton Canvas */}
                  <div style={{ flex: 1, padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f6f6f7" }}>
                    <div className="skeleton-pulse" style={{ width: "450px", height: "450px", borderRadius: "12px", background: "#ffffff", border: "1px solid #ebebeb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", padding: "20px" }} />
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Customizer Header */}
                <div className="customizer-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button
                      className="customizer-btn"
                      onClick={handleSafeClose}
                      style={{ border: "none", background: "transparent", fontSize: "16px", padding: "4px 8px" }}
                    >
                      ✕
                    </button>
                    <h2>Template Customizer: <span style={{ color: "#008060" }}>{templateName || "New Template"}</span></h2>
                  </div>
                  
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    {/* Undo/Redo Buttons */}
                    <div style={{ display: "flex", border: "1px solid #babfc3", borderRadius: "6px", background: "#ffffff", marginRight: "10px" }}>
                      <button
                        className="customizer-btn"
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        title="Undo (⌘Z)"
                        style={{ border: "none", borderRadius: "6px 0 0 6px", padding: "8px 12px", background: "transparent", cursor: historyIndex <= 0 ? "not-allowed" : "pointer", opacity: historyIndex <= 0 ? 0.4 : 1 }}
                      >
                        ↩ Undo
                      </button>
                      <div style={{ width: "1px", background: "#babfc3" }} />
                      <button
                        className="customizer-btn"
                        onClick={handleRedo}
                        disabled={historyIndex >= optionHistory.length - 1}
                        title="Redo (⌘⇧Z)"
                        style={{ border: "none", borderRadius: "0 6px 6px 0", padding: "8px 12px", background: "transparent", cursor: historyIndex >= optionHistory.length - 1 ? "not-allowed" : "pointer", opacity: historyIndex >= optionHistory.length - 1 ? 0.4 : 1 }}
                      >
                        Redo ↪
                      </button>
                    </div>
                    
                    <button
                      className="customizer-btn"
                      onClick={() => {
                        setLinkingTemplateId(selectedTemplate?.id || "temp-draft");
                        setIsLinkModalOpen(true);
                      }}
                    >
                      🔗 Link to Products ({linkedProducts.length})
                    </button>
                    <button
                      className="customizer-btn primary"
                      onClick={handleSaveTemplate}
                      disabled={fetcher.state === "submitting"}
                      style={fetcher.state === "submitting" ? { opacity: 0.7, cursor: "not-allowed" } : {}}
                      title="Save Template (⌘S)"
                    >
                      {fetcher.state === "submitting" ? (
                        <><span className="save-spinner" /> Saving...</>
                      ) : (
                        <>💾 Save Template</>
                      )}
                    </button>
                  </div>
                </div>

            {/* Split pane Workspace */}
            <div className="customizer-pane">
              
              {/* LEFT SIDEBAR: Config & Elements */}
              <div className="customizer-sidebar">
                
                {/* View settings tab bar */}
                <div className="customizer-subtabs">
                  <div className="customizer-subtab active">Main View</div>
                </div>

                {/* Sidebar Scrollable accordion panels */}
                <div style={{ flex: 1, overflowY: "auto" }}>
                  
                  {/* Accordion 1: Basic Settings */}
                  <details className="sidebar-accordion" open>
                    <summary>Basic Settings</summary>
                    <div className="accordion-content">
                      <div className="input-group">
                        <label>Template Name</label>
                        <input
                          type="text"
                          className="custom-input"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder="e.g. Chronos C-200 Watch Face"
                        />
                      </div>
                      <div className="input-group">
                        <label>Description</label>
                        <textarea
                          className="custom-input"
                          value={templateDescription}
                          onChange={(e) => setTemplateDescription(e.target.value)}
                          placeholder="Optional helper details..."
                          style={{ minHeight: "60px", resize: "vertical", fontFamily: "inherit" }}
                        />
                      </div>
                      <div className="input-group">
                        <label>Form Header Title</label>
                        <input
                          type="text"
                          className="custom-input"
                          value={heading}
                          onChange={(e) => setHeading(e.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label style={{ display: "inline-flex", alignItems: "center" }}>
                          Layout Mode
                          <span className="help-tooltip-container">
                            <span className="help-tooltip-icon">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            </span>
                            <span className="help-tooltip-text">Controls how personalization options are laid out on your product page (e.g., stacked list, tabs, or modal popup).</span>
                          </span>
                        </label>
                        <select
                          className="custom-input"
                          value={layoutMode}
                          onChange={(e) => setLayoutMode(e.target.value as any)}
                        >
                          <option value="stacked">Stacked Layout (Inline)</option>
                          <option value="tabs">Dynamic Tabs</option>
                          <option value="modal">Sleek Overlay Modal</option>
                        </select>
                      </div>
                      <div className="input-group">
                        <label>View Name</label>
                        <input
                          type="text"
                          className="custom-input"
                          value={viewName}
                          onChange={(e) => setViewName(e.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label>View Background</label>
                        <div className="background-grid-picker" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginTop: "6px" }}>
                          
                          {/* Blank Canvas option */}
                          <div 
                            className={`background-grid-item ${viewBackground === "Blank Canvas" ? "active" : ""}`}
                            onClick={() => setViewBackground("Blank Canvas")}
                            style={{
                              border: viewBackground === "Blank Canvas" ? "2px solid #008060" : "1px solid #ebebeb",
                              borderRadius: "6px",
                              padding: "8px",
                              textAlign: "center",
                              cursor: "pointer",
                              background: "#ffffff",
                              fontSize: "12px",
                              fontWeight: 600,
                              minHeight: "50px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                          >
                            Blank Canvas
                          </div>

                          {/* Image Assets options */}
                          {assets.filter(a => a.type === "IMAGE" || a.type === "IMAGES").map(a => {
                            try {
                              const parsed = JSON.parse(a.value);
                              const isSelected = viewBackground === parsed.url;
                              return (
                                <div 
                                  key={a.id}
                                  className={`background-grid-item ${isSelected ? "active" : ""}`}
                                  onClick={() => setViewBackground(parsed.url)}
                                  title={a.name}
                                  style={{
                                    border: isSelected ? "2px solid #008060" : "1px solid #ebebeb",
                                    borderRadius: "6px",
                                    padding: "2px",
                                    cursor: "pointer",
                                    background: "#ffffff",
                                    minHeight: "50px",
                                    position: "relative",
                                    overflow: "hidden"
                                  }}
                                >
                                  <img 
                                    src={parsed.url} 
                                    alt={a.name} 
                                    style={{ width: "100%", height: "100%", minHeight: "44px", objectFit: "cover", borderRadius: "4px" }} 
                                  />
                                </div>
                              );
                            } catch(e) { return null; }
                          })}

                          {/* Custom Image URL option */}
                          {(() => {
                            const isCustom = viewBackground !== "Blank Canvas" && !assets.some(a => { try { return JSON.parse(a.value).url === viewBackground; } catch(e) { return false; } });
                            return (
                              <div 
                                className={`background-grid-item ${isCustom ? "active" : ""}`}
                                onClick={() => setViewBackground("")}
                                style={{
                                  border: isCustom ? "2px solid #008060" : "1px solid #ebebeb",
                                  borderRadius: "6px",
                                  padding: "8px",
                                  textAlign: "center",
                                  cursor: "pointer",
                                  background: "#ffffff",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  minHeight: "50px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center"
                                }}
                              >
                                Custom URL
                              </div>
                            );
                          })()}
                        </div>

                        {/* Input field for Custom URL */}
                        {(() => {
                          const isCustom = viewBackground !== "Blank Canvas" && !assets.some(a => { try { return JSON.parse(a.value).url === viewBackground; } catch(e) { return false; } });
                          return isCustom && (
                            <input
                              type="text"
                              className="custom-input"
                              style={{ marginTop: "8px" }}
                              value={viewBackground}
                              onChange={(e) => setViewBackground(e.target.value)}
                              placeholder="Enter image URL or relative path..."
                            />
                          );
                        })()}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div className="input-group">
                          <label style={{ display: "inline-flex", alignItems: "center" }}>
                            Canvas Width (px)
                            <span className="help-tooltip-container">
                              <span className="help-tooltip-icon">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                              </span>
                              <span className="help-tooltip-text">The logical viewport width of the design canvas. Determines aspect ratio and print/decal coordinates resolution.</span>
                            </span>
                          </label>
                          <input
                            type="number"
                            min="500"
                            max="5000"
                            className="custom-input"
                            value={canvasW}
                            onChange={(e) => setCanvasW(Math.max(500, Math.min(5000, parseInt(e.target.value) || 1000)))}
                          />
                        </div>
                        <div className="input-group">
                          <label style={{ display: "inline-flex", alignItems: "center" }}>
                            Canvas Height (px)
                            <span className="help-tooltip-container">
                              <span className="help-tooltip-icon">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                              </span>
                              <span className="help-tooltip-text">The logical viewport height of the design canvas. Determines aspect ratio and print/decal coordinates resolution.</span>
                            </span>
                          </label>
                          <input
                            type="number"
                            min="500"
                            max="5000"
                            className="custom-input"
                            value={canvasH}
                            onChange={(e) => setCanvasH(Math.max(500, Math.min(5000, parseInt(e.target.value) || 1000)))}
                          />
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* Accordion 2: Cart and Order settings */}
                  <details className="sidebar-accordion">
                    <summary>Cart and Order settings</summary>
                    <div className="accordion-content">
                      <div className="toggle-switch-wrapper">
                        <span className="toggle-switch-label">Generate Preview Image</span>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={generatePreview}
                            onChange={(e) => setGeneratePreview(e.target.checked)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                      <div className="input-group">
                        <label>Preview Size quality</label>
                        <select
                          className="custom-input"
                          value={previewSize}
                          onChange={(e) => setPreviewSize(e.target.value)}
                        >
                          <option value="Compressed">Compressed JPG</option>
                          <option value="High">Full Quality PNG</option>
                        </select>
                      </div>
                      <div className="toggle-switch-wrapper">
                        <span className="toggle-switch-label">Include Additional Files</span>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={additionalFile}
                            onChange={(e) => setAdditionalFile(e.target.checked)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                      <div className="toggle-switch-wrapper">
                        <span className="toggle-switch-label" style={{ display: "inline-flex", alignItems: "center" }}>
                          Hide Background in order image
                          <span className="help-tooltip-container">
                            <span className="help-tooltip-icon">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            </span>
                            <span className="help-tooltip-text">If enabled, the canvas background image is excluded from the final customization image saved for order fulfillment.</span>
                          </span>
                        </span>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={hideBackground}
                            onChange={(e) => setHideBackground(e.target.checked)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                      <div className="toggle-switch-wrapper">
                        <span className="toggle-switch-label" style={{ display: "inline-flex", alignItems: "center" }}>
                          Custom cart labels override
                          <span className="help-tooltip-container">
                            <span className="help-tooltip-icon">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            </span>
                            <span className="help-tooltip-text">Allows overriding Shopify cart line item titles with custom names specified under each element's customization properties.</span>
                          </span>
                        </span>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={customCartLabel}
                            onChange={(e) => setCustomCartLabel(e.target.checked)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                    </div>
                  </details>

                  {/* Accordion 3: Element options tree */}
                  <details className="sidebar-accordion" open>
                    <summary>Elements Tree</summary>
                    <div className="accordion-content">
                      
                      <div className="toggle-switch-wrapper" style={{ borderBottom: "1px dashed #ebebeb", paddingBottom: "10px" }}>
                        <span className="toggle-switch-label" style={{ fontWeight: 600, color: "#6d7175", fontSize: "11px", textTransform: "uppercase" }}>Show Live Editor Bounds</span>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={livePreview}
                            onChange={(e) => setLivePreview(e.target.checked)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>

                      {options.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px 0", color: "#8c9196", fontSize: "12px" }}>
                          There are no elements under this view.
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {options.map((opt, idx) => {
                            const isSelected = selectedOptionId === opt.id;
                            return (
                              <div
                                key={opt.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData("text/plain", String(idx));
                                  e.dataTransfer.effectAllowed = "move";
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = "move";
                                  setDragOverIdx(idx);
                                }}
                                onDragLeave={() => setDragOverIdx(null)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                                  handleReorderOption(fromIdx, idx);
                                }}
                                style={{
                                  border: dragOverIdx === idx ? "2px dashed #008060" : isSelected ? "1px solid #008060" : "1px solid #ebebeb",
                                  background: isSelected ? "#f4fbf7" : "#fafafa",
                                  padding: "12px",
                                  borderRadius: "8px",
                                  cursor: "grab",
                                  transition: "border 0.15s ease"
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ cursor: "grab", color: "#8c9196", fontSize: "14px", letterSpacing: "-2px", userSelect: "none" }} title="Drag to reorder">⋮⋮</span>
                                    <span style={{ fontWeight: 700, fontSize: "12px", color: isSelected ? "#008060" : "#2c3e50" }}>
                                      Option Layer #{idx + 1}
                                    </span>
                                  </div>
                                  {pendingRemoveId === opt.id ? (
                                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                      <span style={{ fontSize: "10px", color: "#6d7175" }}>Remove?</span>
                                      <button
                                        onClick={() => { handleRemoveOption(opt.id); setPendingRemoveId(null); }}
                                        style={{ border: "none", background: "#d93838", color: "#fff", fontSize: "10px", fontWeight: "bold", cursor: "pointer", padding: "2px 8px", borderRadius: "4px" }}
                                      >
                                        Yes
                                      </button>
                                      <button
                                        onClick={() => setPendingRemoveId(null)}
                                        style={{ border: "1px solid #babfc3", background: "#fff", color: "#2c3e50", fontSize: "10px", fontWeight: "bold", cursor: "pointer", padding: "2px 8px", borderRadius: "4px" }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setPendingRemoveId(opt.id)}
                                      style={{ border: "none", background: "none", color: "#d93838", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  className="custom-input"
                                  style={{ width: "100%", padding: "4px 8px", fontSize: "12px", marginBottom: "8px" }}
                                  value={opt.label}
                                  onChange={(e) => handleUpdateOption(opt.id, { label: e.target.value })}
                                  onBlur={() => pushHistory(options)}
                                />
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                                  <div>
                                    <label style={{ fontSize: "9px", color: "#8c9196", textTransform: "uppercase" }}>Type</label>
                                    <select
                                      className="custom-input"
                                      style={{ width: "100%", padding: "4px", fontSize: "11px" }}
                                      value={opt.type}
                                      onChange={(e) => handleUpdateOptionAndPush(opt.id, { type: e.target.value as any })}
                                    >
                                      <option value="text">Single Line Text</option>
                                      <option value="select">Dropdown Choice</option>
                                      <option value="swatch">Color Swatch Palette</option>
                                      <option value="file">File Decal Upload</option>
                                      <option value="checkbox">Option Checkbox</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: "9px", color: "#8c9196", textTransform: "uppercase", display: "inline-flex", alignItems: "center" }}>
                                      Upcharge ($)
                                      <span className="help-tooltip-container">
                                        <span className="help-tooltip-icon" style={{ marginLeft: "2px" }}>
                                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                                        </span>
                                        <span className="help-tooltip-text" style={{ textTransform: "none", fontWeight: "normal", fontSize: "10px", width: "140px" }}>An optional extra fee added to product base price when this option is selected.</span>
                                      </span>
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      className="custom-input"
                                      style={{ width: "100%", padding: "4px", fontSize: "11px" }}
                                      value={opt.priceUpcharge}
                                      onChange={(e) => handleUpdateOption(opt.id, { priceUpcharge: parseFloat(e.target.value) || 0 })}
                                      onBlur={() => pushHistory(options)}
                                    />
                                  </div>
                                </div>

                                {/* Choices Sets */}
                                {(opt.type === "select" || opt.type === "swatch") && (
                                  <div style={{ marginTop: "6px", borderTop: "1px dashed #e1e3e6", paddingTop: "6px" }}>
                                    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "4px" }}>
                                      <label style={{ fontSize: "10px", fontWeight: "bold" }}>Choices:</label>
                                      <label style={{ fontSize: "10px", cursor: "pointer" }}>
                                        <input
                                          type="radio"
                                          name={`choicesType-${opt.id}`}
                                          checked={opt.choicesType !== "global"}
                                          onChange={() => handleUpdateOptionAndPush(opt.id, { choicesType: "custom" })}
                                        /> Custom
                                      </label>
                                      <label style={{ fontSize: "10px", cursor: "pointer" }}>
                                        <input
                                          type="radio"
                                          name={`choicesType-${opt.id}`}
                                          checked={opt.choicesType === "global"}
                                          onChange={() => handleUpdateOptionAndPush(opt.id, { choicesType: "global" })}
                                        /> Asset Link
                                      </label>
                                    </div>
                                    {opt.choicesType === "global" ? (
                                      <select
                                        className="custom-input"
                                        style={{ width: "100%", padding: "4px", fontSize: "11px" }}
                                        value={opt.assetSetId || ""}
                                        onChange={(e) => {
                                          const asset = assets.find(a => a.id === e.target.value);
                                          handleUpdateOptionAndPush(opt.id, { assetSetId: e.target.value, choices: asset?.value || "" });
                                        }}
                                      >
                                        <option value="">Select Asset...</option>
                                        {opt.type === "swatch"
                                          ? colorAssets.map(c => <option key={c.id} value={c.id}>🎨 {c.name}</option>)
                                          : optionAssets.map(o => <option key={o.id} value={o.id}>📋 {o.name}</option>)
                                        }
                                      </select>
                                    ) : (
                                      <input
                                        type="text"
                                        className="custom-input"
                                        style={{ width: "100%", padding: "4px", fontSize: "11px" }}
                                        placeholder={opt.type === "swatch" ? "#000, #fff" : "Option A, Option B"}
                                        value={opt.choices || ""}
                                        onChange={(e) => handleUpdateOption(opt.id, { choices: e.target.value })}
                                        onBlur={() => pushHistory(options)}
                                      />
                                    )}
                                  </div>
                                )}

                                {/* Coordinate layouts settings */}
                                {(opt.type === "text" || opt.type === "clipart" || opt.type === "file") && (
                                  <div style={{ marginTop: "8px", borderTop: "1px dashed #e1e3e6", paddingTop: "8px" }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                        <span style={{ fontSize: "10px", color: "#6d7175" }}>X:</span>
                                        <input
                                          type="number"
                                          className="custom-input"
                                          style={{ padding: "2px 4px", fontSize: "10px", width: "100%" }}
                                          value={opt.canvasX ?? 500}
                                          onChange={(e) => handleUpdateOption(opt.id, { canvasX: parseInt(e.target.value) || 0 })}
                                          onBlur={() => pushHistory(options)}
                                        />
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                        <span style={{ fontSize: "10px", color: "#6d7175" }}>Y:</span>
                                        <input
                                          type="number"
                                          className="custom-input"
                                          style={{ padding: "2px 4px", fontSize: "10px", width: "100%" }}
                                          value={opt.canvasY ?? 500}
                                          onChange={(e) => handleUpdateOption(opt.id, { canvasY: parseInt(e.target.value) || 0 })}
                                          onBlur={() => pushHistory(options)}
                                        />
                                      </div>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "4px" }}>
                                      {opt.type === "text" ? (
                                        <>
                                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                            <span style={{ fontSize: "10px", color: "#6d7175" }}>Size:</span>
                                            <input
                                              type="number"
                                              className="custom-input"
                                              style={{ padding: "2px 4px", fontSize: "10px", width: "100%" }}
                                              value={opt.canvasFontSize ?? 80}
                                              onChange={(e) => handleUpdateOption(opt.id, { canvasFontSize: parseInt(e.target.value) || 0 })}
                                              onBlur={() => pushHistory(options)}
                                            />
                                          </div>
                                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                            <span style={{ fontSize: "10px", color: "#6d7175" }}>Rot:</span>
                                            <input
                                              type="number"
                                              className="custom-input"
                                              style={{ padding: "2px 4px", fontSize: "10px", width: "100%" }}
                                              value={opt.canvasRotation ?? 0}
                                              onChange={(e) => handleUpdateOption(opt.id, { canvasRotation: parseInt(e.target.value) || 0 })}
                                              onBlur={() => pushHistory(options)}
                                            />
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                            <span style={{ fontSize: "10px", color: "#6d7175" }}>W:</span>
                                            <input
                                              type="number"
                                              className="custom-input"
                                              style={{ padding: "2px 4px", fontSize: "10px", width: "100%" }}
                                              value={opt.canvasWidth ?? 300}
                                              onChange={(e) => handleUpdateOption(opt.id, { canvasWidth: parseInt(e.target.value) || 0 })}
                                              onBlur={() => pushHistory(options)}
                                            />
                                          </div>
                                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                            <span style={{ fontSize: "10px", color: "#6d7175" }}>H:</span>
                                            <input
                                              type="number"
                                              className="custom-input"
                                              style={{ padding: "2px 4px", fontSize: "10px", width: "100%" }}
                                              value={opt.canvasHeight ?? 300}
                                              onChange={(e) => handleUpdateOption(opt.id, { canvasHeight: parseInt(e.target.value) || 0 })}
                                              onBlur={() => pushHistory(options)}
                                            />
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <button
                        className="customizer-btn"
                        style={{ width: "100%", border: "1px dashed #008060", color: "#008060", display: "flex", justifyContent: "center", marginTop: "12px" }}
                        onClick={handleAddOption}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Add New Element
                      </button>
                    </div>
                  </details>
                </div>
              </div>

              {/* RIGHT preview panels */}
              <div className="customizer-main">
                
                {/* Visual Card wrapping Canvas */}
                <div className="canvas-frame-container">
                  {/* Info Row */}
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", borderBottom: "1px solid #ebebeb", paddingBottom: "10px" }}>
                    <span style={{ fontSize: "14px", fontWeight: "bold" }}>Preview: {templateName}</span>
                    <span style={{ fontSize: "14px", fontWeight: "bold", color: "#008060" }}>Upcharge Sum: ${optionPriceSum.toFixed(2)}</span>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      maxWidth: "450px",
                      overflow: "hidden",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      padding: "16px",
                      background: "#fafafa",
                      borderRadius: "8px",
                      border: "1px dashed #d2d5d8",
                      position: "relative"
                    }}
                    onWheel={(e) => {
                      e.preventDefault();
                      const delta = e.deltaY < 0 ? 5 : -5;
                      setCanvasZoom(prev => Math.max(25, Math.min(200, prev + delta)));
                    }}
                  >
                    <canvas
                      ref={canvasRef}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                      className="canvas-interactive"
                      style={{
                        width: "100%",
                        aspectRatio: `${canvasW}/${canvasH}`,
                        transform: `scale(${canvasZoom / 100})`,
                        transformOrigin: "center center",
                        transition: "transform 0.05s ease"
                      }}
                    />
                  </div>

                  {/* Zoom controls (P2) */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", justifyContent: "center", marginTop: "4px" }}>
                    <span style={{ fontSize: "12px", color: "#6d7175" }}>Zoom:</span>
                    <button
                      className="customizer-btn"
                      style={{ padding: "2px 8px", fontSize: "12px" }}
                      onClick={() => setCanvasZoom(prev => Math.max(25, prev - 10))}
                    >
                      -
                    </button>
                    <input
                      type="range"
                      min="25"
                      max="200"
                      step="5"
                      value={canvasZoom}
                      onChange={(e) => setCanvasZoom(parseInt(e.target.value))}
                      style={{ flex: 1, accentColor: "#008060" }}
                    />
                    <button
                      className="customizer-btn"
                      style={{ padding: "2px 8px", fontSize: "12px" }}
                      onClick={() => setCanvasZoom(prev => Math.max(25, Math.min(200, prev + 10)))}
                    >
                      +
                    </button>
                    <span style={{ fontSize: "12px", minWidth: "35px", textAlign: "right", fontWeight: 600 }}>{canvasZoom}%</span>
                    <button
                      className="customizer-btn"
                      style={{ padding: "2px 8px", fontSize: "12px", border: "none", background: "transparent", color: "#008060" }}
                      onClick={() => setCanvasZoom(100)}
                    >
                      Reset
                    </button>
                  </div>

                  {/* Canvas Dynamic testing fields */}
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px", background: "#f8f9fa", padding: "12px", borderRadius: "8px", marginTop: "6px" }}>
                    <span style={{ fontWeight: 700, fontSize: "11px", color: "#6d7175", textTransform: "uppercase" }}>Tester controls</span>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                      <div className="input-group">
                        <label style={{ fontSize: "10px" }}>Sample Text</label>
                        <input
                          type="text"
                          className="custom-input"
                          style={{ padding: "6px", fontSize: "12px" }}
                          value={previewText}
                          onChange={(e) => setPreviewText(e.target.value)}
                        />
                      </div>
                      <div className="input-group">
                        <label style={{ fontSize: "10px" }}>Sample Font</label>
                        <select
                          className="custom-input"
                          style={{ padding: "6px", fontSize: "12px" }}
                          value={previewFont}
                          onChange={(e) => setPreviewFont(e.target.value)}
                        >
                          <option value="Arial">Arial (System)</option>
                          <option value="Times New Roman">Times New Roman</option>
                          {fontAssets.map(f => (
                            <option key={f.id} value={f.name}>{f.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="input-group">
                        <label style={{ fontSize: "10px" }}>Sample Color</label>
                        <select
                          className="custom-input"
                          style={{ padding: "6px", fontSize: "12px" }}
                          value={previewColor}
                          onChange={(e) => setPreviewColor(e.target.value)}
                        >
                          <option value="#000000">Black</option>
                          <option value="#E63946">Crimson</option>
                          <option value="#457B9D">Slate Blue</option>
                          <option value="#1D3557">Dark Navy</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* 👁️ BUILT-IN TEMPLATE PREVIEW MODAL */}
      {isPreviewModalOpen && selectedTemplate && (
        <div className="generic-modal-overlay">
          <div className="generic-modal-card" style={{ width: "500px" }}>
            <div className="generic-modal-header">
              <h3>Built-in Preview: {selectedTemplate.name}</h3>
              <button
                style={{ border: "none", background: "none", fontSize: "16px", cursor: "pointer" }}
                onClick={() => setIsPreviewModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="generic-modal-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <p style={{ alignSelf: "flex-start", margin: 0, fontSize: "13px", color: "#6d7175" }}>
                {selectedTemplate.description}
              </p>
              
              {/* Canvas Preview in Modal */}
              <canvas
                ref={(node) => {
                  if (node) {
                    const ctx = node.getContext("2d");
                    if (ctx) {
                      node.width = 600;
                      node.height = 600;
                      ctx.clearRect(0,0,600,600);
                      ctx.fillStyle = "#ffffff";
                      ctx.fillRect(0,0,600,600);
                      
                      try {
                        const config = JSON.parse(selectedTemplate.options);
                        const opts = config.options || [];
                        
                        opts.forEach((opt: any) => {
                          ctx.save();
                          const x = opt.canvasX ?? 300;
                          const y = opt.canvasY ?? 300;
                          ctx.translate(x * 0.6, y * 0.6); // Scale to 360 size
                          
                          if (opt.type === "text") {
                            ctx.fillStyle = "#1a1a1a";
                            ctx.textAlign = "center";
                            ctx.textBaseline = "middle";
                            ctx.font = `bold ${opt.canvasFontSize * 0.6 || 36}px Arial`;
                            ctx.fillText(opt.label, 0, 0);
                          } else {
                            const renderW = (opt.canvasWidth || 200) * 0.6;
                            const renderH = (opt.canvasHeight || 200) * 0.6;
                            ctx.fillStyle = "rgba(0,128,96,0.06)";
                            ctx.strokeStyle = "#008060";
                            ctx.lineWidth = 2;
                            ctx.fillRect(-renderW/2, -renderH/2, renderW, renderH);
                            ctx.strokeRect(-renderW/2, -renderH/2, renderW, renderH);
                            
                            ctx.fillStyle = "#008060";
                            ctx.font = "12px Arial";
                            ctx.textAlign = "center";
                            ctx.fillText(opt.label, 0, 0);
                          }
                          ctx.restore();
                        });
                      } catch(e) {}
                    }
                  }
                }}
                style={{ width: "300px", height: "300px", border: "1px solid #d2d5d8", borderRadius: "6px" }}
              />
            </div>
            <div className="generic-modal-footer">
              <button
                className="customizer-btn"
                onClick={() => setIsPreviewModalOpen(false)}
              >
                Close
              </button>
              <button
                className="customizer-btn primary"
                onClick={() => {
                  handleDuplicateBuiltIn(selectedTemplate);
                  setIsPreviewModalOpen(false);
                }}
              >
                Duplicate blueprint
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔗 PRODUCT LINKER SELECTION MODAL */}
      {isLinkModalOpen && (
        <div className="generic-modal-overlay">
          <div className="generic-modal-card">
            <div className="generic-modal-header">
              <h3>Link template to Shopify store products</h3>
              <button
                style={{ border: "none", background: "none", fontSize: "16px", cursor: "pointer" }}
                onClick={() => setIsLinkModalOpen(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="generic-modal-body" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontSize: "13px", color: "#6d7175" }}>
                Select the products below to synchronize and enable this template configuration. Previously linked products that you uncheck will have their configurations disabled.
              </span>
              
              <div style={{
                maxHeight: "300px",
                overflowY: "auto",
                border: "1px solid #ebebeb",
                borderRadius: "6px",
                padding: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                {products.length === 0 ? (
                  <span style={{ padding: "20px", textAlign: "center", color: "#8c9196" }}>No products found in this store</span>
                ) : (
                  products.map((p: any) => {
                    const isLinked = linkedProducts.includes(p.id);
                    return (
                      <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px", borderRadius: "4px", cursor: "pointer", background: isLinked ? "#f0fbf7" : "#ffffff" }}>
                        <input
                          type="checkbox"
                          checked={isLinked}
                          onChange={() => toggleProductLink(p.id)}
                          style={{ accentColor: "#008060", cursor: "pointer" }}
                        />
                        {p.featuredImage?.url ? (
                          <img src={p.featuredImage.url} alt="" style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px" }} />
                        ) : (
                          <div style={{ width: "32px", height: "32px", background: "#f1f2f4", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>📦</div>
                        )}
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#2c3e50" }}>{p.title}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="generic-modal-footer">
              <button
                className="customizer-btn"
                onClick={() => setIsLinkModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="customizer-btn primary"
                onClick={handleSaveProductLinks}
              >
                Apply Links
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ UNSAVED CHANGES CONFIRMATION MODAL */}
      {isCloseConfirmOpen && (
        <div className="generic-modal-overlay">
          <div className="generic-modal-card" style={{ width: "420px" }}>
            <div className="generic-modal-header">
              <h3 style={{ margin: 0, color: "#d93838", display: "flex", alignItems: "center", gap: "6px" }}>
                ⚠️ Discard Unsaved Changes?
              </h3>
              <button
                style={{ border: "none", background: "none", fontSize: "16px", cursor: "pointer" }}
                onClick={() => setIsCloseConfirmOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="generic-modal-body">
              <p style={{ margin: 0, fontSize: "14px", color: "#2c3e50", lineHeight: "1.5" }}>
                You have unsaved changes in your template. If you close the customizer now, all unsaved changes will be lost.
              </p>
            </div>
            <div className="generic-modal-footer">
              <button
                className="customizer-btn"
                onClick={() => setIsCloseConfirmOpen(false)}
              >
                Keep Editing
              </button>
              <button
                className="customizer-btn danger"
                onClick={handleForceClose}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </s-page>
  );
}
