<script lang="ts">
  import type { Deadline } from "../lib/types";
  import { courseById, ui, toast } from "../lib/store.svelte";
  import { colorOf, KIND_LABEL } from "../lib/colors";
  import { daysBetween, fmtDay, fmtTime, relative, today } from "../lib/dates";
  import Icon from "./Icon.svelte";

  let { d, showDate = true }: { d: Deadline; showDate?: boolean } = $props();

  const course = $derived(courseById(d.courseId));
  const days = $derived(daysBetween(today(), d.date));
  const late = $derived(!d.done && days < 0);
  const soon = $derived(!d.done && days >= 0 && days <= 2);
  const covered = $derived.by(() => {
    if (!course || !d.covers.length) return null;
    const secs = course.sections.filter((s) => d.covers.includes(s.id));
    return { done: secs.filter((s) => s.status === "done").length, total: secs.length };
  });

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    d.done = !d.done;
    if (d.done) toast(`Marked “${d.title}” done`);
  }
</script>

<div
  class="row-item deadline"
  class:done={d.done}
  role="button"
  tabindex="0"
  onclick={() => (ui.deadlineDraft = $state.snapshot(d))}
  onkeydown={(e) => e.key === "Enter" && (ui.deadlineDraft = $state.snapshot(d))}
>
  <button class="check round" class:on={d.done} onclick={toggle} aria-label="Mark done">
    {#if d.done}<Icon name="check" size={12} stroke={2.4} />{/if}
  </button>
  <span class="bar-color" style="background:{colorOf(course?.color)}"></span>
  <div class="main">
    <div class="title"><span class="strike">{d.title}</span></div>
    <div class="meta small faint">
      {#if course}<span>{course.code || course.name}</span> · {/if}
      <span>{KIND_LABEL[d.kind]}</span>
      {#if covered}
        · <span class:ok={covered.done === covered.total}>{covered.done}/{covered.total} sections ready</span>
      {/if}
    </div>
  </div>
  <div class="when">
    {#if showDate}<div class="small muted mono">{fmtDay(d.date)}{d.time ? ` · ${fmtTime(d.time)}` : ""}</div>{/if}
    {#if !d.done}
      <span class="tag" class:warn={late || soon} class:accent={!late && !soon}>{late ? `${-days}d late` : relative(d.date)}</span>
    {:else if !showDate && d.time}
      <span class="small faint mono">{fmtTime(d.time)}</span>
    {/if}
  </div>
</div>

<style>
  .deadline { cursor: pointer; }
  .bar-color { width: 3px; align-self: stretch; border-radius: 3px; flex: none; }
  .main { flex: 1; min-width: 0; }
  .title { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .strike {
    background: linear-gradient(currentColor, currentColor) no-repeat 0 55% / 0% 1.5px;
    transition: background-size 0.35s ease, color 0.25s;
  }
  .done .strike { background-size: 100% 1.5px; color: var(--ink-3); }
  .deadline.done { opacity: 0.8; }
  .meta { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ok { color: var(--accent); }
  .when { display: grid; justify-items: end; gap: 3px; flex: none; }
</style>
