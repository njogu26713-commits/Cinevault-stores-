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
    console.error("Failed to persist settings:", err);
  }
}

export function getSetting(key: keyof PersistedSettings): string {
  const file = readFile();
  return file[key] || process.env[envKey(key)] || "";
}

export function saveSettings(updates: Partial<PersistedSettings>): void {
  const current = readFile();
  const next = { ...current, ...updates };
  writeFile(next);
  // Also update process.env so routes pick it up immediately without restart
  for (const [k, v] of Object.entries(updates)) {
    if (v) process.env[envKey(k as keyof PersistedSettings)] = v;
  }
}

export function getAllSettings(): PersistedSettings {
  return readFile();
}

function envKey(key: keyof PersistedSettings): string {
  const map: Record<keyof PersistedSettings, string> = {
    telegramChannelId: "TELEGRAM_CHANNEL_ID",
    mpesaShortcode: "MPESA_SHORTCODE",
    mpesaCallbackUrl: "MPESA_CALLBACK_URL",
    adminUsername: "ADMIN_USERNAME",
  };
  return map[key] ?? key;
}
