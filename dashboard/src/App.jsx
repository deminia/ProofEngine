import { useState, useEffect } from "react";
import Queue from "./pages/Queue.jsx";
import Scripts from "./pages/Scripts.jsx";
import Videos from "./pages/Videos.jsx";
import Calendar from "./pages/Calendar.jsx";
import Analytics from "./pages/Analytics.jsx";
import Prompts from "./pages/Prompts.jsx";
import System from "./pages/System.jsx";
import Settings from "./pages/Settings.jsx";
import Assets from "./pages/Assets.jsx";
import Toast from "./components/Toast.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { NicheProvider, useNiche } from "./context/NicheContext.jsx";
import { LanguageProvider, useLanguage } from "./context/LanguageContext.jsx";

const TAB_DEFS = [
  { id: "queue", key: "tab_queue", defaultLabel: "📥 Queue" },
  { id: "scripts", key: "tab_scripts", defaultLabel: "✍️ Scripts" },
  { id: "videos", key: "tab_videos", defaultLabel: "🎬 Videos" },
  { id: "calendar", key: "tab_calendar", defaultLabel: "📅 Calendar" },
  { id: "analytics", key: "tab_analytics", defaultLabel: "📊 Analytics" },
  { id: "assets", key: "tab_assets", defaultLabel: "🎨 Assets" },
  { id: "prompts", key: "tab_prompts", defaultLabel: "📝 Prompts" },
  { id: "system", key: "tab_system", defaultLabel: "🖥️ System" },
  { id: "settings", key: "tab_settings", defaultLabel: "⚙️ Settings" },
];

function AppContent() {
  const [tab, setTab] = useState("queue");
  const { niche } = useNiche();
  const { lang, setLang, t } = useLanguage();

  const tabs = TAB_DEFS.map((d) => ({
    id: d.id,
    label: t(d.key, d.defaultLabel),
  }));

  useEffect(() => {
    const tabObj = tabs.find((t) => t.id === tab);
    const tabName = tabObj ? tabObj.label.replace(/^[^\p{L}\p{N}]+\s*/u, "") : "Dashboard";
    document.title = niche?.name
      ? `ProofEngine — ${niche.name} | ${tabName}`
      : `ProofEngine — ${tabName}`;
  }, [tab, niche, lang, tabs]);

  return (
    <div className="layout">
      <Toast />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-header">
            <div className="brand-title">⚡ ProofEngine</div>
            <div className="lang-toggle" role="group" aria-label="Language selection">
              <button
                type="button"
                className={`lang-btn ${lang === "en" ? "active" : ""}`}
                onClick={() => setLang("en")}
                title="Switch to English"
              >
                EN
              </button>
              <button
                type="button"
                className={`lang-btn ${lang === "th" ? "active" : ""}`}
                onClick={() => setLang("th")}
                title="เปลี่ยนเป็นภาษาไทย"
              >
                TH
              </button>
            </div>
          </div>
          <div className="brand-sub">
            {niche ? `${niche.name} (${niche.id})` : t("brand_sub_default", "Short-form Automation")}
          </div>
        </div>
        <nav className="nav">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`nav-btn ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="content">
        <ErrorBoundary>
          {tab === "queue" && <Queue />}
          {tab === "scripts" && <Scripts />}
          {tab === "videos" && <Videos />}
          {tab === "calendar" && <Calendar />}
          {tab === "analytics" && <Analytics />}
          {tab === "assets" && <Assets />}
          {tab === "prompts" && <Prompts />}
          {tab === "system" && <System />}
          {tab === "settings" && <Settings />}
        </ErrorBoundary>
      </main>

    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <NicheProvider>
        <AppContent />
      </NicheProvider>
    </LanguageProvider>
  );
}
