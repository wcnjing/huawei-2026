// src/app/services/storage.ts
import type { AccessibilityPrefs } from "../types/settings";
import type { ContactInfo, PlayerProfile } from "../types/profile";

export const PROFILE_KEY = "safespace_profile";
export const CONTACT_KEY = "safespace_contact";

export const DEFAULT_PROFILE: PlayerProfile = {
  name: "PLAYER_001",
  avatar: {
    color: "#4ecdc4",
    glow: "#00ff88",
    hat: "None",
    eyes: "Default",
    outfit: "Standard",
  },
};

export const DEFAULT_CONTACT: ContactInfo = {
  name: "",
  phone: "+65",
  email: "",
};

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);

    if (!raw) {
      return DEFAULT_PROFILE;
    }

    const stored = JSON.parse(raw);

    return {
      name:
        stored.name ||
        DEFAULT_PROFILE.name,
      avatar: {
        ...DEFAULT_PROFILE.avatar,
        ...(stored.avatar || {}),
      },
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(
  profile: PlayerProfile,
): void {
  try {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify(profile),
    );
  } catch {
    // Private mode or storage failure: not persisted.
  }
}

export function loadContact(): ContactInfo {
  try {
    const raw = localStorage.getItem(CONTACT_KEY);

    if (!raw) {
      return DEFAULT_CONTACT;
    }

    const stored = JSON.parse(raw);

    return {
      name: stored.name || "",
      phone: stored.phone || "+65",
      email: stored.email || "",
    };
  } catch {
    return DEFAULT_CONTACT;
  }
}

export function saveContact(
  contact: ContactInfo,
): void {
  try {
    localStorage.setItem(
      CONTACT_KEY,
      JSON.stringify(contact),
    );
  } catch {
    // Private mode or storage failure: not persisted.
  }
}

const ACCESSIBILITY_KEY = "safespace_accessibility_v1";
const DEFAULT_ACCESSIBILITY: AccessibilityPrefs = {
  reduceMotion: false,
  largerText: false,
  highContrast: false,
  disableScanlines: false,
};

export function loadAccessibility(): AccessibilityPrefs {
  try {
    const raw = localStorage.getItem(ACCESSIBILITY_KEY);
    return raw ? { ...DEFAULT_ACCESSIBILITY, ...JSON.parse(raw) } : DEFAULT_ACCESSIBILITY;
  } catch {
    return DEFAULT_ACCESSIBILITY;
  }
}

export function saveAccessibility(prefs: AccessibilityPrefs) {
  try { localStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
}