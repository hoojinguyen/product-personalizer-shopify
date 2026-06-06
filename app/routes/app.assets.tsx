import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { ShopifyFilePublisher } from "../utils/shopifyFilePublisher";
import { useState, useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

// Loader: fetch all assets for this store
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const assets = await db.asset.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" }
  });

  return { assets, shop };
};

// Action: Handle CRUD operations and staged upload creation for assets
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "staged_upload") {
    const filename = formData.get("filename") as string;
    const mimeType = formData.get("mimeType") as string;
    const fileSize = formData.get("fileSize") as string;

    try {
      const publisher = new ShopifyFilePublisher();
      const target = await publisher.stage(admin, filename, Number(fileSize), mimeType);
      
      return { 
        success: true, 
        target: { 
          url: target.uploadUrl, 
          resourceUrl: target.resourceUrl, 
          parameters: target.parameters 
        } 
      };
    } catch (e: unknown) {
      return { error: (e as Error).message || "Failed to create upload staging target" };
    }
  }

  if (intent === "register_file") {
    const resourceUrl = formData.get("resourceUrl") as string;
    const filename = formData.get("filename") as string;

    try {
      const publisher = new ShopifyFilePublisher();
      const published = await publisher.publish(
        admin,
        {
          stagedResourceUrl: resourceUrl,
          filename,
        }
      );

      return { success: true, url: published.publicUrl };
    } catch (e: unknown) {
      return { error: (e as Error).message || "File registry failed" };
    }
  }

  if (intent === "save_asset") {
    const id = formData.get("id") as string;
    const type = formData.get("type") as string;
    const name = formData.get("name") as string;
    const value = formData.get("value") as string;

    if (id) {
      // Update
      const asset = await db.asset.update({
        where: { id, shop },
        data: { name, value }
      });
      return { success: true, asset };
    } else {
      // Create
      const asset = await db.asset.create({
        data: { shop, type, name, value }
      });
      return { success: true, asset };
    }
  }

  if (intent === "delete_asset") {
    const id = formData.get("id") as string;
    await db.asset.delete({
      where: { id, shop }
    });
    return { success: true, deleted: id, intent };
  }

  if (intent === "bulk_delete") {
    const ids = JSON.parse(formData.get("ids") as string) as string[];
    await db.asset.deleteMany({
      where: { id: { in: ids }, shop }
    });
    return { success: true, intent, count: ids.length };
  }

  return { error: "Unknown intent" };
};

const FontIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 20 12 4 20 20" />
    <line x1="8" y1="14" x2="16" y2="14" />
  </svg>
);

const ColorIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.01438 19.1558 5.09341 19.373 5.06644 19.5901C4.94586 20.562 5.67954 21.4323 6.65792 21.4925C7.03713 21.5158 7.37527 21.3283 7.6046 21.0374L8.71882 19.623C8.91979 19.3679 9.22743 19.2188 9.5539 19.2188H10C11.1046 19.2188 12 20.1142 12 22Z" />
    <circle cx="7.5" cy="10.5" r="1.5" fill="currentColor" />
    <circle cx="11.5" cy="7.5" r="1.5" fill="currentColor" />
    <circle cx="16.5" cy="9.5" r="1.5" fill="currentColor" />
  </svg>
);

const ImageIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const OptionIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const UploadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="17" />
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const DocumentEmptyGraphic = () => (
  <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#F4F4F5" />
    <g filter="url(#dropShadow)">
      <rect x="30" y="22" width="40" height="52" rx="6" fill="#FFFFFF" stroke="#E4E4E7" strokeWidth="1.5" />
    </g>
    <line x1="38" y1="38" x2="62" y2="38" stroke="#E4E4E7" strokeWidth="2" strokeLinecap="round" />
    <line x1="38" y1="46" x2="62" y2="46" stroke="#E4E4E7" strokeWidth="2" strokeLinecap="round" />
    <line x1="38" y1="54" x2="54" y2="54" stroke="#E4E4E7" strokeWidth="2" strokeLinecap="round" />
    <line x1="38" y1="62" x2="48" y2="62" stroke="#E4E4E7" strokeWidth="2" strokeLinecap="round" />
    <rect x="52" y="58" width="10" height="10" rx="2" fill="#F59E0B" />
    <defs>
      <filter id="dropShadow" x="26" y="19" width="48" height="60" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="BackgroundImageFix"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAttribute"/>
        <feOffset dy="2"/>
        <feGaussianBlur stdDeviation="3"/>
        <feComposite in2="hardAttribute" operator="out"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.04 0"/>
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
      </filter>
    </defs>
  </svg>
);

export default function AssetsDirectory() {
  const { assets } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [activeTab, setActiveTab] = useState<"fonts" | "colors" | "options" | "images">("fonts");
  const [loading, setLoading] = useState(false);

  // Search, sort, selection, pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"A-Z" | "Z-A" | "Newest">("A-Z");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Forms states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<typeof assets[number] | null>(null);
  const [assetName, setAssetName] = useState("");
  const [assetValue, setAssetValue] = useState("");

  // Fonts specific
  const [fontFile, setFontFile] = useState<File | null>(null);

  // Clipart specific
  const [clipartImages, setClipartImages] = useState<Array<{ id: string; name: string; url: string }>>([]);
  const [newClipartFile, setNewClipartFile] = useState<File | null>(null);
  const [newClipartName, setNewClipartName] = useState("");

  useEffect(() => {
    if (fetcher.data?.success) {
      setLoading(false);
      setShowAddModal(false);
      setEditingAsset(null);
      setAssetName("");
      setAssetValue("");
      setFontFile(null);
      setNewClipartFile(null);
      setNewClipartName("");
      setClipartImages([]);
      if (fetcher.data.intent === "bulk_delete") {
        shopify.toast.show(`Successfully deleted ${fetcher.data.count} assets.`);
        setSelectedAssetIds([]);
      } else {
        shopify.toast.show("Asset directory updated successfully!");
      }
    } else if (fetcher.data?.error) {
      setLoading(false);
      shopify.toast.show(`Error: ${fetcher.data.error}`);
    }
  }, [fetcher.data, shopify]);

  // Reset page and selection when tab, search query, or sorting changes
  useEffect(() => {
    setSelectedAssetIds([]);
    setCurrentPage(1);
  }, [activeTab, searchQuery, sortBy]);

  const handleSave = () => {
    if (!assetName.trim()) {
      shopify.toast.show("Please enter an asset name");
      return;
    }
    setLoading(true);
    fetcher.submit(
      {
        intent: "save_asset",
        id: editingAsset?.id || "",
        type: activeTab.toUpperCase(),
        name: assetName,
        value: assetValue
      },
      { method: "POST" }
    );
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this asset? Products referencing it may lose styling.")) {
      setLoading(true);
      fetcher.submit(
        { intent: "delete_asset", id },
        { method: "POST" }
      );
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Are you sure you want to delete the ${selectedAssetIds.length} selected assets?`)) {
      setLoading(true);
      fetcher.submit(
        { intent: "bulk_delete", ids: JSON.stringify(selectedAssetIds) },
        { method: "POST" }
      );
    }
  };

  const handleFontUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fontFile || !assetName.trim()) {
      shopify.toast.show("Please enter font name and choose a file");
      return;
    }
    setLoading(true);

    // Step 1: Create staged upload target
    const uploadForm = new FormData();
    uploadForm.append("intent", "staged_upload");
    uploadForm.append("filename", fontFile.name);
    uploadForm.append("mimeType", "font/ttf");
    uploadForm.append("fileSize", String(fontFile.size));

    const res = await fetch("", {
      method: "POST",
      body: uploadForm
    });
    const resData = await res.json();

    if (resData.error) {
      shopify.toast.show(`Staging failed: ${resData.error}`);
      setLoading(false);
      return;
    }

    const target = resData.target;

    // Step 2: Post file buffer to Shopify S3 bucket
    const s3Form = new FormData();
    target.parameters.forEach((param: { name: string; value: string }) => {
      s3Form.append(param.name, param.value);
    });
    s3Form.append("file", fontFile);

    const s3Res = await fetch(target.url, {
      method: "POST",
      body: s3Form
    });

    if (!s3Res.ok) {
      shopify.toast.show("Font upload to CDN failed.");
      setLoading(false);
      return;
    }

    // Step 3: Register and poll for URL
    const regForm = new FormData();
    regForm.append("intent", "register_file");
    regForm.append("resourceUrl", target.resourceUrl);
    regForm.append("filename", fontFile.name);

    const regRes = await fetch("", {
      method: "POST",
      body: regForm
    });
    const regData = await regRes.json();

    if (regData.error) {
      shopify.toast.show(`Registry failed: ${regData.error}`);
      setLoading(false);
      return;
    }

    // Step 4: Save Asset record
    fetcher.submit(
      {
        intent: "save_asset",
        id: "",
        type: "FONTS",
        name: assetName,
        value: JSON.stringify({ url: regData.url, format: fontFile.name.endsWith(".woff") ? "woff" : "truetype" })
      },
      { method: "POST" }
    );
  };

  const handleSingleClipartUpload = async (file: File, name: string) => {
    if (!file || !name.trim()) {
      shopify.toast.show("Please enter clipart name and choose a file");
      return;
    }
    setLoading(true);

    try {
      // Step 1: Create staged upload target
      const uploadForm = new FormData();
      uploadForm.append("intent", "staged_upload");
      uploadForm.append("filename", file.name);
      uploadForm.append("mimeType", file.type || "image/png");
      uploadForm.append("fileSize", String(file.size));

      const res = await fetch("", {
        method: "POST",
        body: uploadForm
      });
      const resData = await res.json();

      if (resData.error) {
        shopify.toast.show(`Staging failed: ${resData.error}`);
        setLoading(false);
        return;
      }

      const target = resData.target;

      // Step 2: Post file buffer to Shopify S3 bucket
      const s3Form = new FormData();
      target.parameters.forEach((param: { name: string; value: string }) => {
        s3Form.append(param.name, param.value);
      });
      s3Form.append("file", file);

      const s3Res = await fetch(target.url, {
        method: "POST",
        body: s3Form
      });

      if (!s3Res.ok) {
        shopify.toast.show("Clipart upload to CDN failed.");
        setLoading(false);
        return;
      }

      // Step 3: Register and poll for URL
      const regForm = new FormData();
      regForm.append("intent", "register_file");
      regForm.append("resourceUrl", target.resourceUrl);
      regForm.append("filename", file.name);

      const regRes = await fetch("", {
        method: "POST",
        body: regForm
      });
      const regData = await regRes.json();

      if (regData.error) {
        shopify.toast.show(`Registry failed: ${regData.error}`);
        setLoading(false);
        return;
      }

      // Add to local clipart images list
      const newImage = {
        id: Date.now().toString(),
        name: name.trim(),
        url: regData.url
      };

      const updatedImages = [...clipartImages, newImage];
      setClipartImages(updatedImages);
      setAssetValue(JSON.stringify(updatedImages));
      setNewClipartName("");
      setNewClipartFile(null);
      
      // Reset the file input DOM if it exists
      const fileInput = document.getElementById("clipart-file-picker") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      shopify.toast.show(`Clipart "${name}" uploaded successfully!`);
    } catch (e: unknown) {
      shopify.toast.show(`Upload error: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveClipart = (id: string) => {
    const updated = clipartImages.filter(img => img.id !== id);
    setClipartImages(updated);
    setAssetValue(JSON.stringify(updated));
  };

  const openAdd = () => {
    setEditingAsset(null);
    setAssetName("");
    if (activeTab === "images") {
      setClipartImages([]);
      setAssetValue("[]");
    } else {
      setAssetValue(
        activeTab === "colors"
          ? "#000000, #FFFFFF, #E63946, #457B9D"
          : activeTab === "options"
          ? "Option A, Option B, Option C"
          : ""
      );
    }
    setShowAddModal(true);
  };

  const openEdit = (asset: typeof assets[number]) => {
    setEditingAsset(asset);
    setAssetName(asset.name);
    setAssetValue(asset.value);
    if (asset.type === "IMAGES") {
      try {
        setClipartImages(JSON.parse(asset.value));
      } catch (e) {
        setClipartImages([]);
      }
    }
    setShowAddModal(true);
  };

  const handleSelectRow = (id: string) => {
    setSelectedAssetIds(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (visibleAssets: { id: string }[]) => {
    const visibleIds = visibleAssets.map(a => a.id);
    const allSelected = visibleIds.every(id => selectedAssetIds.includes(id));

    if (allSelected) {
      setSelectedAssetIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedAssetIds(prev => {
        const next = [...prev];
        visibleIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  // Filtering assets
  const filteredAssets = assets
    .filter(a => a.type === activeTab.toUpperCase())
    .filter(a => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.value.toLowerCase().includes(q);
    });

  // Sorting
  const sortedAssets = [...filteredAssets].sort((a, b) => {
    if (sortBy === "A-Z") {
      return a.name.localeCompare(b.name);
    } else if (sortBy === "Z-A") {
      return b.name.localeCompare(a.name);
    } else {
      // Newest
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedAssets.length / pageSize));
  const paginatedAssets = sortedAssets.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <s-page heading="Assets">
      <style>{`
        /* Tab Filter Bar */
        .assets-tabs {
          display: flex;
          background: #ffffff;
          border-bottom: 1px solid #ebebeb;
          padding: 0 20px;
          gap: 24px;
        }
        .assets-tab-btn {
          background: none;
          border: none;
          padding: 16px 4px;
          font-size: 14px;
          font-weight: 600;
          color: #6d7175;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          outline: none;
        }
        .assets-tab-btn:hover {
          color: #1a1a1a;
        }
        .assets-tab-btn.active {
          color: #1a1a1a;
          border-bottom-color: #1a1a1a;
        }

        /* Card layout wrapper */
        .assets-card-container {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #ebebeb;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
          overflow: hidden;
          margin-top: 20px;
        }

        /* Header toolbar containing sub-tabs or page description & primary button */
        .assets-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #ebebeb;
          background: #ffffff;
        }

        /* Sub-tabs pills */
        .sub-tabs-wrapper {
          display: flex;
          gap: 8px;
        }
        .sub-tab-btn {
          background: #f4f4f5;
          border: none;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 600;
          color: #6d7175;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
        }
        .sub-tab-btn:hover {
          background: #e4e4e7;
          color: #1a1a1a;
        }
        .sub-tab-btn.active {
          background: #1a1a1a;
          color: #ffffff;
        }
        .sub-tab-badge {
          background: rgba(0, 0, 0, 0.06);
          color: #6d7175;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: 700;
        }
        .sub-tab-btn.active .sub-tab-badge {
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }

        /* Toolbar row containing search and sort */
        .assets-toolbar-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          border-bottom: 1px solid #ebebeb;
          background: #ffffff;
          gap: 16px;
        }
        .search-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .search-icon {
          position: absolute;
          left: 12px;
          color: #8c9196;
          display: flex;
          align-items: center;
          pointer-events: none;
        }
        .search-input-field {
          padding: 8px 12px 8px 36px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 13px;
          width: 240px;
          background: #ffffff;
          color: #1a1a1a;
          box-sizing: border-box;
          outline: none;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .search-input-field:focus {
          border-color: #1a1a1a;
          box-shadow: 0 0 0 1px #1a1a1a, 0 0 0 3px rgba(26, 26, 26, 0.15);
        }

        .sort-select-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sort-select-field {
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          color: #202223;
          background: #ffffff;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          transition: all 0.15s;
          outline: none;
        }
        .sort-select-field:hover {
          background-color: #f6f6f7;
          border-color: #94a3b8;
        }

        /* Buttons styling */
        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ffffff;
          color: #202223;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          outline: none;
        }
        .btn-secondary:hover {
          background-color: #f6f6f7;
          border-color: #94a3b8;
        }
        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #1a1a1a;
          color: #ffffff;
          border: 1px solid #1a1a1a;
          border-radius: 6px;
          padding: 8px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          outline: none;
        }
        .btn-primary:hover {
          background-color: #303030;
          border-color: #303030;
        }

        /* Bulk Action Bar */
        .assets-bulk-bar {
          background: #f8fafc;
          border: 1.5px solid #ebebeb;
          border-radius: 8px;
          padding: 12px 18px;
          margin: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
        }
        .assets-bulk-count {
          font-size: 13px;
          font-weight: 600;
          color: #1a1a1a;
        }
        .assets-bulk-btn {
          background: #d82c0d;
          color: #ffffff;
          border: none;
          padding: 8px 14px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .assets-bulk-btn:hover {
          background: #be250a;
        }

        /* Table layout styling */
        .assets-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13px;
        }
        .assets-table th {
          padding: 14px 16px;
          font-weight: 600;
          color: #6d7175;
          background: #fafafa;
          border-bottom: 1px solid #ebebeb;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
          user-select: none;
        }
        .assets-table td {
          padding: 16px;
          border-bottom: 1px solid #f3f3f3;
          color: #202223;
          vertical-align: middle;
        }
        .assets-table tbody tr:hover {
          background: #fcfcfc;
        }
        .checkbox-cell {
          width: 24px;
          padding-right: 0 !important;
          text-align: center;
        }
        .checkbox-input {
          cursor: pointer;
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1px solid #babfc3;
        }

        /* Action button layout in table row */
        .assets-row-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }
        .assets-action-icon-btn {
          background: none;
          border: none;
          color: #6d7175;
          cursor: pointer;
          padding: 6px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .assets-action-icon-btn:hover {
          color: #1a1a1a;
          background: #f1f2f4;
        }
        .assets-action-icon-btn.delete:hover {
          color: #d92d20;
          background: #fde8e8;
        }

        /* Swatch elements inside table */
        .color-swatch-circle {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1.5px solid #d2d5d8;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        /* Form panel styling */
        .form-panel-card {
          border: 1px solid #ebebeb;
          padding: 20px;
          border-radius: 8px;
          background: #ffffff;
          margin: 16px 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        }
        .form-label {
          display: block;
          font-weight: 600;
          font-size: 11px;
          color: #6d7175;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .form-input-text {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 13px;
          background: #ffffff;
          color: #1a1a1a;
          box-sizing: border-box;
          outline: none;
          transition: all 0.15s;
        }
        .form-input-text:focus {
          border-color: #1a1a1a;
          box-shadow: 0 0 0 1px #1a1a1a, 0 0 0 3px rgba(26, 26, 26, 0.15);
        }

        /* Clipart uploader panel */
        .clipart-upload-subcard {
          background: #fafafa;
          border: 1px solid #ebebeb;
          padding: 16px;
          border-radius: 6px;
          margin-bottom: 16px;
        }

        /* Empty state */
        .empty-state-container {
          padding: 60px 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .empty-state-title {
          font-size: 14px;
          font-weight: 700;
          color: #1a1a1a;
          margin-top: 16px;
          margin-bottom: 6px;
          letter-spacing: 0.05em;
        }
        .empty-state-subtitle {
          font-size: 11px;
          font-weight: 600;
          color: #6d7175;
          margin-bottom: 20px;
          letter-spacing: 0.05em;
        }

        /* Pagination footer */
        .assets-pagination-bar {
          padding: 14px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #ebebeb;
          background: #fafafa;
        }
      `}</style>

      <div className="assets-card-container">
        {/* 1. Main Tabs Row */}
        <div className="assets-tabs">
          <button
            type="button"
            className={`assets-tab-btn ${activeTab === "fonts" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("fonts");
              setShowAddModal(false);
            }}
          >
            <FontIcon />
            Font
          </button>
          <button
            type="button"
            className={`assets-tab-btn ${activeTab === "colors" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("colors");
              setShowAddModal(false);
            }}
          >
            <ColorIcon />
            Color
          </button>
          <button
            type="button"
            className={`assets-tab-btn ${activeTab === "images" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("images");
              setShowAddModal(false);
            }}
          >
            <ImageIcon />
            Image
          </button>
          <button
            type="button"
            className={`assets-tab-btn ${activeTab === "options" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("options");
              setShowAddModal(false);
            }}
          >
            <OptionIcon />
            Option
          </button>
        </div>

        {/* 2. Sub-header (Actions & Description) */}
        <div className="assets-card-header">
          <div>
            <span style={{ fontSize: "13px", color: "#6d7175", fontWeight: 500 }}>
              {activeTab === "fonts"
                ? "Upload typography font files (.ttf, .otf, or .woff)."
                : activeTab === "colors"
                ? "Create reusable brand color palettes."
                : activeTab === "images"
                ? "Create reusable clipart graphic collections."
                : "Create Choice Options dropdown items."}
            </span>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            {activeTab === "fonts" ? (
              <button type="button" className="btn-primary" onClick={openAdd}>
                <UploadIcon />
                Upload Font
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={openAdd}>
                <PlusIcon />
                Add {activeTab === "colors" ? "Color Set" : activeTab === "images" ? "Clipart Set" : "Option List"}
              </button>
            )}
          </div>
        </div>

        {/* 3. Secondary Toolbar (Search & Sort) */}
        <div className="assets-toolbar-row">
          <div className="search-input-wrapper">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              type="text"
              className="search-input-field"
              placeholder="Filter search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="sort-select-wrapper">
            <span style={{ fontSize: "13px", color: "#6d7175", fontWeight: 600 }}>Sort by</span>
            <select
              className="sort-select-field"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "A-Z" | "Z-A" | "Newest")}
            >
              <option value="A-Z">A-Z</option>
              <option value="Z-A">Z-A</option>
              <option value="Newest">Newest</option>
            </select>
          </div>
        </div>

        {/* 4. Bulk Action Bar */}
        {selectedAssetIds.length > 0 && (
          <div className="assets-bulk-bar">
            <span className="assets-bulk-count">{selectedAssetIds.length} assets selected</span>
            <button type="button" className="assets-bulk-btn" onClick={handleBulkDelete}>
              Delete Selected
            </button>
          </div>
        )}

        {/* 5. Add / Edit Form Panel */}
        {showAddModal && (
          <div className="form-panel-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                {editingAsset ? "Edit" : "Create"} {activeTab === "fonts" ? "Font Set" : activeTab === "colors" ? "Color Set" : activeTab === "images" ? "Clipart Set" : "Option List"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: "none", border: "none", fontSize: "20px", color: "#8c9196", cursor: "pointer", lineHeight: 1, padding: "4px" }}
              >
                ×
              </button>
            </div>

            {activeTab === "images" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label htmlFor="clipart-set-name-input" className="form-label">Clipart Set Name</label>
                  <input
                    id="clipart-set-name-input"
                    type="text"
                    className="form-input-text"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    placeholder="e.g. Monogram Borders, Sports Decals"
                    required
                  />
                </div>

                {/* Upload sub-form */}
                <div className="clipart-upload-subcard">
                  <span style={{ fontWeight: 700, fontSize: "12px", display: "block", marginBottom: "8px", color: "#1a1a1a" }}>Upload New Clipart Graphic</span>
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "150px" }}>
                      <label htmlFor="new-clipart-name-input" style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "4px", color: "#6d7175" }}>Graphic Name/Label</label>
                      <input
                        id="new-clipart-name-input"
                        type="text"
                        value={newClipartName}
                        onChange={(e) => setNewClipartName(e.target.value)}
                        placeholder="e.g. Golden Frame, Anchor"
                        className="form-input-text"
                        style={{ padding: "6px 10px" }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: "150px" }}>
                      <label htmlFor="clipart-file-picker" style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "4px", color: "#6d7175" }}>Image File</label>
                      <input
                        id="clipart-file-picker"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setNewClipartFile(e.target.files?.[0] || null)}
                        style={{ width: "100%", fontSize: "12px" }}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={loading || !newClipartFile || !newClipartName.trim()}
                      onClick={() => {
                        if (newClipartFile) {
                          handleSingleClipartUpload(newClipartFile, newClipartName);
                        }
                      }}
                      style={{
                        padding: "8px 14px",
                        background: "#1a1a1a",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        cursor: "pointer",
                        fontWeight: 600
                      }}
                    >
                      {loading ? "Uploading..." : "Upload Clipart"}
                    </button>
                  </div>
                </div>

                {/* Grid of uploaded clipart images */}
                {clipartImages.length > 0 && (
                  <div style={{ marginTop: "4px", marginBottom: "12px" }}>
                    <label className="form-label">Uploaded Graphics ({clipartImages.length})</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "8px", maxHeight: "180px", overflowY: "auto", padding: "8px", border: "1px solid #ebebeb", borderRadius: "6px", background: "#ffffff" }}>
                      {clipartImages.map((img) => (
                        <div key={img.id} style={{ position: "relative", border: "1px solid #ebebeb", borderRadius: "6px", padding: "6px", textAlign: "center", background: "#fafafa" }}>
                          <img src={img.url} alt={img.name} style={{ height: "45px", width: "100%", objectFit: "contain" }} />
                          <div style={{ fontSize: "10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "4px 2px 0 2px", color: "#202223", fontWeight: 500 }}>{img.name}</div>
                          <button
                            type="button"
                            onClick={() => handleRemoveClipart(img.id)}
                            style={{
                              position: "absolute",
                              top: "2px",
                              right: "2px",
                              background: "rgba(216,44,13,0.9)",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "50%",
                              width: "16px",
                              height: "16px",
                              fontSize: "10px",
                              lineHeight: "14px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={loading || !assetName.trim()}
                    className="btn-primary"
                  >
                    Save Clipart Set
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : activeTab === "fonts" && !editingAsset ? (
              /* Font File Upload Form */
              <form onSubmit={handleFontUpload} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label htmlFor="typography-name-input" className="form-label">Typography Name</label>
                  <input
                    id="typography-name-input"
                    type="text"
                    className="form-input-text"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    placeholder="e.g. Cursive Elegant, Retro Bold"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="font-file-input" className="form-label">Font File (.ttf, .otf, or .woff)</label>
                  <input
                    id="font-file-input"
                    type="file"
                    accept=".ttf,.otf,.woff"
                    onChange={(e) => setFontFile(e.target.files?.[0] || null)}
                    required
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? "Uploading to Shopify CDN..." : "Upload Font & Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              /* Standard asset forms (Edit Font, Colors, Options) */
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label htmlFor="asset-name-input" className="form-label">Asset Name</label>
                  <input
                    id="asset-name-input"
                    type="text"
                    className="form-input-text"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    placeholder={activeTab === "colors" ? "e.g. Vintage Leather, Pastels" : "e.g. US Sizes, Length Tiers"}
                  />
                </div>
                <div>
                  <label htmlFor="asset-value-input" className="form-label">
                    {activeTab === "colors" ? "Colors List (comma-separated Hex values)" : "Options (comma-separated list)"}
                  </label>
                  <input
                    id="asset-value-input"
                    type="text"
                    className="form-input-text"
                    value={assetValue}
                    onChange={(e) => setAssetValue(e.target.value)}
                    placeholder={activeTab === "colors" ? "#000000, #E63946, #457B9D" : "Small, Medium, Large"}
                  />
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? "Saving..." : "Save Asset"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 6. List / Table View */}
        {paginatedAssets.length === 0 ? (
          <div className="empty-state-container">
            <DocumentEmptyGraphic />
            <h3 className="empty-state-title">
              {activeTab === "fonts"
                ? "NO UPLOADED FONT FOUND"
                : activeTab === "colors"
                ? "NO COLOR PALETTE FOUND"
                : activeTab === "images"
                ? "NO CLIPART GRAPHICS FOUND"
                : "NO CHOICE OPTIONS FOUND"}
            </h3>
            <p className="empty-state-subtitle">
              {activeTab === "fonts"
                ? "CLICK THE BELOW BUTTON TO UPLOAD FONTS"
                : activeTab === "colors"
                ? "CLICK THE BELOW BUTTON TO ADD COLOR PALETTES"
                : activeTab === "images"
                ? "CLICK THE BELOW BUTTON TO UPLOAD GRAPHICS"
                : "CLICK THE BELOW BUTTON TO ADD CHOICE OPTIONS"}
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={openAdd}
              style={{ display: "inline-flex" }}
            >
              {activeTab === "fonts"
                ? "Upload Font"
                : `Add ${activeTab === "colors" ? "Color Set" : activeTab === "images" ? "Clipart Set" : "Option List"}`}
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="assets-table">
              <thead>
                <tr>
                  <th className="checkbox-cell" style={{ width: "40px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      className="checkbox-input"
                      checked={paginatedAssets.length > 0 && paginatedAssets.every(a => selectedAssetIds.includes(a.id))}
                      onChange={() => handleSelectAll(paginatedAssets)}
                    />
                  </th>
                  {activeTab === "fonts" ? (
                    <>
                      <th>Font title</th>
                      <th>Font style</th>
                    </>
                  ) : activeTab === "colors" ? (
                    <>
                      <th>Palette name</th>
                      <th>Colors</th>
                    </>
                  ) : activeTab === "images" ? (
                    <>
                      <th>Clipart set name</th>
                      <th>Graphics preview</th>
                    </>
                  ) : (
                    <>
                      <th>Option list name</th>
                      <th>Values</th>
                    </>
                  )}
                  <th style={{ width: "120px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssets.map(asset => {
                  let parsedValue: { url: string; format: string } | null = null;
                  if (asset.type === "FONTS") {
                    try {
                      parsedValue = JSON.parse(asset.value);
                    } catch {
                      parsedValue = null;
                    }
                  }

                  return (
                    <tr key={asset.id}>
                      <td className="checkbox-cell" style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          className="checkbox-input"
                          checked={selectedAssetIds.includes(asset.id)}
                          onChange={() => handleSelectRow(asset.id)}
                        />
                      </td>

                      {/* Type-specific columns */}
                      {asset.type === "FONTS" && (
                        <>
                          <td style={{ fontWeight: 600 }}>{asset.name}</td>
                          <td>
                            {parsedValue && (
                              <>
                                <style dangerouslySetInnerHTML={{
                                  __html: `@font-face { font-family: "${asset.name}"; src: url("${parsedValue.url}") format("${parsedValue.format}"); }`
                                }} />
                                <div style={{
                                  fontFamily: `"${asset.name}", sans-serif`,
                                  fontSize: "20px",
                                  border: "1px dashed #e1e3e5",
                                  borderRadius: "4px",
                                  padding: "4px 12px",
                                  display: "inline-block",
                                  background: "#fafafa"
                                }}>
                                  Elegant Calligraphy
                                </div>
                              </>
                            )}
                          </td>
                        </>
                      )}

                      {asset.type === "COLORS" && (
                        <>
                          <td style={{ fontWeight: 600 }}>{asset.name}</td>
                          <td>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {asset.value.split(",").map((c: string, idx: number) => {
                                const hex = c.trim();
                                return (
                                  <div
                                    key={idx}
                                    className="color-swatch-circle"
                                    style={{ background: hex }}
                                    title={hex}
                                  />
                                );
                              })}
                            </div>
                          </td>
                        </>
                      )}

                      {asset.type === "OPTIONS" && (
                        <>
                          <td style={{ fontWeight: 600 }}>{asset.name}</td>
                          <td>
                            <select style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", maxWidth: "200px" }}>
                              {asset.value.split(",").map((opt: string, idx: number) => (
                                <option key={idx}>{opt.trim()}</option>
                              ))}
                            </select>
                          </td>
                        </>
                      )}

                      {asset.type === "IMAGES" && (
                        <>
                          <td style={{ fontWeight: 600 }}>{asset.name}</td>
                          <td>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {(() => {
                                try {
                                  const imgs = JSON.parse(asset.value) as Array<{ id: string; name: string; url: string }>;
                                  if (!Array.isArray(imgs) || imgs.length === 0) return <span style={{ color: "#6d7175", fontStyle: "italic", fontSize: "12px" }}>No graphics yet</span>;
                                  return imgs.slice(0, 8).map((img) => (
                                    <div
                                      key={img.id}
                                      style={{
                                        border: "1px solid #ebebeb",
                                        borderRadius: "4px",
                                        padding: "2px",
                                        background: "#ffffff",
                                        display: "inline-flex"
                                      }}
                                    >
                                      <img
                                        src={img.url}
                                        alt={img.name}
                                        style={{ width: "30px", height: "30px", objectFit: "contain" }}
                                        title={img.name}
                                      />
                                    </div>
                                  ));
                                } catch (e) {
                                  return <span style={{ color: "#d93838", fontSize: "12px" }}>Error parsing clipart</span>;
                                }
                              })()}
                            </div>
                          </td>
                        </>
                      )}

                      <td style={{ textAlign: "right" }}>
                        <div className="assets-row-actions">
                          {asset.type !== "FONTS" && (
                            <button
                              type="button"
                              className="assets-action-icon-btn"
                              onClick={() => openEdit(asset)}
                              title="Edit asset"
                            >
                              <EditIcon />
                            </button>
                          )}
                          <button
                            type="button"
                            className="assets-action-icon-btn delete"
                            onClick={() => handleDelete(asset.id)}
                            title="Delete asset"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 7. Pagination Footer */}
        {sortedAssets.length > 0 && (
          <div className="assets-pagination-bar">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#6d7175" }}>
              Show:
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{ padding: "4px 8px", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer" }}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>

            <div style={{ fontSize: "13px", fontWeight: 600, color: "#202223" }}>
              Showing {Math.min(sortedAssets.length, (currentPage - 1) * pageSize + 1)} - {Math.min(sortedAssets.length, currentPage * pageSize)} of {sortedAssets.length} results
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  width: "32px",
                  height: "32px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  opacity: currentPage === 1 ? 0.4 : 1,
                  color: "#202223",
                  outline: "none"
                }}
              >
                &lt;
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  width: "32px",
                  height: "32px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                  opacity: currentPage === totalPages ? 0.4 : 1,
                  color: "#202223",
                  outline: "none"
                }}
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>
    </s-page>
  );
}
