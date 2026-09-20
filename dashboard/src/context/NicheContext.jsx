import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api";

const NicheContext = createContext(null);

export function NicheProvider({ children }) {
  const [niche, setNiche] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadActiveNiche = async () => {
    try {
      setLoading(true);
      const data = await api.getActiveNiche();
      setNiche(data);
      setError(null);
    } catch (err) {
      console.warn("NicheContext: using default fallback pack:", err);
      // Clean fallback if API is not running yet
      setNiche({
        id: "default",
        name: "ProofEngine Active Niche",
        discoveryTiers: [
          {
            id: "tier_1",
            label: "TIER 1 — Core Stories",
            emoji: "🔥",
            categories: [{ id: "general", label: "General Stories", emoji: "💡" }]
          }
        ],
        storyBeats: [
          { id: "hook", label: "HOOK", targetSeconds: [0, 3] },
          { id: "setup", label: "SETUP", targetSeconds: [3, 15] },
          { id: "conflict", label: "CONFLICT", targetSeconds: [15, 35] },
          { id: "payoff", label: "PAYOFF", targetSeconds: [35, 52] },
          { id: "cta", label: "CTA", targetSeconds: [52, 60] }
        ],
        publishing: {
          platforms: ["tiktok", "youtube", "instagram", "facebook", "x"]
        },
        social: {
          captionTemplates: { tiktok: "", youtube: "", facebook: "", x: "", instagram: "" }
        },
        visual: {
          durationSeconds: [45, 60]
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const switchNiche = async (nicheId) => {
    try {
      await api.switchNiche(nicheId);
      await loadActiveNiche();
      return true;
    } catch (err) {
      console.error("Failed to switch niche:", err);
      throw err;
    }
  };

  useEffect(() => {
    loadActiveNiche();
  }, []);

  return (
    <NicheContext.Provider value={{ niche, loading, error, refreshNiche: loadActiveNiche, switchNiche }}>
      {children}
    </NicheContext.Provider>
  );
}

export function useNiche() {
  const context = useContext(NicheContext);
  return context || { niche: null, loading: false, error: null };
}
