import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = path.resolve(__dirname, "../../data/settings.json");

interface PersistedSettings {
  telegramChannelId?: string;
  mpesaShortcode?: string;
  mpesaCallbackUrl?: string;
  adminUsername?: string;
  telegramSession?: string;
}

function readFile(): PersistedSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function writeFile(data: PersistedSettings): void {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to persist settings to file:", err);
  }
}

function envKey(key: keyof PersistedSettings): string {
  const map: Record<keyof PersistedSettings, string> = {
    telegramChannelId: "TELEGRAM_CHANNEL_ID",
    mpesaShortcode: "MPESA_SHORTCODE",
    mpesaCallbackUrl: "MPESA_CALLBACK_URL",
    adminUsername: "ADMIN_USERNAME",
    telegramSession: "TELEGRAM_SESSION",
  };
  return map[key] ?? key;
}

export function getSetting(key: keyof PersistedSettings): string {
  const file = readFile();
  return file[key] || process.env[envKey(key)] || "";
}

export function saveSettings(updates: Partial<PersistedSettings>): void {
  const current = readFile();
  const next = { ...current, ...updates };
  writeFile(next);
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) {
      const envk = envKey(k as keyof PersistedSettings);
      if (envk) process.env[envk] = v ?? "";
    }
  }
  // Fire-and-forget: also persist to MongoDB so settings survive deployment restarts
  saveSettingsToDB(updates).catch(() => {});
}

export function getAllSettings(): PersistedSettings {
  return readFile();
}

// ── MongoDB-backed persistence (survives autoscale restarts) ─────────────────

async function saveSettingsToDB(updates: Partial<PersistedSettings>): Promise<void> {
  try {
    const { Setting } = await import("../models/Setting.js");
    const ops = Object.entries(updates)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) =>
        Setting.findOneAndUpdate(
          { key: k },
          { key: k, value: v ?? "" },
          { upsert: true, new: true }
        )
      );
    await Promise.all(ops);
  } catch {
    // MongoDB may not be connected yet — silently ignore
  }
}

/**
 * Call this once after MongoDB is connected.
 * Loads all persisted settings from DB into process.env and the local file,
 * so GramJS sessions and other settings survive deployment restarts.
 */
export async function loadSettingsFromDB(): Promise<void> {
  try {
    const { Setting } = await import("../models/Setting.js");
    const docs = await Setting.find({});
    if (docs.length === 0) return;

    const fromDB: Partial<PersistedSettings> = {};
    for (const doc of docs) {
      const key = doc.key as keyof PersistedSettings;
      const value = doc.value;
      if (value) {
        fromDB[key] = value;
        // Merge into process.env so services pick it up immediately
        const ek = envKey(key);
        if (ek && !process.env[ek]) {
          process.env[ek] = value;
        }
      }
    }

    // Merge into the local file (dev fallback)
    const current = readFile();
    writeFile({ ...fromDB, ...current });

    console.info("[settings] Loaded settings from MongoDB:", Object.keys(fromDB).join(", ") || "none");
  } catch (err) {
    console.warn("[settings] Could not load settings from MongoDB:", err);
  }
}
