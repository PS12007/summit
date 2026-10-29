<script lang="ts">
  import type { Course, Section, SectionStatus } from "../lib/types";
  import { addTodo, db, go, newDeadline, toast, ui, uid } from "../lib/store.svelte";
  import { colorOf } from "../lib/colors";
  import { DAY_SHORT, fmtDay, fmtTime, today } from "../lib/dates";
  import { compareLabels, grouped, lastDone, nextUp, NEXT_STATUS, parseLabels, progress, STATUS_LABEL } from "../lib/sections";
  import { letter, summarize } from "../lib/grades";
  import { openUrl } from "../lib/platform";
  import DeadlineRow from "../components/DeadlineRow.svelte";
  import TodoRow from "../components/TodoRow.svelte";
  import Icon from "../components/Icon.svelte";

  let { course: c }: { course: Course } = $props();

  const color = $derived(colorOf(c.color));
  const p = $derived(progress(c));
  const next = $derived(nextUp(c));
  const last = $derived(lastDone(c));
  const groups = $derived(grouped(c.sections));
  const g = $derived(summarize(c));
  const deadlines = $derived(
    db.deadlines.filter((d) => d.courseId === c.id).sort((a, b) => Number(a.done) - Number(b.done) || a.date.localeCompare(b.date)),
  );
  // Upcoming deadlines stay listed once done (crossed out); "Show past" adds the ones whose date has gone by.
  const isPast = (d: { done: boolean; date: string }) => d.date < today() || (d.done && !db.settings.showDone);
  const pastCount = $derived(deadlines.filter(isPast).length);
  let showPast = $state(false);
  const shownDeadlines = $derived(showPast ? deadlines : deadlines.filter((d) => !isPast(d)).sort((a, b) => a.date.localeCompare(b.date)));
  const tasks = $derived(
    db.todos
      .filter((t) => t.courseId === c.id && (!t.done || db.settings.showDone))
      .sort((a, b) => Number(a.done) - Number(b.done) || (b.doneAt ?? 0) - (a.doneAt ?? 0)),
  );

  // ---------- sections ----------
  let addText = $state("");
  const preview = $derived(addText.trim() ? parseLabels(addText) : []);

  function addSections() {
    const existing = new Set(c.sections.map((s) => s.label.toLowerCase()));
    const fresh = preview.filter((l) => !existing.has(l.toLowerCase()));
    c.sections.push(...fresh.map((label) => ({ id: uid(), label, status: "todo" as SectionStatus })));
    toast(fresh.length ? `Added ${fresh.length} section${fresh.length > 1 ? "s" : ""}` : "Those sections already exist");
    addText = "";
  }

  function clickChip(e: MouseEvent, s: Section) {
    if (e.shiftKey) return doneThrough(s);
    s.status = NEXT_STATUS[s.status];
  }

  /** Marks this section and every one before it as done. */
  function doneThrough(s: Section) {
    for (const x of c.sections) if (compareLabels(x.label, s.label) <= 0 && x.status !== "review") x.status = "done";
    toast(`Done through ${s.label}`);
  }

  let menu = $state<{ s: Section; x: number; y: number } | null>(null);
  let rename = $state("");
  function openMenu(e: MouseEvent, s: Section) {
    e.preventDefault();
    rename = s.label;
    menu = { s, x: Math.min(e.clientX, window.innerWidth - 240), y: Math.min(e.clientY, window.innerHeight - 330) };
  }
  function setStatus(st: SectionStatus) {
    if (menu) menu.s.status = st;
    menu = null;
  }
  function removeSection() {
    if (!menu) return;
    const id = menu.s.id;
    c.sections = c.sections.filter((x) => x.id !== id);
    db.deadlines.forEach((d) => (d.covers = d.covers.filter((x) => x !== id)));
    menu = null;
  }
  function applyRename() {
    if (menu && rename.trim()) menu.s.label = rename.trim();
  }

  // ---------- grades ----------
  let openCat = $state<string | null>(null);
  const addCategory = () => {
    const id = uid();
    c.grades.push({ id, name: "New category", weight: 0, scores: [] });
    openCat = id;
  };
  const weightTotal = $derived(c.grades.reduce((s, x) => s + (Number(x.weight) || 0), 0));
  const catAvg = (cat: Course["grades"][number]) => {
    const graded = cat.scores.filter((s) => s.earned !== null && s.total > 0);
    const tot = graded.reduce((a, s) => a + s.total, 0);
    return tot ? (graded.reduce((a, s) => a + (s.earned ?? 0), 0) / tot) * 100 : null;
  };

  let newTask = $state("");
  const ring = $derived(2 * Math.PI * 34);
</script>

<svelte:window onclick={() => (menu = null)} onkeydown={(e) => e.key === "Escape" && (menu = null)} />

<div class="course fade-in" style="--c:{color}">
  <header class="top">
    <button class="btn icon back" onclick={() => go("courses")} aria-label="Back to classes"><Icon name="left" /></button>
    <div class="titles">
      <div class="eyebrow">{[c.code, c.instructor].filter(Boolean).join(" · ") || "Class"}</div>
      <h1>{c.name}</h1>
    </div>
    <div class="spacer"></div>
    {#each c.links as l (l.id)}
      <button class="btn sm link" onclick={() => openUrl(l.url)}><Icon name="link" size={14} /> {l.label}</button>
    {/each}
    <button class="btn" onclick={() => (ui.courseDraft = $state.snapshot(c))}><Icon name="edit" size={15} /> Edit</button>
  </header>

  <div class="cols">
    <div class="col">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Sections</h2>
            <div class="small faint">
              {#if next}You're on <b class="mono on">{next.label}</b>{last ? ` · finished through ${last.label}` : ""}{:else if p.total}Everything's done{:else}Add the sections, chapters, weeks or labs for this class{/if}
            </div>
          </div>
          <div class="legend small">
            {#each ["todo", "doing", "done", "review"] as st}
              <span><i class="sw {st}"></i>{STATUS_LABEL[st as SectionStatus]}</span>
            {/each}
          </div>
        </div>

        <div class="add-row">
          <input class="field" placeholder="Add sections: 3.1-3.6  ·  4.1, 4.2  ·  Lab 1-8  ·  Week 1-14" bind:value={addText} onkeydown={(e) => e.key === "Enter" && addSections()} />
          <button class="btn primary" onclick={addSections} disabled={!preview.length}>Add{preview.length ? ` ${preview.length}` : ""}</button>
        </div>
        {#if preview.length}
          <div class="preview small faint fade-in">Will add: <span class="mono">{preview.slice(0, 14).join("  ")}{preview.length > 14 ? "  …" : ""}</span></div>
        {/if}

        {#each groups as grp (grp.group)}
          {@const gd = grp.items.filter((s) => s.status === "done").length}
          <div class="group">
            <div class="ghead"><span class="eyebrow">{grp.group}</span><span class="mono small faint">{gd}/{grp.items.length}</span></div>
            <div class="chips">
              {#each grp.items as s (s.id)}
                <button
                  class="chip {s.status}"
                  class:next={next?.id === s.id}
                  onclick={(e) => clickChip(e, s)}
                  oncontextmenu={(e) => openMenu(e, s)}
                  title="{s.label}: {STATUS_LABEL[s.status]}{s.due ? ` · due ${fmtDay(s.due)}` : ''} — click to change, shift-click = done through here, right-click for more"
                >
                  {#if s.status === "done"}<Icon name="check" size={12} stroke={2.4} />{/if}
                  <span class="mono">{s.label}</span>
                  {#if s.due && s.status !== "done"}<i class="due-dot"></i>{/if}
                </button>
              {/each}
            </div>
          </div>
        {/each}
        {#if c.sections.length}
          <p class="small faint tip">Click a section to cycle its status. <b>Shift-click</b> marks it and everything before it done. Right-click for more options.</p>
        {/if}
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Deadlines</h2>
          <div class="hstack">
            {#if pastCount}<button class="btn sm ghost" onclick={() => (showPast = !showPast)}>{showPast ? "Hide" : "Show"} past ({pastCount})</button>{/if}
            <button class="btn sm" onclick={() => (ui.deadlineDraft = newDeadline({ courseId: c.id }))}><Icon name="plus" size={14} /> Add</button>
          </div>
        </div>
        {#each shownDeadlines as d (d.id)}<DeadlineRow {d} />{:else}<div class="empty">No upcoming deadlines.</div>{/each}
      </section>
    </div>

    <div class="col">
      <section class="panel overview">
        <svg width="84" height="84" viewBox="0 0 84 84" class="ring">
          <circle cx="42" cy="42" r="34" stroke="var(--line)" stroke-width="7" fill="none" />
          <circle cx="42" cy="42" r="34" stroke="var(--c)" stroke-width="7" fill="none" stroke-linecap="round"
            stroke-dasharray={ring} stroke-dashoffset={ring * (1 - p.pct / 100)} transform="rotate(-90 42 42)" />
          <text x="42" y="47" text-anchor="middle" class="ring-txt">{p.pct}%</text>
        </svg>
        <div class="ov-stats">
          <div><b>{p.done}</b> <span class="faint">of {p.total} sections done</span></div>
          {#if p.review}<div><b class="review-txt">{p.review}</b> <span class="faint">need review</span></div>{/if}
          {#if c.meetings.length}
            <div class="meet small">
              {#each c.meetings as m (m.id)}
                <span class="tag">{DAY_SHORT[m.day]} {fmtTime(m.start)} · {m.kind}{m.place ? ` · ${m.place}` : ""}</span>
              {/each}
            </div>
          {/if}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Grades</h2>
          <button class="btn sm" onclick={addCategory}><Icon name="plus" size={14} /> Category</button>
        </div>
        <div class="grade-top">
          <div class="current">
            <span class="g-letter">{letter(g.current)}</span>
            <span class="mono">{g.current !== null ? `${g.current.toFixed(1)}%` : "No grades yet"}</span>
          </div>
          <label class="target small">
            Goal
            <input class="field" type="number" min="0" max="100" bind:value={c.target} placeholder="90" />
          </label>
        </div>
        {#if c.target && g.needed !== null}
          <div class="needed small" class:hard={g.needed > 100} class:easy={g.needed <= 0}>
            {#if g.needed > 100}You'd need {g.needed.toFixed(0)}% on the remaining {g.remainingWeight.toFixed(0)}% of the grade — {c.target}% is likely out of reach.
            {:else if g.needed <= 0}You've already locked in {c.target}%. 🎉
            {:else}To finish at {c.target}%, average <b>{g.needed.toFixed(1)}%</b> on the remaining {g.remainingWeight.toFixed(0)}% of the grade.{/if}
          </div>
        {/if}

        {#each c.grades as cat (cat.id)}
          {@const avg = catAvg(cat)}
          <div class="cat">
            <button class="cat-head" onclick={() => (openCat = openCat === cat.id ? null : cat.id)}>
              <Icon name={openCat === cat.id ? "down" : "right"} size={14} />
              <span class="grow">{cat.name}</span>
              <span class="mono small faint">{cat.weight || 0}%</span>
              <span class="mono small avg">{avg !== null ? `${avg.toFixed(0)}%` : "—"}</span>
            </button>
            {#if openCat === cat.id}
              <div class="cat-body fade-in">
                <div class="cat-edit">
                  <input class="field" bind:value={cat.name} aria-label="Category name" />
                  <label class="w"><input class="field" type="number" min="0" max="100" bind:value={cat.weight} aria-label="Weight" /><span class="faint small">% of grade</span></label>
                  <button class="btn icon sm ghost danger" onclick={() => (c.grades = c.grades.filter((x) => x.id !== cat.id))} aria-label="Delete category"><Icon name="trash" size={14} /></button>
                </div>
                {#each cat.scores as s (s.id)}
                  <div class="score">
                    <input class="field" bind:value={s.name} aria-label="Item name" />
                    <input class="field num" type="number" min="0" placeholder="—" value={s.earned ?? ""} oninput={(e) => (s.earned = e.currentTarget.value === "" ? null : Number(e.currentTarget.value))} aria-label="Points earned" />
                    <span class="faint">/</span>
                    <input class="field num" type="number" min="0" bind:value={s.total} aria-label="Points possible" />
                    <button class="btn icon sm ghost" onclick={() => (cat.scores = cat.scores.filter((x) => x.id !== s.id))} aria-label="Remove"><Icon name="close" size={13} /></button>
                  </div>
                {/each}
                <button class="btn sm ghost add-score" onclick={() => cat.scores.push({ id: uid(), name: `${cat.name.replace(/s$/, "")} ${cat.scores.length + 1}`, earned: null, total: cat.scores.at(-1)?.total ?? 100 })}>
                  <Icon name="plus" size={13} /> Add item
                </button>
              </div>
            {/if}
          </div>
        {:else}
          <div class="small faint">Add categories like Homework 20%, Midterms 40%, Final 40% from your syllabus. Leave scores blank for work that isn't graded yet.</div>
        {/each}
        {#if c.grades.length && weightTotal !== 100}<div class="small warn-txt">Weights add up to {weightTotal}%, not 100%.</div>{/if}
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Tasks</h2></div>
        {#each tasks as t (t.id)}<TodoRow {t} />{/each}
        <input class="field" placeholder="Add a task for {c.code || c.name}…" bind:value={newTask}
          onkeydown={(e) => { if (e.key === "Enter" && newTask.trim()) { addTodo(newTask.trim(), { courseId: c.id }); newTask = ""; } }} />
      </section>

      <section class="panel">
        <div class="panel-head"><h2>Notes</h2></div>
        <textarea class="field notes" bind:value={c.notes} placeholder="Office hours, exam rules, things to remember…"></textarea>
      </section>
    </div>
  </div>
</div>

{#if menu}
  {@const s = menu.s}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="menu panel" style="left:{menu.x}px;top:{menu.y}px" onclick={(e) => e.stopPropagation()}>
    <input class="field" bind:value={rename} onblur={applyRename} onkeydown={(e) => e.key === "Enter" && (applyRename(), (menu = null))} aria-label="Section label" />
    <input class="field" placeholder="Title (optional)" bind:value={s.title} aria-label="Section title" />
    {#each ["todo", "doing", "done", "review"] as st}
      <button class="mi" class:on={s.status === st} onclick={() => setStatus(st as SectionStatus)}><i class="sw {st}"></i>{STATUS_LABEL[st as SectionStatus]}</button>
    {/each}
    <div class="sep"></div>
    <button class="mi" onclick={() => (doneThrough(s), (menu = null))}><Icon name="check" size={14} /> Done through {s.label}</button>
    <label class="mi due"><Icon name="clock" size={14} /> Due <input class="field" type="date" bind:value={s.due} /></label>
    <button class="mi danger" onclick={removeSection}><Icon name="trash" size={14} /> Delete section</button>
  </div>
{/if}

<style>
  .course { display: grid; gap: 18px; }
  .top { display: flex; align-items: center; gap: 12px; padding-top: 14px; color: var(--hero-ink); text-shadow: var(--hero-shadow); }
  .top .btn { text-shadow: none; color: var(--ink); }
  .titles .eyebrow { color: inherit; opacity: 0.85; }
  .top h1 { font-size: 44px; line-height: 1.05; }
  .back { flex: none; }
  .cols { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr); gap: 18px; align-items: start; }
  .col { display: grid; gap: 18px; }
  .on { color: var(--c); font-weight: 600; }
  .legend { display: flex; gap: 12px; color: var(--ink-3); flex-wrap: wrap; justify-content: flex-end; }
  .legend span { display: inline-flex; align-items: center; gap: 5px; }
  .sw { width: 10px; height: 10px; border-radius: 3px; display: inline-block; border: 1.5px solid var(--ink-3); }
  .sw.doing { border-color: var(--doing); background: color-mix(in srgb, var(--doing) 30%, transparent); }
  .sw.done { border-color: var(--c, var(--accent)); background: var(--c, var(--accent)); }
  .sw.review { border-color: var(--review); background: color-mix(in srgb, var(--review) 30%, transparent); }
  .add-row { display: flex; gap: 8px; }
  .preview { margin-top: 6px; }
  .group { margin-top: 16px; }
  .ghead { display: flex; align-items: baseline; gap: 10px; margin-bottom: 7px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    position: relative; display: inline-flex; align-items: center; gap: 5px; height: 32px; min-width: 52px; justify-content: center;
    padding: 0 11px; border-radius: 10px; border: 1.5px solid var(--line-strong); background: var(--field); cursor: pointer;
    font-size: 12.5px; transition: background 0.12s, border-color 0.12s, transform 0.08s;
  }
  .chip:hover { border-color: var(--ink-3); }
  .chip:active { transform: scale(0.96); }
  .chip.doing { border-color: var(--doing); background: color-mix(in srgb, var(--doing) 16%, var(--field)); }
  .chip.done { border-color: transparent; background: var(--c); color: #fff; }
  .chip.review { border-color: var(--review); background: color-mix(in srgb, var(--review) 14%, var(--field)); }
  .chip.next { box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 30%, transparent); }
  .due-dot { position: absolute; top: 4px; right: 4px; width: 5px; height: 5px; border-radius: 50%; background: var(--warn); }
  .tip { margin: 16px 0 0; }

  .overview { display: flex; gap: 18px; align-items: center; }
  .ring-txt { font-family: var(--font-display); font-size: 19px; fill: var(--ink); }
  .ov-stats { display: grid; gap: 4px; }
  .review-txt { color: var(--review); }
  .meet { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }

  .grade-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .current { display: flex; align-items: baseline; gap: 10px; }
  .g-letter { font-family: var(--font-display); font-size: 44px; line-height: 1; }
  .target { display: flex; align-items: center; gap: 8px; color: var(--ink-2); }
  .target .field { width: 74px; height: 32px; }
  .needed { padding: 10px 12px; border-radius: var(--r-sm); background: var(--accent-soft); margin-bottom: 10px; }
  .needed.hard { background: var(--warn-soft); }
  .cat { border-top: 1px solid var(--line); }
  .cat-head { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 0; border: 0; background: none; cursor: pointer; text-align: left; }
  .grow { flex: 1; font-weight: 500; }
  .avg { width: 44px; text-align: right; }
  .cat-body { display: grid; gap: 6px; padding: 0 0 12px 22px; }
  .cat-edit { display: grid; grid-template-columns: 1fr 150px 28px; gap: 6px; align-items: center; margin-bottom: 4px; }
  .cat-edit .w { display: flex; align-items: center; gap: 6px; }
  .cat-edit .w .field { width: 64px; }
  .score { display: grid; grid-template-columns: 1fr 64px 8px 64px 28px; gap: 6px; align-items: center; }
  .field.num { text-align: right; font-family: var(--font-mono); font-size: 12.5px; }
  .cat .field { height: 30px; }
  .add-score { justify-self: start; }
  .warn-txt { color: var(--warn); margin-top: 8px; }
  .notes { min-height: 120px; }

  .menu { position: fixed; z-index: 70; width: 230px; padding: 8px; display: grid; gap: 2px; --glass: 0.95; }
  .menu .field { height: 30px; margin-bottom: 4px; }
  .mi { display: flex; align-items: center; gap: 9px; padding: 7px 8px; border: 0; background: none; border-radius: 8px; cursor: pointer; font-size: 13px; text-align: left; }
  .mi:hover, .mi.on { background: var(--panel-hover); }
  .mi.on { font-weight: 600; }
  .mi.danger { color: var(--warn); }
  .mi.due .field { height: 28px; margin: 0 0 0 auto; width: 128px; }
  .sep { height: 1px; background: var(--line); margin: 4px 0; }
  @media (max-width: 1180px) { .cols { grid-template-columns: 1fr; } }
</style>
