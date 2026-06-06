import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { PersonalizationConfigSync } from "../utils/templateSync";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { BuiltInTemplatesTab } from "../components/templates/BuiltInTemplatesTab";
import { YourTemplatesTab } from "../components/templates/YourTemplatesTab";
import { ProductLinkerModal } from "../components/templates/ProductLinkerModal";
import { TemplateEditorModal } from "../components/templates/TemplateEditorModal";
import type { CustomizationOption } from "../components/templates/TemplateEditorModal";


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
    } catch (e) { }

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
    } catch (e) { }

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
      } catch (e) { }
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
            } catch (e) { }
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
          cx.fillStyle = "rgba(26, 26, 26, 0.05)";
          cx.strokeStyle = "#1a1a1a";
          cx.lineWidth = 3;
          renderW = opt.canvasWidth ?? 250;
          renderH = opt.canvasHeight ?? 250;
          cx.fillRect(-renderW / 2, -renderH / 2, renderW, renderH);
          cx.strokeRect(-renderW / 2, -renderH / 2, renderW, renderH);

          cx.fillStyle = "#1a1a1a";
          cx.font = "bold 20px Arial";
          cx.textAlign = "center";
          cx.textBaseline = "middle";
          cx.fillText(`🖼️ Clipart: ${opt.label}`, 0, 0);
        } else if (opt.type === "file") {
          cx.fillStyle = "rgba(26, 26, 26, 0.05)";
          cx.strokeStyle = "#1a1a1a";
          cx.lineWidth = 3;
          renderW = opt.canvasWidth ?? 250;
          renderH = opt.canvasHeight ?? 250;
          cx.fillRect(-renderW / 2, -renderH / 2, renderW, renderH);
          cx.strokeRect(-renderW / 2, -renderH / 2, renderW, renderH);

          cx.fillStyle = "#1a1a1a";
          cx.font = "bold 20px Arial";
          cx.textAlign = "center";
          cx.textBaseline = "middle";
          cx.fillText(`📸 Upload: ${opt.label}`, 0, 0);
        }

        // Selected outline bounding bounds
        if (opt.id === selectedOptionId) {
          cx.strokeStyle = "#1a1a1a";
          cx.lineWidth = 3;
          cx.setLineDash([8, 8]);
          cx.strokeRect(-renderW / 2 - 10, -renderH / 2 - 10, renderW + 20, renderH + 20);
          cx.setLineDash([]);

          // Draw Drag & Resize placement tooltip badge
          cx.save();
          cx.fillStyle = "#1a1a1a";
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
          cx.strokeStyle = "#1a1a1a";
          cx.lineWidth = 2.5;
          const handleSize = 14;
          const corners = [
            { x: -renderW / 2 - 10, y: -renderH / 2 - 10 },
            { x: renderW / 2 + 10, y: -renderH / 2 - 10 },
            { x: -renderW / 2 - 10, y: renderH / 2 + 10 },
            { x: renderW / 2 + 10, y: renderH / 2 + 10 }
          ];
          corners.forEach(corner => {
            cx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
            cx.strokeRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
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

        const left = cxVal - w / 2;
        const right = cxVal + w / 2;
        const top = cyVal - h / 2;
        const bottom = cyVal + h / 2;

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
        x >= cxVal - w / 2 &&
        x <= cxVal + w / 2 &&
        y >= cyVal - h / 2 &&
        y <= cyVal + h / 2
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
        } catch (e) { }
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
          color: #1a1a1a;
        }

        .templates-tab-item.active {
          color: #1a1a1a;
          border-bottom-color: #1a1a1a;
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
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 14px;
          outline: none;
          background: #ffffff;
          color: #1a1a1a;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .search-field-input:focus {
          border-color: #1a1a1a;
          box-shadow: 0 0 0 1px #1a1a1a, 0 0 0 3px rgba(26, 26, 26, 0.15);
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
          color: #1a1a1a;
          background: #f1f2f4;
        }

        .action-icon-btn.danger:hover {
          color: #d92d20;
          background: #fde8e8;
        }

        .btn-text-action {
          background: none;
          border: none;
          color: #1a1a1a;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
          padding: 6px 10px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .btn-text-action:hover {
          background: rgba(0, 0, 0, 0.05);
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
          border-bottom: 1px solid #ebebeb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fafafa;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }

        .customizer-header h2 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #1a1a1a;
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
          background: #ffffff;
          border-bottom: 1px solid #ebebeb;
          padding: 0 16px;
          gap: 16px;
        }

        .customizer-subtab {
          padding: 12px 4px;
          font-size: 13px;
          font-weight: 600;
          color: #6d7175;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.15s ease;
          position: relative;
        }

        .customizer-subtab:hover {
          color: #1a1a1a;
        }

        .customizer-subtab.active {
          color: #1a1a1a;
          border-bottom: 2px solid #1a1a1a;
        }

        /* Custom Accordion Styling */
        .sidebar-accordion {
          border-bottom: 1px solid #ebebeb;
        }

        .sidebar-accordion summary {
          padding: 14px 16px;
          font-size: 13px;
          font-weight: 700;
          color: #1a1a1a;
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
          content: "";
          display: inline-block;
          width: 6px;
          height: 6px;
          border-right: 2px solid #8c9196;
          border-bottom: 2px solid #8c9196;
          transform: rotate(45deg);
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          margin-right: 4px;
        }

        .sidebar-accordion[open] summary::after {
          transform: rotate(-135deg);
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
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 13px;
          background: #ffffff;
          color: #1a1a1a;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          box-sizing: border-box;
        }

        select.custom-input {
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235c5f62' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 12px;
          padding-right: 36px;
        }

        .custom-input:focus {
          border-color: #1a1a1a;
          box-shadow: 0 0 0 1px #1a1a1a, 0 0 0 3px rgba(26, 26, 26, 0.15);
        }

        .custom-input::placeholder {
          color: #8c9196;
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
          background-color: #1a1a1a;
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
          border: 1px solid #cbd5e1;
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
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #1a1a1a;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          outline: none;
        }

        .customizer-btn:hover {
          background: #f6f6f7;
          border-color: #94a3b8;
        }

        .customizer-btn:active {
          background: #f1f5f9;
        }

        .customizer-btn.primary {
          background: #1a1a1a;
          border-color: #1a1a1a;
          color: #ffffff;
          box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.15), 0 1px 0 rgba(0, 0, 0, 0.05);
        }

        .customizer-btn.primary:hover {
          background: #303030;
          border-color: #303030;
        }

        .customizer-btn.primary:active {
          background: #000000;
          border-color: #000000;
        }

        .customizer-btn.danger {
          background: #d92d20;
          border-color: #d92d20;
          color: #ffffff;
          box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.15), 0 1px 0 rgba(0, 0, 0, 0.05);
        }

        .customizer-btn.danger:hover {
          background: #b42318;
          border-color: #b42318;
        }

        /* Option Card Redesign in Elements Tree */
        .option-card-wrapper {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          padding: 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .option-card-wrapper:hover {
          border-color: #94a3b8;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        }

        .option-card-wrapper.selected {
          border: 2px solid #1a1a1a;
          padding: 11px; /* Offset the 2px border width to prevent layout shifting */
          background: #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
          cursor: default;
        }

        .option-card-wrapper.drag-over {
          border: 2px dashed #1a1a1a;
          background: #f8fafc;
        }

        /* Background picker styling */
        .background-grid-item {
          border: 1px solid #ebebeb;
          border-radius: 6px;
          padding: 8px;
          text-align: center;
          cursor: pointer;
          background: #ffffff;
          font-size: 12px;
          font-weight: 600;
          min-height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
        }

        .background-grid-item:hover {
          border-color: #cbd5e1;
          background: #f6f6f7;
        }

        .background-grid-item.active {
          border: 2px solid #1a1a1a !important;
          background: #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
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
          border: 1px solid #cbd5e1;
          background: #ffffff;
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          color: #1a1a1a;
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
          border-radius: 6px;
          cursor: pointer;
          border: 1px solid transparent;
        }

        .page-num.active {
          background: #f1f5f9;
          color: #1a1a1a;
          border-color: #cbd5e1;
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
          color: #1a1a1a;
        }

        .help-tooltip-text {
          visibility: hidden;
          position: absolute;
          bottom: 125%;
          left: 50%;
          transform: translateX(-50%);
          background-color: #1a1a1a;
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
          border-color: #1a1a1a transparent transparent transparent;
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
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
            <svg className="search-field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
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
          <BuiltInTemplatesTab
            filteredBuiltIn={filteredBuiltIn}
            setSelectedTemplate={setSelectedTemplate}
            setIsPreviewModalOpen={setIsPreviewModalOpen}
            handleDuplicateBuiltIn={handleDuplicateBuiltIn}
            handleOpenLinkModal={handleOpenLinkModal}
            setSearchTerm={setSearchTerm}
          />
        )}

        {/* Tab 2: Your Custom Templates */}
        {activeTab === "yours" && (
          <YourTemplatesTab
            templates={templates}
            products={products}
            paginatedTemplates={paginatedTemplates}
            setSearchTerm={setSearchTerm}
            setSelectedTemplate={setSelectedTemplate}
            setIsModalOpen={setIsModalOpen}
            setCustomizerLoading={setCustomizerLoading}
            setCanvasZoom={setCanvasZoom}
            initialStateRef={initialStateRef}
            getCurrentStateSnapshot={getCurrentStateSnapshot}
            handleOpenLinkModal={handleOpenLinkModal}
            handleDuplicateTemplate={handleDuplicateTemplate}
            handleDeleteTemplate={handleDeleteTemplate}
            totalItems={totalItems}
            pageSize={pageSize}
            setPageSize={setPageSize}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
          />
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
                      border: selectedStyleCard === "watch" ? "2px solid #1a1a1a" : "1px solid #cbd5e1",
                      background: selectedStyleCard === "watch" ? "#fafafa" : "#ffffff",
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
                      border: selectedStyleCard === "neon" ? "2px solid #1a1a1a" : "1px solid #cbd5e1",
                      background: selectedStyleCard === "neon" ? "#fafafa" : "#ffffff",
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
                      border: selectedStyleCard === "pillow" ? "2px solid #1a1a1a" : "1px solid #cbd5e1",
                      background: selectedStyleCard === "pillow" ? "#fafafa" : "#ffffff",
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
                      border: selectedStyleCard === "generic" ? "2px solid #1a1a1a" : "1px solid #cbd5e1",
                      background: selectedStyleCard === "generic" ? "#fafafa" : "#ffffff",
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
      <TemplateEditorModal
        isModalOpen={isModalOpen}
        handleSafeClose={handleSafeClose}
        templateName={templateName}
        setTemplateName={setTemplateName}
        templateDescription={templateDescription}
        setTemplateDescription={setTemplateDescription}
        heading={heading}
        setHeading={setHeading}
        layoutMode={layoutMode}
        setLayoutMode={setLayoutMode}
        brandColor={brandColor}
        setBrandColor={setBrandColor}
        buttonColor={buttonColor}
        setButtonColor={setButtonColor}
        buttonTextColor={buttonTextColor}
        setButtonTextColor={setButtonTextColor}
        options={options}
        viewName={viewName}
        setViewName={setViewName}
        viewBackground={viewBackground}
        setViewBackground={setViewBackground}
        canvasW={canvasW}
        setCanvasW={setCanvasW}
        canvasH={canvasH}
        setCanvasH={setCanvasH}
        generatePreview={generatePreview}
        setGeneratePreview={setGeneratePreview}
        previewSize={previewSize}
        setPreviewSize={setPreviewSize}
        additionalFile={additionalFile}
        setAdditionalFile={setAdditionalFile}
        hideBackground={hideBackground}
        setHideBackground={setHideBackground}
        customCartLabel={customCartLabel}
        setCustomCartLabel={setCustomCartLabel}
        livePreview={livePreview}
        setLivePreview={setLivePreview}
        linkedProducts={linkedProducts}
        assets={assets}
        fetcher={fetcher}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        historyIndex={historyIndex}
        optionHistory={optionHistory}
        selectedTemplate={selectedTemplate}
        setIsLinkModalOpen={setIsLinkModalOpen}
        setLinkingTemplateId={setLinkingTemplateId}
        handleSaveTemplate={handleSaveTemplate}
        canvasZoom={canvasZoom}
        setCanvasZoom={setCanvasZoom}
        previewText={previewText}
        setPreviewText={setPreviewText}
        previewFont={previewFont}
        setPreviewFont={setPreviewFont}
        previewColor={previewColor}
        setPreviewColor={setPreviewColor}
        canvasRef={canvasRef}
        selectedOptionId={selectedOptionId}
        setSelectedOptionId={setSelectedOptionId}
        handleCanvasMouseDown={handleCanvasMouseDown}
        handleCanvasMouseMove={handleCanvasMouseMove}
        handleCanvasMouseUp={handleCanvasMouseUp}
        handleAddOption={handleAddOption}
        handleUpdateOption={handleUpdateOption}
        handleUpdateOptionAndPush={handleUpdateOptionAndPush}
        pendingRemoveId={pendingRemoveId}
        setPendingRemoveId={setPendingRemoveId}
        handleRemoveOption={handleRemoveOption}
        dragOverIdx={dragOverIdx}
        setDragOverIdx={setDragOverIdx}
        handleReorderOption={handleReorderOption}
        customizerLoading={customizerLoading}
      />

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
                      ctx.clearRect(0, 0, 600, 600);
                      ctx.fillStyle = "#ffffff";
                      ctx.fillRect(0, 0, 600, 600);

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
                            ctx.fillStyle = "rgba(26,26,26,0.05)";
                            ctx.strokeStyle = "#1a1a1a";
                            ctx.lineWidth = 2;
                            ctx.fillRect(-renderW / 2, -renderH / 2, renderW, renderH);
                            ctx.strokeRect(-renderW / 2, -renderH / 2, renderW, renderH);

                            ctx.fillStyle = "#1a1a1a";
                            ctx.font = "12px Arial";
                            ctx.textAlign = "center";
                            ctx.fillText(opt.label, 0, 0);
                          }
                          ctx.restore();
                        });
                      } catch (e) { }
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
      <ProductLinkerModal
        isLinkModalOpen={isLinkModalOpen}
        setIsLinkModalOpen={setIsLinkModalOpen}
        products={products}
        linkedProducts={linkedProducts}
        toggleProductLink={toggleProductLink}
        handleSaveProductLinks={handleSaveProductLinks}
        setLinkedProducts={setLinkedProducts}
      />

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
