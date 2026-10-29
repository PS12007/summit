// Draws artwork off the main thread. Receives a photo bitmap, sends back a WebP blob.
import { measure, stylize, type ArtStyle } from "./stylize";

interface Job {
  id: number;
  bitmap: ImageBitmap;
  style: Exclude<ArtStyle, "photo">;
  width: number;
  scale: number;
}

self.onmessage = async (e: MessageEvent<Job>) => {
  const { id, bitmap, style, width, scale } = e.data;
  try {
    const height = Math.round((bitmap.height * width) / bitmap.width);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    stylize(ctx, ctx.getImageData(0, 0, width, height), style, scale);
    const { avg, hero } = measure(ctx, width, height);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.88 });
    self.postMessage({ id, blob, avg, hero });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
