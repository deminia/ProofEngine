import React, { createContext, useContext, useState, useEffect } from "react";

const LanguageContext = createContext(null);

export const TRANSLATIONS = {
  en: {
    // Brand
    brand_sub_default: "Short-form Automation",
    // Tabs
    tab_queue: "📥 Queue",
    tab_scripts: "✍️ Scripts",
    tab_videos: "🎬 Videos",
    tab_calendar: "📅 Calendar",
    tab_analytics: "📊 Analytics",
    tab_assets: "🎨 Assets",
    tab_prompts: "📝 Prompts",
    tab_system: "🖥️ System",
    tab_settings: "⚙️ Settings",
    // Common Actions
    refresh: "Refresh",
    refreshing: "Refreshing...",
    save: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    delete: "Delete",
    loading: "Loading…",
    all: "All",
    status: "Status",
    actions: "Actions",
    back: "Back",
    empty: "Empty",
    search: "Search...",
    filter: "Filter",
    // Queue Page
    queue_title: "Story Queue",
    queue_sub: "Screen and approve viral topic angles before generating scripts",
    queue_filter_pending: "🟡 Pending",
    queue_filter_approved: "✅ Approved",
    queue_filter_rejected: "🗑 Rejected",
    queue_filter_scripted: "📝 Scripted",
    queue_filter_all: "📂 All",
    queue_scan_rss: "📡 Scan RSS",
    queue_refresh: "🔄 Refresh",
    queue_batch: "Batch Operations",
    queue_search_placeholder: "Search stories, topics, keywords...",
    queue_hide_low_score: "Hide Score < 7.0",
    queue_ai_finder: "AI Story Finder (Generate curated cases by category)",
    queue_manual_add: "Add Custom Story (From URL or Text)",
    queue_empty: "No stories found in this view — try Scan RSS or AI Story Finder above",
    queue_approve_btn: "Approve",
    queue_reject_btn: "Reject",
    queue_gen_script: "Generate Script",
    queue_score: "Score",
    queue_viral_score: "Viral Score",
    queue_duplicate: "Potential Duplicate",
    // Scripts Page
    scripts_title: "Scripts",
    scripts_sub: "Review, edit, and produce short scripts",
    scripts_btn_build_video: "🎬 Build Video",
    scripts_btn_visual_plan: "🎨 Visual Plan",
    scripts_btn_regen_hook: "⚡ Regen Hook",
    scripts_btn_regen_body: "🔄 Regen Body",
    scripts_btn_translate_en: "🌐 Translate EN",
    // Videos Page
    videos_title: "Videos",
    videos_sub: "Video render queue, preview, and multi-platform publishing",
    videos_publish_now: "📤 Publish now",
    videos_schedule: "⏰ Schedule",
    videos_download: "⬇️ Download",
    videos_export_capcut: "📦 Export CapCut",
    // Calendar Page
    calendar_title: "Publishing Calendar",
    calendar_sub: "Publishing schedule and automated post queue",
    // Analytics Page
    analytics_title: "Analytics",
    analytics_sub: "Consolidated views, likes, and engagement across platforms",
    analytics_refresh: "🔄 Refresh now",
    analytics_refreshing: "⏳ Fetching stats…",
    analytics_stat_views: "Total Views",
    analytics_stat_likes: "Total Likes",
    analytics_stat_comments: "Total Comments",
    analytics_stat_shares: "Total Shares",
    analytics_stat_posts: "Total Posts",
    analytics_per_post: "📋 Per Post Breakdown",
    analytics_recent_logs: "🕒 Recent Collection History",
    // Assets Page
    assets_title: "Assets / Media Library",
    assets_sub: "Browse and manage local renders and footage cache",
    assets_upload: "📤 Upload",
    // Prompts Page
    prompts_title: "Prompts / Templates",
    prompts_sub: "Edit AI system prompts. Changes persist across restarts and apply to all processes.",
    prompts_save: "💾 Save Prompt",
    prompts_reset: "🔄 Reset to Default",
    // System Page
    system_title: "System Monitor",
    system_sub: "Service health, background workers, and pipeline stats",
    system_health_checks: "Health Checks",
    system_pipeline_stats: "Pipeline Stats",
    system_celery: "Celery Worker",
    system_logs: "Recent Logs",
    // Settings Page
    settings_title: "Settings",
    settings_sub: "Global configuration, niche pack switcher, LLM keys, and TTS voice",
    settings_niche_pack: "📦 Niche Pack Configuration",
    settings_active_niche: "Active Niche Pack:",
    settings_name: "Name:",
    settings_desc: "Description:",
    settings_duration: "Duration:",
    settings_platforms: "Platforms:",
  },
  th: {
    // Brand
    brand_sub_default: "ระบบผลิตวิดีโอสั้นอัตโนมัติ",
    // Tabs
    tab_queue: "📥 คิวเรื่อง",
    tab_scripts: "✍️ บทสคริปต์",
    tab_videos: "🎬 วิดีโอ",
    tab_calendar: "📅 ปฏิทินโพสต์",
    tab_analytics: "📊 สถิติยอดวิว",
    tab_assets: "🎨 คลังไฟล์สื่อ",
    tab_prompts: "📝 พรอมต์ AI",
    tab_system: "🖥️ ตรวจระบบ",
    tab_settings: "⚙️ ตั้งค่า",
    // Common Actions
    refresh: "รีเฟรช",
    refreshing: "กำลังดึงข้อมูล...",
    save: "บันทึก",
    saving: "กำลังบันทึก...",
    cancel: "ยกเลิก",
    delete: "ลบ",
    loading: "กำลังโหลด…",
    all: "ทั้งหมด",
    status: "สถานะ",
    actions: "การทำงาน",
    back: "ย้อนกลับ",
    empty: "ว่างเปล่า",
    search: "ค้นหา...",
    filter: "ตัวกรอง",
    // Queue Page
    queue_title: "คิวเรื่อง (Story Queue)",
    queue_sub: "คัดเลือกเรื่องที่ใช่ก่อนส่งต่อไปเขียนบทพากย์",
    queue_filter_pending: "🟡 รอตรวจ",
    queue_filter_approved: "✅ อนุมัติแล้ว",
    queue_filter_rejected: "🗑 ปฏิเสธแล้ว",
    queue_filter_scripted: "📝 เขียนบทแล้ว",
    queue_filter_all: "📂 ทั้งหมด",
    queue_scan_rss: "📡 สแกน RSS",
    queue_refresh: "🔄 รีเฟรช",
    queue_batch: "จัดการกลุ่ม",
    queue_search_placeholder: "ค้นหาจากชื่อเรื่อง ประเด็นเรื่อง...",
    queue_hide_low_score: "ซ่อนคะแนน < 7.0",
    queue_ai_finder: "AI Story Finder (ค้นหาเรื่องเด่นตามหมวดหมู่)",
    queue_manual_add: "เพิ่มเรื่องด้วยตัวเอง (จาก URL หรือ พิมพ์ข้อความ)",
    queue_empty: "ยังไม่มีเรื่องในหน้านี้ — กด Scan RSS หรือใช้ AI Story Finder ด้านบน",
    queue_approve_btn: "อนุมัติ",
    queue_reject_btn: "ปฏิเสธ",
    queue_gen_script: "สร้างบทสคริปต์",
    queue_score: "คะแนน",
    queue_viral_score: "คะแนนไวรัล",
    queue_duplicate: "อาจซ้ำกับเรื่องที่เคยมี",
    // Scripts Page
    scripts_title: "บทสคริปต์",
    scripts_sub: "ตรวจแก้และอนุมัติบทสำหรับสร้างวิดีโอ",
    scripts_btn_build_video: "🎬 สร้างวิดีโอ",
    scripts_btn_visual_plan: "🎨 วางแผนภาพ",
    scripts_btn_regen_hook: "⚡ สร้าง Hook ใหม่",
    scripts_btn_regen_body: "🔄 สร้างเนื้อหาใหม่",
    scripts_btn_translate_en: "🌐 แปลเป็นอังกฤษ",
    // Videos Page
    videos_title: "วิดีโอ",
    videos_sub: "คิวสร้างวิดีโอและการเผยแพร่ลงแพลตฟอร์ม",
    videos_publish_now: "📤 เผยแพร่ทันที",
    videos_schedule: "⏰ ตั้งเวลาโพสต์",
    videos_download: "⬇️ ดาวน์โหลด",
    videos_export_capcut: "📦 ส่งออก CapCut",
    // Calendar Page
    calendar_title: "ปฏิทินโพสต์",
    calendar_sub: "ตารางเวลาและคิวโพสต์อัตโนมัติ",
    // Analytics Page
    analytics_title: "สถิติยอดวิว",
    analytics_sub: "รวมสถิติจากทุกแพลตฟอร์ม",
    analytics_refresh: "🔄 รีเฟรชสถิติ",
    analytics_refreshing: "⏳ กำลังดึงสถิติ…",
    analytics_stat_views: "ยอดวิวรวม",
    analytics_stat_likes: "ยอดไลก์รวม",
    analytics_stat_comments: "คอมเมนต์รวม",
    analytics_stat_shares: "แชร์รวม",
    analytics_stat_posts: "โพสต์ทั้งหมด",
    analytics_per_post: "📋 สถิติต่อโพสต์",
    analytics_recent_logs: "🕒 ประวัติการดึงสถิติล่าสุด",
    // Assets Page
    assets_title: "คลังไฟล์สื่อ (Media Library)",
    assets_sub: "จัดการไฟล์วิดีโอที่สร้างเสร็จและคลังฟุตเทจ",
    assets_upload: "📤 อัปโหลด",
    // Prompts Page
    prompts_title: "พรอมต์ AI / แม่แบบ",
    prompts_sub: "ปรับแต่ง System Prompts สำหรับ AI แต่ละขั้นตอน",
    prompts_save: "💾 บันทึกพรอมต์",
    prompts_reset: "🔄 รีเซ็ตค่าเริ่มต้น",
    // System Page
    system_title: "ตรวจสุขภาพระบบ",
    system_sub: "สถานะการทำงานของ Service, Worker และสถิติไปป์ไลน์",
    system_health_checks: "สถานะการทำงาน",
    system_pipeline_stats: "สถิติไปป์ไลน์",
    system_celery: "คนทำงานเบื้องหลัง (Celery)",
    system_logs: "บันทึกการทำงานล่าสุด",
    // Settings Page
    settings_title: "การตั้งค่าระบบ",
    settings_sub: "การกำหนดค่าระบบ สลับ Niche Pack, API Keys และเสียงพากย์",
    settings_niche_pack: "📦 การตั้งค่า Niche Pack",
    settings_active_niche: "Niche Pack ที่ใช้งานอยู่:",
    settings_name: "ชื่อ:",
    settings_desc: "คำอธิบาย:",
    settings_duration: "ความยาว:",
    settings_platforms: "แพลตฟอร์ม:",
  }
};

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem("proofengine_lang") || "en";
    } catch {
      return "en";
    }
  });

  const setLang = (newLang) => {
    const valid = newLang === "th" ? "th" : "en";
    setLangState(valid);
    try {
      localStorage.setItem("proofengine_lang", valid);
    } catch {}
  };

  const t = (key, fallback = "") => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    if (dict[key] !== undefined) return dict[key];
    if (TRANSLATIONS.en[key] !== undefined) return TRANSLATIONS.en[key];
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      lang: "en",
      setLang: () => {},
      t: (key, fallback = "") => fallback || key,
    };
  }
  return context;
}
