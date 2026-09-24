import { useState } from "react";
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

const TABS = [
  { id: "queue", label: "📥 Queue" },
  { id: "scripts", label: "✍️ Scripts" },
  { id: "videos", label: "🎬 Videos" },
  { id: "calendar", label: "📅 Calendar" },
  { id: "analytics", label: "📊 Analytics" },
  { id: "assets", label: "🎨 Assets" },
  { id: "prompts", label: "📝 Prompts" },
  { id: "system", label: "🖥️ System" },
  { id: "settings", label: "⚙️ Settings" },
];

function AppContent() {
  const [tab, setTab] = useState("queue");
  const { niche } = useNiche();

  return (
    <div className="layout">
      <Toast />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-title">⚡ ProofEngine</div>
          <div className="brand-sub">
            {niche ? `${niche.name} (${niche.id})` : "Short-form Automation"}
          </div>
        </div>
        <nav className="nav">
          {TABS.map((t) => (
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
    <NicheProvider>
      <AppContent />
    </NicheProvider>
  );
}
