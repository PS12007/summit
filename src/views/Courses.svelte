<script lang="ts">
  import { db, go, ui, uid, upcoming } from "../lib/store.svelte";
  import { colorOf, COURSE_COLORS } from "../lib/colors";
  import { DAY_SHORT, fmtTime, relative } from "../lib/dates";
  import { nextUp, progress } from "../lib/sections";
  import { summarize, letter } from "../lib/grades";
  import Icon from "../components/Icon.svelte";

  let showArchived = $state(false);
  const list = $derived(db.courses.filter((c) => !!c.archived === showArchived));
  const archivedCount = $derived(db.courses.filter((c) => c.archived).length);

  function newCourse() {
    const used = new Set(db.courses.map((c) => c.color));
    const color = Object.keys(COURSE_COLORS).find((k) => !used.has(k)) ?? "slate";
    ui.courseDraft = { id: uid(), name: "", color, meetings: [], links: [], sections: [], grades: [] };
  }

  const schedule = (c: (typeof db.courses)[number]) => {
    if (!c.meetings.length) return "";
    const days = [...new Set(c.meetings.map((m) => m.day))].sort().map((d) => DAY_SHORT[d].slice(0, 2)).join(" ");
    return `${days} · ${fmtTime(c.meetings[0].start)}`;
  };
</script>

<div class="courses fade-in">
  <header class="top">
    <h1>Classes</h1>
    <div class="spacer"></div>
    {#if archivedCount}
      <div class="seg">
        <button class:on={!showArchived} onclick={() => (showArchived = false)}>Current</button>
        <button class:on={showArchived} onclick={() => (showArchived = true)}>Archived ({archivedCount})</button>
      </div>
    {/if}
    <button class="btn primary" onclick={newCourse}><Icon name="plus" size={16} /> New class</button>
  </header>

  <div class="grid-cards">
    {#each list as c (c.id)}
      {@const p = progress(c)}
      {@const next = nextUp(c)}
      {@const due = upcoming().find((d) => d.courseId === c.id)}
      {@const g = summarize(c)}
      <button class="panel card" onclick={() => go("course", c.id)} style="--c:{colorOf(c.color)}">
        <div class="stripe"></div>
        <div class="eyebrow">{c.code || "—"}</div>
        <h2>{c.name}</h2>
        <div class="small faint">{[c.instructor, schedule(c)].filter(Boolean).join(" · ") || " "}</div>
        <div class="stats">
          <div><span class="big">{p.pct}<small>%</small></span><span class="eyebrow">sections</span></div>
          <div><span class="big mono-ish">{next?.label ?? (p.total ? "✓" : "—")}</span><span class="eyebrow">next up</span></div>
          <div><span class="big">{g.current !== null ? letter(g.current, c) : "—"}</span><span class="eyebrow">grade</span></div>
        </div>
        <div class="bar"><i style="width:{p.pct}%;background:var(--c)"></i></div>
        <div class="due small">
          {#if due}<span class="faint">Next due</span> {due.title} · <span class="muted">{relative(due.date)}</span>{:else}<span class="faint">Nothing due</span>{/if}
        </div>
      </button>
    {/each}
    {#if !showArchived}
      <button class="panel card new" onclick={newCourse}>
        <Icon name="plus" size={26} stroke={1.3} />
        <span>Add a class</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .courses { display: grid; gap: 18px; }
  .top { display: flex; align-items: center; gap: 12px; padding-top: 16px; color: var(--hero-ink); text-shadow: var(--hero-shadow); }
  .top h1 { font-size: 46px; line-height: 1; }
  .top .btn:not(.primary), .top .seg { text-shadow: none; color: var(--ink); }
  .top .btn.primary { text-shadow: none; }
  .grid-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
  .card { position: relative; display: grid; gap: 6px; text-align: left; cursor: pointer; overflow: hidden; transition: transform 0.18s; padding-top: 24px; }
  .card:hover { transform: translateY(-2px); }
  .stripe { position: absolute; left: 0; right: 0; top: 0; height: 5px; background: var(--c); }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); margin: 14px 0 8px; }
  .stats div { display: grid; gap: 2px; }
  .big { font-family: var(--font-display); font-size: 30px; line-height: 1; }
  .big small { font-size: 16px; }
  .due { margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .new { place-items: center; align-content: center; min-height: 230px; color: var(--ink-2); gap: 10px; border-style: dashed; }
</style>
