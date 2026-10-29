// Thin wrappers around Tauri so the UI also runs in a normal browser during `npm run dev`.
import { invoke } from "@tauri-apps/api/core";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const LOCAL_KEY = "summit-data";

export async function loadRaw(): Promise<string | null> {
  if (!isTauri) return localStorage.getItem(LOCAL_KEY);
  return invoke<string | null>("load_data");
}

export async function saveRaw(json: string): Promise<void> {
  if (!isTauri) {
    localStorage.setItem(LOCAL_KEY, json);
    return;
  }
  await invoke("save_data", { json });
}

export async function dataFolder(): Promise<string> {
  return isTauri ? invoke<string>("data_folder") : "browser storage (dev mode)";
}

/** Asks where to save, then writes the file. Returns false if cancelled. */
export async function saveFile(defaultName: string, contents: string, ext: string, label: string): Promise<boolean> {
  if (!isTauri) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([contents], { type: "text/plain" }));
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  const path = await save({ defaultPath: defaultName, filters: [{ name: label, extensions: [ext] }] });
  if (!path) return false;
  await invoke("write_text_file", { path, contents });
  return true;
}

/** Asks for a file to open and returns its text, or null if cancelled. */
export async function openFile(ext: string, label: string): Promise<string | null> {
  if (!isTauri) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = `.${ext}`;
      input.onchange = async () => resolve(input.files?.[0] ? await input.files[0].text() : null);
      input.click();
    });
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const path = await open({ multiple: false, filters: [{ name: label, extensions: [ext] }] });
  if (!path || Array.isArray(path)) return null;
  return invoke<string>("read_text_file", { path });
}

export async function confirmDialog(message: string, title = "Summit"): Promise<boolean> {
  if (!isTauri) return window.confirm(message);
  const { ask } = await import("@tauri-apps/plugin-dialog");
  return ask(message, { title, kind: "warning" });
}

export async function openUrl(url: string): Promise<void> {
  const href = /^[a-z]+:/i.test(url) ? url : `https://${url}`;
  if (!isTauri) {
    window.open(href, "_blank", "noopener");
    return;
  }
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(href);
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    if (!isTauri) {
      if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body });
      return;
    }
    const n = await import("@tauri-apps/plugin-notification");
    let granted = await n.isPermissionGranted();
    if (!granted) granted = (await n.requestPermission()) === "granted";
    if (granted) n.sendNotification({ title, body });
  } catch {
    // Notifications are a nice-to-have; never break the app over them.
  }
}
