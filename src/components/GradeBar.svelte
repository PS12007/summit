<script lang="ts">
  import type { GradeSummary } from "../lib/grades";
  import { fmt } from "../lib/grades";

  // Shows the whole course grade as one bar: earned · lost · still to come.
  let { g, legend = true, height = 10 }: { g: GradeSummary; legend?: boolean; height?: number } = $props();
  const T = $derived(g.totalWeight || 100);
  const pc = (x: number) => (x / T) * 100;
</script>

<div class="gbar" style="height:{height}px" title="Earned {fmt(pc(g.earned))} · lost {fmt(pc(g.lost))} · still to come {fmt(pc(g.remaining))}">
  <i class="earned" style="width:{pc(g.earned)}%"></i>
  <i class="lost" style="width:{pc(g.lost)}%"></i>
</div>
{#if legend}
  <div class="glegend small">
    <span><i class="sw earned"></i>Earned <b class="mono">{fmt(pc(g.earned))}</b></span>
    <span><i class="sw lost"></i>Lost <b class="mono">{fmt(pc(g.lost))}</b></span>
    <span><i class="sw rest"></i>Still to come <b class="mono">{fmt(pc(g.remaining))}</b></span>
  </div>
{/if}

<style>
  .gbar { display: flex; border-radius: 99px; overflow: hidden; background: repeating-linear-gradient(-45deg, var(--line), var(--line) 4px, transparent 4px, transparent 8px), var(--field); border: 1px solid var(--line); }
  .gbar i { display: block; height: 100%; transition: width 0.4s ease; }
  .earned { background: var(--c, var(--accent)); }
  .lost { background: color-mix(in srgb, var(--warn) 55%, transparent); }
  .glegend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 8px; color: var(--ink-2); }
  .glegend span { display: inline-flex; align-items: center; gap: 6px; }
  .glegend b { font-weight: 500; color: var(--ink); }
  .sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
  .sw.rest { background: var(--line-strong); }
</style>
