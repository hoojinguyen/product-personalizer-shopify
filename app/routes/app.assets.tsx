import { useLoaderData, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
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
      const response = await admin.graphql(
        `#graphql
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters {
                name
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            input: [
              {
                filename,
                httpMethod: "POST",
                mimeType,
                resource: "FILE",
                fileSize,
              },
            ],
          },
        }
      );

      const responseJson = await response.json();
      const target = responseJson.data?.stagedUploadsCreate?.stagedTargets?.[0];
      const errors = responseJson.data?.stagedUploadsCreate?.userErrors || [];

      if (errors.length > 0) {
        return { error: errors[0].message };
      }

      return { success: true, target };
    } catch (e: any) {
      return { error: e.message || "Failed to create upload staging target" };
    }
  }

  if (intent === "register_file") {
    const resourceUrl = formData.get("resourceUrl") as string;
    const filename = formData.get("filename") as string;

    try {
      const fileCreateResponse = await admin.graphql(
        `#graphql
        mutation fileCreate($files: [FileCreateInput!]!) {
          fileCreate(files: $files) {
            files {
              id
              fileStatus
              ... on GenericFile {
                url
              }
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            files: [
              {
                originalSource: resourceUrl,
                contentType: "FILE",
                filename,
              },
            ],
          },
        }
      );

      const fileCreateJson = await fileCreateResponse.json();
      const fileRecord = fileCreateJson.data?.fileCreate?.files?.[0];
      const createErrors = fileCreateJson.data?.fileCreate?.userErrors || [];

      if (createErrors.length > 0) {
        return { error: createErrors[0].message };
      }

      // Proactively poll to resolve public CDN URL
      let finalUrl = fileRecord?.url;
      let pollCount = 0;

      while (pollCount < 5 && !finalUrl && fileRecord?.id) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const checkResponse = await admin.graphql(
          `#graphql
          query getFile($id: ID!) {
            node(id: $id) {
              ... on GenericFile {
                url
              }
            }
          }`,
          { variables: { id: fileRecord.id } }
        );
        const checkJson = await checkResponse.json();
        finalUrl = checkJson.data?.node?.url;
        pollCount++;
      }

      return { success: true, url: finalUrl || resourceUrl };
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
        <div style={{ display: "flex", borderBottom: "1px solid #e1e3e5", margin: "16px 0", gap: "20px" }}>
          {(["fonts", "colors", "options", "images"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setShowAddModal(false);
              }}
              style={{
                background: "none",
                border: "none",
                padding: "12px 6px",
                fontSize: "14px",
                fontWeight: 600,
                color: activeTab === tab ? "#008060" : "#6d7175",
                borderBottom: activeTab === tab ? "3px solid #008060" : "3px solid transparent",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              {tab === "fonts" ? "🔤 Font Sets" : tab === "colors" ? "🎨 Color Palettes" : tab === "images" ? "🖼️ Clipart Graphics" : "📋 Choice Options"}
            </button>
          ))}
        </div>

        {/* Action Button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
          <button
            onClick={openAdd}
            style={{
              padding: "8px 16px",
              background: "#008060",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            ➕ Add {activeTab === "fonts" ? "Font" : activeTab === "colors" ? "Color Set" : activeTab === "images" ? "Clipart Set" : "Option List"}
          </button>
        </div>

        {/* Modal Interface */}
        {showAddModal && (
          <div style={{ border: "1px solid #e1e3e5", padding: "20px", borderRadius: "10px", background: "#f9fafb", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>
              {editingAsset ? "🔧 Edit" : "➕ Create"} {activeTab === "fonts" ? "Font Set" : activeTab === "colors" ? "Color Set" : activeTab === "images" ? "Clipart Set" : "Option List"}
            </h3>

            {activeTab === "images" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Clipart Set Name</label>
                  <input
                    type="text"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3", background: "#fff" }}
                    placeholder="e.g. Monogram Borders, Sports Decals"
                    required
                  />
                </div>

                {/* Upload sub-form */}
                <div style={{ background: "#fff", border: "1px solid #e1e3e5", padding: "12px", borderRadius: "8px", marginTop: "8px" }}>
                  <span style={{ fontWeight: 700, fontSize: "12px", display: "block", marginBottom: "8px", color: "#2c3e50" }}>🖼️ Upload New Clipart Graphic</span>
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "2px" }}>Graphic Name/Label</label>
                      <input
                        type="text"
                        value={newClipartName}
                        onChange={(e) => setNewClipartName(e.target.value)}
                        placeholder="e.g. Golden Frame, Anchor"
                        style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #babfc3" }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 600, marginBottom: "2px" }}>Image File</label>
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
                        padding: "6px 12px",
                        background: "#2c3e50",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
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
                  <div style={{ marginTop: "12px" }}>
                    <label style={{ display: "block", fontWeight: 600, fontSize: "12px", marginBottom: "6px" }}>Uploaded Graphics ({clipartImages.length})</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "8px", maxHeight: "180px", overflowY: "auto", padding: "6px", border: "1px solid #e1e3e5", borderRadius: "6px", background: "#fff" }}>
                      {clipartImages.map((img) => (
                        <div key={img.id} style={{ position: "relative", border: "1px solid #e1e3e5", borderRadius: "4px", padding: "4px", textAlign: "center", background: "#fafafa" }}>
                          <img src={img.url} alt={img.name} style={{ height: "45px", width: "100%", objectFit: "contain" }} />
                          <div style={{ fontSize: "10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 2px", color: "#2c3e50" }}>{img.name}</div>
                          <button
                            type="button"
                            onClick={() => handleRemoveClipart(img.id)}
                            style={{
                              position: "absolute",
                              top: "2px",
                              right: "2px",
                              background: "rgba(217,56,56,0.9)",
                              color: "#fff",
                              border: "none",
                              borderRadius: "50%",
                              width: "14px",
                              height: "14px",
                              fontSize: "10px",
                              lineHeight: "12px",
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
                    onClick={handleSave}
                    disabled={loading || !assetName.trim()}
                    style={{ padding: "8px 16px", background: "#008060", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Save Clipart Set
                  </button>
                  <button
                    onClick={() => setShowAddModal(false)}
                    style={{ padding: "8px 16px", background: "#e1e3e5", color: "#2c3e50", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : activeTab === "fonts" && !editingAsset ? (
              // Font File Upload Form
              <form onSubmit={handleFontUpload} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Typography Name</label>
                  <input
                    type="text"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3", background: "#fff" }}
                    placeholder="e.g. Cursive Elegant, Retro Bold"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Font File (.ttf, .otf, or .woff)</label>
                  <input
                    type="file"
                    accept=".ttf,.otf,.woff"
                    onChange={(e) => setFontFile(e.target.files?.[0] || null)}
                    required
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "#fff" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ padding: "8px 16px", background: "#008060", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}
                  >
                    {loading ? "Uploading to Shopify CDN..." : "Upload Font & Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    style={{ padding: "8px 16px", background: "#e1e3e5", color: "#2c3e50", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              // Standard asset forms
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Asset Name</label>
                  <input
                    type="text"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3", background: "#fff" }}
                    placeholder={activeTab === "colors" ? "e.g. Vintage Leather, Pastels" : "e.g. US Sizes, Length Tiers"}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                    {activeTab === "colors" ? "Colors List (comma-separated Hex values)" : "Options (comma-separated list)"}
                  </label>
                  <input
                    type="text"
                    value={assetValue}
                    onChange={(e) => setAssetValue(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #babfc3", background: "#fff" }}
                    placeholder={activeTab === "colors" ? "#000000, #E63946, #457B9D" : "Small, Medium, Large"}
                  />
                </div>
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    style={{ padding: "8px 16px", background: "#008060", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}
                  >
                    {loading ? "Saving..." : "Save Asset"}
                  </button>
                  <button
                    onClick={() => setShowAddModal(false)}
                    style={{ padding: "8px 16px", background: "#e1e3e5", color: "#2c3e50", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}
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
          <div style={{ padding: "40px", border: "1px dashed #babfc3", borderRadius: "8px", textAlign: "center", color: "#6d7175" }}>
            No assets created yet in this category. Click "Add" to upload/define your first global asset set.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
            {filteredAssets.map(asset => {
              let parsedValue: any = null;
              if (asset.type === "FONTS") {
                try {
                  parsedValue = JSON.parse(asset.value);
                } catch (e) {}
              }

              return (
                <div
                  key={asset.id}
                  style={{
                    border: "1px solid #e1e3e5",
                    borderRadius: "8px",
                    padding: "16px",
                    background: "#ffffff",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.01)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontWeight: 700, fontSize: "15px", color: "#2c3e50" }}>{asset.name}</span>
                      <button
                        onClick={() => handleDelete(asset.id)}
                        style={{ background: "none", border: "none", color: "#d93838", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}
                      >
                        🗑️ Delete
                      </button>
                    </div>

                    {asset.type === "FONTS" && parsedValue && (
                      <div style={{ margin: "8px 0" }}>
                        <div style={{ fontSize: "11px", color: "#6d7175", wordBreak: "break-all" }}>
                          CDN Format: <code>{parsedValue.format}</code>
                        </div>
                        {/* Dynamic font stylesheet helper to let merchant preview the font inside the admin directly! */}
                        <style dangerouslySetInnerHTML={{
                          __html: `@font-face { font-family: "${asset.name}"; src: url("${parsedValue.url}") format("${parsedValue.format}"); }`
                        }} />
                        <div style={{
                          fontFamily: `"${asset.name}", sans-serif`,
                          fontSize: "24px",
                          marginTop: "8px",
                          padding: "6px",
                          border: "1px dashed #e1e3e5",
                          borderRadius: "4px",
                          textAlign: "center"
                        }}>
                          Elegant Calligraphy
                        </div>
                      </div>
                    )}

                    {asset.type === "COLORS" && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "8px 0" }}>
                        {asset.value.split(",").map((c: string, idx: number) => {
                          const hex = c.trim();
                          return (
                            <div
                              key={idx}
                              style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "50%",
                                border: "1px solid #d2d5d8",
                                background: hex
                              }}
                              title={hex}
                            />
                          );
                        })}
                      </div>
                    )}

                    {asset.type === "OPTIONS" && (
                      <div style={{ margin: "8px 0" }}>
                        <select style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #babfc3", background: "#f9fafb" }}>
                          {asset.value.split(",").map((opt: string, idx: number) => (
                            <option key={idx}>{opt.trim()}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {asset.type === "IMAGES" && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", margin: "8px 0" }}>
                        {(() => {
                          try {
                            const imgs = JSON.parse(asset.value);
                            if (!Array.isArray(imgs) || imgs.length === 0) return <div style={{ fontSize: "11px", color: "#6d7175", fontStyle: "italic" }}>No graphics yet</div>;
                            return imgs.slice(0, 8).map((img: any) => (
                              <div
                                key={img.id}
                                style={{
                                  border: "1px solid #e1e3e5",
                                  borderRadius: "4px",
                                  padding: "2px",
                                  textAlign: "center",
                                  background: "#fdfdfd"
                                }}
                              >
                                <img
                                  src={img.url}
                                  alt={img.name}
                                  style={{ width: "100%", height: "35px", objectFit: "contain" }}
                                  title={img.name}
                                />
                              </div>
                            ));
                          } catch (e) {
                            return <div style={{ fontSize: "11px", color: "#d93838" }}>Error parsing clipart</div>;
                          }
                        })()}
                      </div>
                    )}
                  </div>

                  {asset.type !== "FONTS" && (
                    <div style={{ marginTop: "12px", borderTop: "1px solid #f1f2f4", paddingTop: "8px", display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => openEdit(asset)}
                        style={{ background: "none", border: "none", color: "#008060", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}
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
