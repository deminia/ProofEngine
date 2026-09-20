import { useEffect, useState } from "react";
import { api } from "../api";
import { toast } from "../components/Toast.jsx";

export default function Assets() {
  const [tree, setTree] = useState(null);
  const [browse, setBrowse] = useState(null);
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTree(); }, []);

  async function loadTree() {
    try { setTree(await api.getAssetTree()); } catch (e) { toast("Error: " + e.message); }
    setLoading(false);
  }

  async function loadBrowse(p) {
    setPath(p);
    try { setBrowse(await api.browseAssets(p)); } catch (e) { toast("Error: " + e.message); }
  }

  async function handleUpload(e, dest) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await api.uploadAsset(dest, file);
      toast("✅ Uploaded");
      loadBrowse(path);
      loadTree();
    } catch (err) { toast("Upload error: " + err.message); }
  }

  async function handleDelete(filePath) {
    if (!confirm("Delete this file?")) return;
    try {
      await api.deleteAsset(filePath);
      toast("🗑 Deleted");
      loadBrowse(path);
      loadTree();
    } catch (err) { toast("Error: " + err.message); }
  }

  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  if (loading) return <div className="meta" style={{ padding: 40 }}>Loading…</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h2>📁 Assets / Media Library</h2>

      {/* Summary cards */}
      {tree && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
          {Object.entries(tree).map(([dir, info]) => (
            <div key={dir} onClick={() => loadBrowse(dir)}
              style={{
                padding: "12px 18px", background: "rgba(255,255,255,0.06)", borderRadius: 8,
                border: path === dir ? "2px solid #7c83ff" : "1px solid rgba(255,255,255,0.1)",
                cursor: "pointer", minWidth: 120,
              }}>
              <div style={{ fontWeight: 700 }}>{dir}</div>
              <div className="meta">{info.files} files • {fmtSize(info.size_bytes)}</div>
            </div>
          ))}
        </div>
      )}

      {/* File browser */}
      {browse && (
        <div style={{ marginTop: 24, padding: 20, background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <h3>📂 {browse.path || "(root)"}</h3>
            {browse.path && <button className="secondary" onClick={() => loadBrowse("")}>↑ Back</button>}
            <label style={{ marginLeft: "auto" }} className="secondary" title="Upload file">
              📤 Upload
              <input type="file" style={{ display: "none" }} onChange={e => handleUpload(e, browse.path)} />
            </label>
          </div>

          {/* Subdirectories */}
          {(browse.dirs || []).map(d => (
            <div key={d.name} onClick={() => loadBrowse(browse.path ? `${browse.path}/${d.name}` : d.name)}
              style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              📁 {d.name} <span className="meta">({d.count} items)</span>
            </div>
          ))}

          {/* Files */}
          {(browse.files || []).map(f => (
            <div key={f.name} style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ flex: 1 }}>📄 {f.name}</span>
              <span className="meta" style={{ marginRight: 12 }}>{fmtSize(f.size)}</span>
              <a href={`/media/${browse.path ? browse.path + "/" : ""}${f.name}`} target="_blank" rel="noreferrer"
                style={{ marginRight: 8, fontSize: 12, color: "#7c83ff" }}>View</a>
              <button className="danger" style={{ fontSize: 11, padding: "2px 8px" }}
                onClick={() => handleDelete(browse.path ? `${browse.path}/${f.name}` : f.name)}>✗</button>
            </div>
          ))}

          {(!browse.files?.length && !browse.dirs?.length) && (
            <div className="meta" style={{ padding: 20, textAlign: "center" }}>Empty directory</div>
          )}
        </div>
      )}
    </div>
  );
}
