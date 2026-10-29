// Turns a scene photo into the chosen art style. Rendering happens in a worker, and finished
// images are saved in the browser's IndexedDB so each one is only ever drawn once.
import type { ArtStyle } from "./stylize";
import StylizeWorker from "./stylize.worker?worker";

export type { ArtStyle };

export const STYLES: { id: ArtStyle; name: string }[] = [
  { id: "paint", name: "Painted" },
  { id: "dots", name: "Dots" },
  { id: "symbols", name: "Symbols" },
  { id: "sketch", name: "Sketch" },
  { id: "photo", name: "Photo" },
];

/** Bump when the drawing code changes, so old saved images are redrawn. */
const VERSION = 2;

export interface Art {
  url: string;
  /** Brightness 0–1 of the whole image and of the top-left (where the greeting is). */
  avg: number;
  hero: number;
}

// ---------- tiny IndexedDB cache ----------
const DB = "summit-art";
let dbp: Promise<IDBDatabase | null> | null = null;
function openDb(): Promise<IDBDatabase | null> {
  dbp ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore("art");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const req = fn(db.transaction("art", mode).objectStore("art"));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

// ---------- workers ----------
// One for full-size backgrounds and one for thumbnails, so opening Settings never delays the background.
type Pending = { resolve: (v: { blob: Blob; avg: number; hero: number }) => void; reject: (e: unknown) => void };
function makeQueue() {
  let worker: Worker | null = null;
  const pending = new Map<number, Pending>();
  let next = 1;
  return (bitmap: ImageBitmap, style: ArtStyle, width: number, scale: number) => {
    if (!worker) {
      worker = new StylizeWorker();
      worker.onmessage = (e) => {
        const p = pending.get(e.data.id);
        pending.delete(e.data.id);
        if (e.data.error) p?.reject(new Error(e.data.error));
        else p?.resolve(e.data);
      };
    }
    const id = next++;
    return new Promise<{ blob: Blob; avg: number; hero: number }>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker!.postMessage({ id, bitmap, style, width, scale }, [bitmap]);
    });
  };
}
const big = makeQueue();
const small = makeQueue();

async function loadBitmap(src: string): Promise<ImageBitmap> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return createImageBitmap(img);
}

const memo = new Map<string, Promise<Art>>();

/**
 * The scene photo at `src` drawn in `style`, `width` pixels wide.
 * `scale` sets how big the brush strokes/dots/symbols are (1 = sized for a 2000px background).
 */
export function artFor(src: string, style: ArtStyle, width: number, scale = width / 2000): Promise<Art> {
  if (style === "photo") return Promise.resolve({ url: src, avg: -1, hero: -1 });
  const key = `${VERSION}|${style}|${width}|${scale.toFixed(3)}|${src}`;
  let p = memo.get(key);
  if (!p) {
    p = (async () => {
      const saved = await idb<{ blob: Blob; avg: number; hero: number }>("readonly", (s) => s.get(key));
      const out = saved ?? (await (width > 800 ? big : small)(await loadBitmap(src), style, width, scale));
      if (!saved) void idb("readwrite", (s) => s.put(out, key));
      return { url: URL.createObjectURL(out.blob), avg: out.avg, hero: out.hero };
    })();
    p.catch(() => memo.delete(key));
    memo.set(key, p);
  }
  return p;
}
