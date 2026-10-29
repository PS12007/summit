<script lang="ts">
  import { untrack } from "svelte";
  import { db } from "../lib/store.svelte";
  import { sceneById, sceneOfTheDay, sceneUrl, type Scene } from "../lib/scenes";
  import { artFor } from "../lib/art";

  // With "a new place every day" on, re-check every 10 minutes so it changes after midnight.
  let daily = $state(sceneOfTheDay());
  $effect(() => {
    const t = setInterval(() => (daily = sceneOfTheDay()), 10 * 60 * 1000);
    return () => clearInterval(t);
  });

  const scene = $derived<Scene>(db.settings.dailyScene ? daily : sceneById(db.settings.scene));
  const style = $derived(db.settings.artStyle);

  interface Layer { key: string; url: string; focus: string; dark: boolean; veil: number }

  // Keep the previous picture underneath while the new one is drawn and fades in on top.
  let layers = $state<Layer[]>([]);
  let loaded = $state<Record<string, boolean>>({});
  let wanted = "";
  $effect(() => {
    const sc = scene, st = style;
    const key = `${sc.id}:${st}`;
    untrack(() => {
      if (wanted === key) return;
      wanted = key;
      artFor(sceneUrl(sc.id), st, 2000).then(
        (art) => {
          if (wanted !== key) return;
          // The artwork's own brightness decides light/dark panels and how much to shade behind the greeting.
          const dark = art.avg < 0 ? sc.dark : art.avg < 0.36;
          // Textured art is busier than a photo, so it always gets some shade behind the text.
          const veil = art.hero < 0 ? sc.veil : Math.min(0.45, Math.max(0.3, (art.hero - 0.3) * 0.7 + 0.2));
          layers = [...layers.filter((l) => l.key !== key).slice(-1), { key, url: art.url, focus: sc.focus, dark, veil }];
        },
        () => {
          // Drawing failed: fall back to the plain photo.
          if (wanted !== key) return;
          layers = [...layers.slice(-1), { key, url: sceneUrl(sc.id), focus: sc.focus, dark: sc.dark, veil: sc.veil }];
        },
      );
    });
  });
  function onload(key: string) {
    loaded[key] = true;
    // Once the new picture has faded in, drop the old one.
    setTimeout(() => (layers = layers.filter((l) => l.key === layers.at(-1)?.key)), 1200);
  }

  const top = $derived(layers.at(-1));
  $effect(() => {
    const root = document.documentElement;
    root.dataset.theme = (top?.dark ?? scene.dark) ? "dark" : "light";
    root.style.setProperty("--glass", String(db.settings.glass));
    root.style.setProperty("--veil", String(top?.veil ?? scene.veil));
  });
</script>

<div class="scenery" aria-hidden="true">
  {#if !layers.length}
    <!-- Very first launch: a soft blur of the photo while the artwork is being drawn. -->
    <img class="placeholder" src={sceneUrl(scene.id)} alt="" style="object-position:{scene.focus}" draggable="false" />
  {/if}
  {#each layers as layer (layer.key)}
    <img class="layer" class:ready={loaded[layer.key]} src={layer.url} alt="" style="object-position:{layer.focus}" draggable="false" onload={() => onload(layer.key)} />
  {/each}
  <div class="veil"></div>
</div>

<style>
  .scenery {
    position: fixed;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
    background: #4a5568;
  }
  .layer, .placeholder {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .placeholder { filter: blur(28px) saturate(1.1); transform: scale(1.08); }
  .layer {
    opacity: 0;
    transform: scale(1.015);
    transition: opacity 1.1s ease, transform 1.4s ease;
  }
  .layer.ready { opacity: 1; transform: none; }
  /* Darkens the top-left (greeting) and left edge (sidebar) so text stays readable on bright pictures. */
  .veil {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 70% 55% at 18% 8%, rgba(8, 12, 24, calc(var(--veil, 0.25) * 1.1)), transparent 70%),
      linear-gradient(90deg, rgba(8, 12, 24, calc(var(--veil, 0.25) * 0.8)), transparent 38%),
      linear-gradient(180deg, rgba(8, 12, 24, calc(var(--veil, 0.25) * 0.6)), transparent 30%);
  }
</style>
