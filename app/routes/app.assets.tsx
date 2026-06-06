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
    } catch (e: any) {
      return { error: e.message || "Failed to create upload staging target" };
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
    } catch (e: any) {
      return { error: e.message || "File registry failed" };
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
    return { success: true, deleted: id };
  }

  return { error: "Unknown intent" };
};

export default function AssetsDirectory() {
  const { assets } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<any>();
  const shopify = useAppBridge();

  const [activeTab, setActiveTab] = useState<"fonts" | "colors" | "options" | "images">("fonts");
  const [loading, setLoading] = useState(false);

  // Forms states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [assetName, setAssetName] = useState("");
  const [assetValue, setAssetValue] = useState(""); // JSON or string depending on type

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
      shopify.toast.show("Asset directory updated successfully!");
    } else if (fetcher.data?.error) {
      setLoading(false);
      shopify.toast.show(`Error: ${fetcher.data.error}`);
    }
  }, [fetcher.data, shopify]);

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
    } catch (e: any) {
      shopify.toast.show(`Upload error: ${e.message}`);
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

  const openEdit = (asset: any) => {
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

  const filteredAssets = assets.filter(a => a.type === activeTab.toUpperCase());

  return (
    <s-page heading="Assets Directory">
      <s-section heading="Manage Global Brand Assets">
        <s-paragraph>
          Create reusable font sets, color palettes, and select choices dropdown options. Modifying an asset here instantly propagates the update to all personalization customizers referencing it across your Shopify storefront.
        </s-paragraph>

        {/* Tab Headers */}
        <div className="tab-bar">
          {(["fonts", "colors", "options", "images"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setShowAddModal(false);
              }}
              className={`tab-item ${activeTab === tab ? "active" : ""}`}
            >
              {tab === "fonts" ? "🔤 Font Sets" : tab === "colors" ? "🎨 Color Palettes" : tab === "images" ? "🖼️ Clipart Graphics" : "📋 Choice Options"}
            </button>
          ))}
        </div>

        {/* Action Button */}
        <div className="flex justify-end" style={{ marginBottom: "16px" }}>
          <button
            onClick={openAdd}
            className="btn-primary"
          >
            ➕ Add {activeTab === "fonts" ? "Font" : activeTab === "colors" ? "Color Set" : activeTab === "images" ? "Clipart Set" : "Option List"}
          </button>
        </div>

        {/* Modal Interface */}
        {showAddModal && (
          <div className="inline-card">
            <h3 className="inline-card-title">
              {editingAsset ? "🔧 Edit" : "➕ Create"} {activeTab === "fonts" ? "Font Set" : activeTab === "colors" ? "Color Set" : activeTab === "images" ? "Clipart Set" : "Option List"}
            </h3>

            {activeTab === "images" ? (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="form-label">Clipart Set Name</label>
                  <input
                    type="text"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    className="form-input"
                    placeholder="e.g. Monogram Borders, Sports Decals"
                    required
                  />
                </div>

                {/* Upload sub-form */}
                <div className="sub-card">
                  <span className="sub-card-title">🖼️ Upload New Clipart Graphic</span>
                  <div className="flex gap-3 align-end">
                    <div className="flex-1">
                      <label className="form-label-sm">Graphic Name/Label</label>
                      <input
                        type="text"
                        value={newClipartName}
                        onChange={(e) => setNewClipartName(e.target.value)}
                        placeholder="e.g. Golden Frame, Anchor"
                        className="form-input-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="form-label-sm">Image File</label>
                      <input
                        id="clipart-file-picker"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setNewClipartFile(e.target.files?.[0] || null)}
                        className="form-input-sm"
                        style={{ background: "transparent", border: "none", padding: "0" }}
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
                      className="btn-sm-dark"
                    >
                      {loading ? "Uploading..." : "Upload Clipart"}
                    </button>
                  </div>
                </div>

                {/* Grid of uploaded clipart images */}
                {clipartImages.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <label className="form-label-sm" style={{ fontSize: "12px", marginBottom: "6px" }}>Uploaded Graphics ({clipartImages.length})</label>
                    <div className="graphics-grid">
                      {clipartImages.map((img) => (
                        <div key={img.id} className="graphic-item-card">
                          <img src={img.url} alt={img.name} className="graphic-item-img" />
                          <div className="graphic-item-label">{img.name}</div>
                          <button
                            type="button"
                            onClick={() => handleRemoveClipart(img.id)}
                            className="graphic-item-delete"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2" style={{ marginTop: "10px" }}>
                  <button
                    onClick={handleSave}
                    disabled={loading || !assetName.trim()}
                    className="btn-primary"
                  >
                    Save Clipart Set
                  </button>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : activeTab === "fonts" && !editingAsset ? (
              // Font File Upload Form
              <form onSubmit={handleFontUpload} className="flex flex-col gap-3">
                <div>
                  <label className="form-label">Typography Name</label>
                  <input
                    type="text"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    className="form-input"
                    placeholder="e.g. Cursive Elegant, Retro Bold"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Font File (.ttf, .otf, or .woff)</label>
                  <input
                    type="file"
                    accept=".ttf,.otf,.woff"
                    onChange={(e) => setFontFile(e.target.files?.[0] || null)}
                    required
                    className="form-input"
                  />
                </div>
                <div className="flex gap-2" style={{ marginTop: "10px" }}>
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
              // Standard asset forms
              <div className="flex flex-col gap-3">
                <div>
                  <label className="form-label">Asset Name</label>
                  <input
                    type="text"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    className="form-input"
                    placeholder={activeTab === "colors" ? "e.g. Vintage Leather, Pastels" : "e.g. US Sizes, Length Tiers"}
                  />
                </div>
                <div>
                  <label className="form-label">
                    {activeTab === "colors" ? "Colors List (comma-separated Hex values)" : "Options (comma-separated list)"}
                  </label>
                  <input
                    type="text"
                    value={assetValue}
                    onChange={(e) => setAssetValue(e.target.value)}
                    className="form-input"
                    placeholder={activeTab === "colors" ? "#000000, #E63946, #457B9D" : "Small, Medium, Large"}
                  />
                </div>
                <div className="flex gap-2" style={{ marginTop: "10px" }}>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? "Saving..." : "Save Asset"}
                  </button>
                  <button
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

        {/* Directory Listing */}
        {filteredAssets.length === 0 ? (
          <div className="empty-placeholder">
            No assets created yet in this category. Click "Add" to upload/define your first global asset set.
          </div>
        ) : (
          <div className="assets-grid">
            {filteredAssets.map(asset => {
              let parsedValue: any = null;
              if (asset.type === "FONTS") {
                try {
                  parsedValue = JSON.parse(asset.value);
                } catch (e) {}
              }

              return (
                <div key={asset.id} className="asset-card">
                  <div>
                    <div className="flex justify-between align-center" style={{ marginBottom: "8px" }}>
                      <span className="asset-card-title">{asset.name}</span>
                      <button
                        onClick={() => handleDelete(asset.id)}
                        className="btn-delete-link"
                      >
                        🗑️ Delete
                      </button>
                    </div>

                    {asset.type === "FONTS" && parsedValue && (
                      <div style={{ margin: "8px 0" }}>
                        <div className="font-meta">
                          CDN Format: <code>{parsedValue.format}</code>
                        </div>
                        {/* Dynamic font stylesheet helper to let merchant preview the font inside the admin directly! */}
                        <style dangerouslySetInnerHTML={{
                          __html: `@font-face { font-family: "${asset.name}"; src: url("${parsedValue.url}") format("${parsedValue.format}"); }`
                        }} />
                        <div
                          className="font-preview-box"
                          style={{ fontFamily: `"${asset.name}", sans-serif` }}
                        >
                          Elegant Calligraphy
                        </div>
                      </div>
                    )}

                    {asset.type === "COLORS" && (
                      <div className="color-swatch-list">
                        {asset.value.split(",").map((c: string, idx: number) => {
                          const hex = c.trim();
                          return (
                            <div
                              key={idx}
                              className="color-swatch-item"
                              style={{ background: hex }}
                              title={hex}
                            />
                          );
                        })}
                      </div>
                    )}

                    {asset.type === "OPTIONS" && (
                      <div style={{ margin: "8px 0" }}>
                        <select className="options-select">
                          {asset.value.split(",").map((opt: string, idx: number) => (
                            <option key={idx}>{opt.trim()}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {asset.type === "IMAGES" && (
                      <div className="clipart-preview-grid">
                        {(() => {
                          try {
                            const imgs = JSON.parse(asset.value);
                            if (!Array.isArray(imgs) || imgs.length === 0) return <div className="font-meta" style={{ fontStyle: "italic" }}>No graphics yet</div>;
                            return imgs.slice(0, 8).map((img: any) => (
                              <div key={img.id} className="clipart-preview-item">
                                <img
                                  src={img.url}
                                  alt={img.name}
                                  className="clipart-preview-img"
                                  title={img.name}
                                />
                              </div>
                            ));
                          } catch (e) {
                            return <div className="font-meta" style={{ color: "#d93838" }}>Error parsing clipart</div>;
                          }
                        })()}
                      </div>
                    )}
                  </div>

                  {asset.type !== "FONTS" && (
                    <div className="asset-card-footer">
                      <button
                        onClick={() => openEdit(asset)}
                        className="btn-edit-link"
                      >
                        ✏️ Edit {asset.type === "IMAGES" ? "Graphics" : "List"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </s-section>
    </s-page>
  );
}
