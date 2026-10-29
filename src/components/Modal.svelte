<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  let {
    title,
    onclose,
    width = 520,
    children,
    footer,
  }: { title: string; onclose: () => void; width?: number; children: Snippet; footer?: Snippet } = $props();

  function onkey(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="backdrop" role="presentation" onmousedown={(e) => e.target === e.currentTarget && onclose()}>
  <div class="modal panel" style="width:{width}px" role="dialog" aria-modal="true" aria-label={title}>
    <header>
      <h2>{title}</h2>
      <button class="btn icon ghost" onclick={onclose} aria-label="Close"><Icon name="close" /></button>
    </header>
    <div class="body">{@render children()}</div>
    {#if footer}<footer>{@render footer()}</footer>{/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    background: rgba(12, 16, 28, 0.28);
    animation: fade 0.18s ease both;
  }
  .modal {
    --glass: 0.92;
    max-width: calc(100vw - 48px);
    max-height: calc(100vh - 64px);
    display: flex;
    flex-direction: column;
    padding: 0;
    animation: rise 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 18px 6px 24px;
  }
  .body {
    padding: 10px 24px 20px;
    overflow: auto;
    display: grid;
    gap: 14px;
  }
  footer {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 14px 24px 18px;
    border-top: 1px solid var(--line);
  }
  @keyframes fade { from { opacity: 0; } }
  @keyframes rise { from { opacity: 0; transform: translateY(10px) scale(0.985); } }
</style>
