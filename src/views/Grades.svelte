<script lang="ts">
  import type { Course, GradeCategory } from "../lib/types";
  import { activeCourses, go, toast, uid } from "../lib/store.svelte";
  import { colorOf } from "../lib/colors";
  import { confirmDialog } from "../lib/platform";
  import { fmt, finalCategory, finishWith, letter, neededOn, parseScores, scaleOf, SCALES, summarize } from "../lib/grades";
  import GradeBar from "../components/GradeBar.svelte";
  import Icon from "../components/Icon.svelte";

  let { course: c }: { course?: Course } = $props();

  const courses = $derived(activeCourses());
  const g = $derived(c ? summarize(c) : null);
  const T = $derived(g?.totalWeight || 100);
  const ofCourse = (x: number) => (x / T) * 100; // course-grade points → percent of the whole course
  const weightTotal = $derived(c ? c.grades.reduce((s, x) => s + (Number(x.weight) || 0), 0) : 0);

  /** Reads an optional number input: empty → undefined. */
  const optNum = (e: Event) => {
    const v = (e.currentTarget as HTMLInputElement).value;
    return v === "" ? undefined : Number(v);
  };

  // ---------- categories ----------
  let closed = $state(new Set<string>());
  const toggle = (id: string) => {
    const next = new Set(closed);
    next.has(id) ? next.delete(id) : next.add(id);
    closed = next;
  };

  function addCategory() {
    c!.grades.push({ id: uid(), name: "New category", weight: 0, scores: [] });
  }

  async function removeCategory(cat: GradeCategory) {
    if (cat.scores.some((s) => s.earned !== null) && !(await confirmDialog(`Delete ${cat.name} and its ${cat.scores.length} scores?`))) return;
    c!.grades = c!.grades.filter((x) => x.id !== cat.id);
  }

  /** "Labs" → "Lab 3", "Quizzes" → "Quiz 3", "Homework" → "Homework 3". */
  const singular = (w: string) => w.replace(/zzes$/i, "z").replace(/(ches|shes|xes|sses)$/i, (m) => m.slice(0, -2)).replace(/([^s])s$/i, "$1");
  const itemName = (cat: GradeCategory, n: number) => `${singular(cat.name.trim())} ${n}`.trim();
  const lastTotal = (cat: GradeCategory) => cat.scores.at(-1)?.total || 100;

  function addItem(cat: GradeCategory, earned: number | null = null, total = lastTotal(cat)) {
    cat.scores.push({ id: uid(), name: itemName(cat, cat.scores.length + 1), earned, total });
  }

  /** Adds placeholder rows for items the syllabus says are coming. */
  function fillMissing(cat: GradeCategory, n: number) {
    for (let i = 0; i < n; i++) addItem(cat);
  }

  let quick = $state<Record<string, string>>({});
  function quickAdd(cat: GradeCategory) {
    const parsed = parseScores(quick[cat.id] ?? "", lastTotal(cat));
    if (!parsed.length) return toast("Type scores like 18/20, 17/20, 19");
    // Fill empty rows first, then add new ones.
    for (const p of parsed) {
      const empty = cat.scores.find((s) => s.earned === null && !s.excused && s.total === p.total);
      if (empty && p.earned !== null) empty.earned = p.earned;
      else addItem(cat, p.earned, p.total);
    }
    toast(`Added ${parsed.length} score${parsed.length > 1 ? "s" : ""} to ${cat.name}`);
    quick[cat.id] = "";
  }

  // Syllabus quick setup: "Homework 20, Labs 10, Midterm 30, Final 40"
  let syllabus = $state("");
  const syllabusParsed = $derived(
    [...syllabus.matchAll(/([A-Za-z][A-Za-z &'/-]*?)\s*[:=-]?\s*(\d+(?:\.\d+)?)\s*%?/g)].map((m) => ({ name: m[1].trim(), weight: Number(m[2]) })),
  );
  function applySyllabus() {
    for (const p of syllabusParsed) c!.grades.push({ id: uid(), name: p.name, weight: p.weight, scores: [], final: /final/i.test(p.name) || undefined });
    toast(`Added ${syllabusParsed.length} categories`);
    syllabus = "";
  }

  // ---------- final exam calculator ----------
  const withRemaining = $derived(g ? g.cats.filter((x) => x.remaining > 0.0001) : []);
  const finalId = $derived.by(() => {
    if (!c || !g) return null;
    const f = finalCategory(c);
    if (f && withRemaining.some((x) => x.cat.id === f.id)) return f.id;
    return [...withRemaining].sort((a, b) => b.remaining - a.remaining)[0]?.cat.id ?? null;
  });
  const finalRes = $derived(g?.cats.find((x) => x.cat.id === finalId));
  const otherRemaining = $derived(g && finalRes ? g.remaining - finalRes.remaining : 0);
  let assumeInput = $state<number | undefined>(undefined);
  const assume = $derived(assumeInput ?? Math.round(g?.current ?? 80));
  let ifScore = $state<number | undefined>(undefined);

  function pickFinal(id: string) {
    c!.grades.forEach((x) => (x.final = x.id === id || undefined));
  }

  const rows = $derived.by(() => {
    if (!c || !g || !finalId) return [];
    const cut = scaleOf(c).filter((s) => Number(s.min) > 0);
    const list = cut.map((s) => ({ label: s.letter, min: Number(s.min), goal: false }));
    if (c.target && !cut.some((s) => Number(s.min) === Number(c!.target))) list.push({ label: "Goal", min: Number(c.target), goal: true });
    return list
      .sort((a, b) => b.min - a.min)
      .map((r) => ({ ...r, need: neededOn(g, finalId, r.min, assume) }));
  });

  // ---------- grading scale ----------
  let editScale = $state(false);
  const scale = $derived(c ? scaleOf(c) : []);
  function ensureScale() {
    if (c && !c.scale?.length) c.scale = scaleOf(c).map((s) => ({ ...s }));
  }
  function usePreset(id: string) {
    const p = SCALES.find((s) => s.id === id);
    if (c && p) c.scale = p.scale.map((s) => ({ ...s }));
  }
  const presetId = $derived(c ? (SCALES.find((p) => JSON.stringify(p.scale) === JSON.stringify(scale.map((s) => ({ min: Number(s.min), letter: s.letter })))) ?? null)?.id ?? "custom" : "custom");

  // ---------- overview (all classes) ----------
  const overview = $derived(courses.map((x) => ({ c: x, g: summarize(x) })));
  const avgAll = $derived.by(() => {
    const vals = overview.map((o) => o.g.current).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });
</script>

{#if !c || !g}
  <!-- ================= all classes ================= -->
  <div class="grades fade-in">
    <header class="top">
      <div class="titles">
        <div class="eyebrow">{avgAll !== null ? `Average across classes ${fmt(avgAll)}` : "Gradebook"}</div>
        <h1>Grades</h1>
      </div>
    </header>
    <div class="ov-grid">
      {#each overview as { c: x, g: og } (x.id)}
        <button class="panel ov-card" style="--c:{colorOf(x.color)}" onclick={() => go("grades", x.id)}>
          <div class="ov-top">
            <div>
              <div class="eyebrow">{x.code || "—"}</div>
              <h2>{x.name}</h2>
            </div>
            <div class="ov-grade">
              <span class="g-letter">{letter(og.current, x)}</span>
              <span class="mono small faint">{fmt(og.current)}</span>
            </div>
          </div>
          {#if x.grades.length}
            <GradeBar g={og} legend={false} height={8} />
            <div class="small faint ov-line">
              Earned <b class="mono">{fmt((og.earned / (og.totalWeight || 100)) * 100)}</b> so far · <b class="mono">{fmt((og.remaining / (og.totalWeight || 100)) * 100)}</b> still to come
            </div>
            {#if x.target && og.needed !== null}
              <div class="small ov-line" class:warn-txt={og.needed > 100}>
                {og.needed <= 0 ? `${x.target}% goal locked in` : og.needed > 100 ? `${x.target}% goal out of reach` : `Need ${fmt(og.needed)} on the rest for ${x.target}%`}
              </div>
            {/if}
          {:else}
            <div class="small faint">No grade categories yet — open to set up from your syllabus.</div>
          {/if}
        </button>
      {:else}
        <div class="panel empty">Add a class first, then track its grades here.</div>
      {/each}
    </div>
  </div>
{:else}
  <!-- ================= one class ================= -->
  <div class="grades fade-in" style="--c:{colorOf(c.color)}">
    <header class="top">
      <button class="btn icon back" onclick={() => go("course", c.id)} aria-label="Back to class"><Icon name="left" /></button>
      <div class="titles">
        <div class="eyebrow">{c.code ? `${c.code} · ` : ""}Gradebook</div>
        <h1>{c.name}</h1>
      </div>
      <div class="spacer"></div>
      <div class="seg switch">
        <button onclick={() => go("grades")}>All</button>
        {#each courses as x (x.id)}
          <button class:on={x.id === c.id} onclick={() => go("grades", x.id)}>{x.code || x.name}</button>
        {/each}
      </div>
    </header>

    <!-- summary -->
    <section class="panel summary">
      <div class="big-grade">
        <span class="g-letter">{letter(g.current, c)}</span>
        <div>
          <div class="cur mono">{fmt(g.current, 2)}</div>
          <div class="small faint">{g.current === null ? "No grades entered yet" : "on work graded so far"}</div>
        </div>
      </div>
      <div class="sum-main">
        <div class="eyebrow">Of your whole course grade</div>
        <GradeBar {g} height={14} />
      </div>
      <div class="tiles">
        <div class="tile"><span class="eyebrow">Locked in</span><b>{fmt(ofCourse(g.earned))}</b><span class="small faint">of {fmt(ofCourse(g.graded))} graded</span></div>
        <div class="tile"><span class="eyebrow">Keep this pace</span><b>{fmt(g.projected)}</b><span class="small faint">{g.projected !== null ? letter(g.projected, c) : "—"} at the end</span></div>
        <div class="tile"><span class="eyebrow">Best case</span><b>{fmt(g.max)}</b><span class="small faint">100% on the rest</span></div>
        <div class="tile"><span class="eyebrow">Worst case</span><b>{fmt(g.min)}</b><span class="small faint">0% on the rest</span></div>
      </div>
    </section>

    <div class="cols">
      <!-- categories -->
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Breakdown</h2>
            <div class="small faint">What each part is worth, and how much of it you've earned</div>
          </div>
          <button class="btn sm" onclick={addCategory}><Icon name="plus" size={14} /> Category</button>
        </div>

        {#if !c.grades.length}
          <div class="setup">
            <p class="small muted">Copy the grade breakdown from your syllabus:</p>
            <div class="add-row">
              <input class="field" placeholder="Homework 20, Labs 10, Midterm 30, Final 40" bind:value={syllabus} onkeydown={(e) => e.key === "Enter" && syllabusParsed.length && applySyllabus()} />
              <button class="btn primary" disabled={!syllabusParsed.length} onclick={applySyllabus}>Add{syllabusParsed.length ? ` ${syllabusParsed.length}` : ""}</button>
            </div>
            {#if syllabusParsed.length}
              <div class="small faint">{syllabusParsed.map((p) => `${p.name} ${p.weight}%`).join(" · ")}</div>
            {/if}
          </div>
        {/if}

        {#each g.cats as r (r.cat.id)}
          {@const cat = r.cat}
          {@const open = !closed.has(cat.id)}
          <div class="cat">
            <button class="cat-head" onclick={() => toggle(cat.id)}>
              <Icon name={open ? "down" : "right"} size={14} />
              <span class="cname">{cat.name}</span>
              {#if r.slots && Number(cat.best) > 0}<span class="tag">best {r.slots} of {r.items.filter((i) => i.status !== "excused").length + r.missing}</span>{/if}
              {#if cat.final}<span class="tag accent">final</span>{/if}
              <span class="spacer"></span>
              <span class="mono small faint" title="Category average">{fmt(r.avg, 1)}</span>
              <span class="contrib mono small" title="Course-grade points earned out of this category's weight">
                <b>{r.earned.toFixed(2).replace(/\.?0+$/, "")}</b><span class="faint"> / {r.weight}%</span>
              </span>
            </button>
            <div class="cbar" title="Earned · lost · to come">
              <i class="e" style="width:{r.weight ? (r.earned / r.weight) * 100 : 0}%"></i>
              <i class="l" style="width:{r.weight ? ((r.graded - r.earned) / r.weight) * 100 : 0}%"></i>
            </div>

            {#if open}
              {@const zeros = cat.scores.filter((s) => s.earned === 0 && !s.excused)}
              <div class="cat-body fade-in">
                <div class="cat-edit">
                  <label class="lbl">Name<input class="field" bind:value={cat.name} /></label>
                  <label class="lbl">Worth<span class="suffix"><input class="field num" type="number" min="0" max="100" step="any" bind:value={cat.weight} /><i>%</i></span></label>
                  <label class="lbl" title="Total number of items, including ones not handed back yet">How many<input class="field num" type="number" min="0" placeholder={String(cat.scores.length || "—")} value={cat.expected ?? ""} oninput={(e) => (cat.expected = optNum(e))} /></label>
                  <label class="lbl" title="Only your best N count. Leave blank to count all.">Count best<input class="field num" type="number" min="0" placeholder="all" value={cat.best ?? ""} oninput={(e) => (cat.best = optNum(e))} /></label>
                  <button class="btn icon sm ghost danger del" onclick={() => removeCategory(cat)} aria-label="Delete category" title="Delete category"><Icon name="trash" size={14} /></button>
                </div>
                <div class="opts small">
                  <label><input type="checkbox" checked={!!cat.equal} onchange={(e) => (cat.equal = e.currentTarget.checked || undefined)} /> Every item counts equally <span class="faint">(otherwise by points)</span></label>
                  <label><input type="checkbox" checked={!!cat.final} onchange={(e) => (e.currentTarget.checked ? pickFinal(cat.id) : (cat.final = undefined))} /> This is the final exam</label>
                </div>

                {#if cat.scores.length}
                  <div class="items">
                    <div class="irow ihead eyebrow">
                      <span>Item</span><span class="r">Score</span><span class="r">%</span><span class="r" title="How much of the course grade this is worth">Worth</span><span class="r" title="How much of the course grade you got">Got</span><span></span>
                    </div>
                    {#each r.items as it (it.score.id)}
                      {@const s = it.score}
                      <div class="irow {it.status}">
                        <input class="field" bind:value={s.name} aria-label="Item name" />
                        <span class="score">
                          <input class="field num" type="number" min="0" step="any" placeholder="blank" title="Leave blank if it isn't graded yet" value={s.earned ?? ""} oninput={(e) => (s.earned = optNum(e) ?? null)} aria-label="Points earned" />
                          <span class="faint">/</span>
                          <input class="field num" type="number" min="0" step="any" bind:value={s.total} aria-label="Points possible" />
                        </span>
                        <span class="r mono small" class:faint={it.status === "pending"}>{it.status === "pending" ? "not yet" : fmt(it.pct, 1)}</span>
                        <span class="r mono small faint">{it.status === "dropped" ? "dropped" : it.status === "excused" ? "excused" : fmt(ofCourse(it.worth), 2)}</span>
                        <span class="r mono small got">{it.got !== null && it.status === "counted" ? fmt(ofCourse(it.got), 2) : "—"}</span>
                        <span class="acts">
                          <button class="btn icon sm ghost ex" class:on={s.excused} onclick={() => (s.excused = !s.excused || undefined)} title={s.excused ? "Count this item again" : "Excuse — leave out of the grade"} aria-label="Excuse">EX</button>
                          <button class="btn icon sm ghost" onclick={() => (cat.scores = cat.scores.filter((x) => x.id !== s.id))} aria-label="Remove item"><Icon name="close" size={13} /></button>
                        </span>
                      </div>
                    {/each}
                  </div>
                {/if}

                {#if zeros.length}
                  <div class="zero-note small">
                    <span>{zeros.map((s) => s.name).join(", ")} {zeros.length === 1 ? "has" : "have"} a 0, which counts as a zero. Not graded yet? Leave the score blank instead.</span>
                    <button class="btn sm" onclick={() => zeros.forEach((s) => (s.earned = null))}>Clear {zeros.length === 1 ? "it" : "them"}</button>
                  </div>
                {/if}
                {#if !cat.expected && cat.scores.length && r.remaining < 0.0001 && !cat.scores.some((s) => s.earned === null)}
                  <div class="small faint">Everything here is graded. More {cat.name.toLowerCase()} coming? Set <b>How many</b> so they count as still to come.</div>
                {/if}
                {#if r.missing}
                  <div class="missing small">
                    <span class="faint">{r.missing} more {r.missing === 1 ? "item" : "items"} to come · worth {fmt(ofCourse(r.missingWorth), 2)} each</span>
                    <button class="btn sm ghost" onclick={() => fillMissing(cat, r.missing)}>Add rows</button>
                  </div>
                {/if}

                <div class="add-row">
                  <button class="btn sm" onclick={() => addItem(cat)}><Icon name="plus" size={13} /> Item</button>
                  <input class="field quick" placeholder="Quick enter: 18/20, 17/20, 19, 95%" bind:value={quick[cat.id]} onkeydown={(e) => e.key === "Enter" && quickAdd(cat)} />
                </div>
              </div>
            {/if}
          </div>
        {/each}

        {#if c.grades.length && Math.abs(weightTotal - 100) > 0.001}
          <div class="small warn-txt">Weights add up to {weightTotal}%, not 100%. Percentages are scaled to {weightTotal}%.</div>
        {/if}
      </section>

      <div class="col">
        <!-- goal -->
        <section class="panel">
          <div class="panel-head">
            <h2>Goal</h2>
            <label class="target small">
              Finish with
              <span class="suffix"><input class="field num" type="number" min="0" max="100" step="any" placeholder="90" value={c.target ?? ""} oninput={(e) => (c.target = optNum(e))} /><i>%</i></span>
            </label>
          </div>
          {#if !c.target}
            <div class="small faint">Set a goal to see what you need on the rest of the class.</div>
          {:else if g.needed === null}
            <div class="needed small">{g.min >= c.target ? `Everything's graded — you finished with ${fmt(g.min)}.` : `Everything's graded — you finished with ${fmt(g.min)}, short of ${c.target}%.`}</div>
          {:else if g.needed > 100}
            <div class="needed small hard">You'd need <b>{fmt(g.needed)}</b> on the remaining {fmt(ofCourse(g.remaining))} of the class. The best you can finish with is {fmt(g.max)}.</div>
          {:else if g.needed <= 0}
            <div class="needed small">You've already locked in {c.target}% — even zeros on the rest keep you there. 🎉</div>
          {:else}
            <div class="needed small">Average <b>{fmt(g.needed)}</b> on the remaining {fmt(ofCourse(g.remaining))} of the class to finish at {c.target}% ({letter(c.target, c)}).</div>
          {/if}
        </section>

        <!-- final calculator -->
        <section class="panel">
          <div class="panel-head"><h2>What do I need on the final?</h2></div>
          {#if !finalId || !finalRes}
            <div class="small faint">{c.grades.length ? "Nothing left to grade." : "Add grade categories first."}</div>
          {:else}
            <div class="calc-opts">
              <label class="lbl">Final is
                <select class="field" value={finalId} onchange={(e) => pickFinal(e.currentTarget.value)}>
                  {#each withRemaining as x (x.cat.id)}<option value={x.cat.id}>{x.cat.name} ({fmt(ofCourse(x.remaining))} left)</option>{/each}
                </select>
              </label>
              {#if otherRemaining > 0.0001}
                <label class="lbl" title="What you expect to average on everything else that isn't graded yet">Rest of the work
                  <span class="suffix"><input class="field num" type="number" min="0" max="150" step="any" placeholder={String(assume)} value={assumeInput ?? ""} oninput={(e) => (assumeInput = optNum(e))} /><i>%</i></span>
                </label>
              {/if}
            </div>
            {#if otherRemaining > 0.0001}
              <div class="small faint assume-note">Assuming you average {assume}% on the other {fmt(ofCourse(otherRemaining))} still to come{assumeInput === undefined ? " (your current average)" : ""}.</div>
            {/if}
            <div class="need-table">
              {#each rows as row (row.label + row.min)}
                {@const n = row.need}
                <div class="nrow" class:goal={row.goal} class:locked={n !== null && n <= 0} class:out={n !== null && n > 100}>
                  <span class="nl">{row.label}</span>
                  <span class="mono small faint">{row.min}%+</span>
                  <span class="bar nb"><i style="width:{n === null ? 0 : Math.max(0, Math.min(100, n))}%"></i></span>
                  <span class="mono nv">{n === null ? "—" : n <= 0 ? "locked in" : n > 100 ? "out of reach" : fmt(n)}</span>
                </div>
              {/each}
            </div>
            <div class="whatif small">
              If I get
              <span class="suffix"><input class="field num" type="number" min="0" max="150" step="any" placeholder="75" bind:value={ifScore} /><i>%</i></span>
              on the {finalRes.cat.name.toLowerCase()}, I finish with
              {#if ifScore !== undefined && ifScore !== null}
                {@const f = finishWith(g, finalId, Number(ifScore), assume)}
                <b class="mono">{fmt(f, 2)}</b> <span class="tag accent">{letter(f, c)}</span>
              {:else}<span class="faint">…</span>{/if}
            </div>
          {/if}
        </section>

        <!-- scale -->
        <section class="panel">
          <div class="panel-head">
            <h2>Grading scale</h2>
            <div class="hstack">
              <select class="field preset" value={presetId} onchange={(e) => usePreset(e.currentTarget.value)} aria-label="Scale preset">
                {#each SCALES as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
                {#if presetId === "custom"}<option value="custom">Custom</option>{/if}
              </select>
              <button class="btn sm ghost" onclick={() => { ensureScale(); editScale = !editScale; }}>{editScale ? "Done" : "Edit"}</button>
            </div>
          </div>
          {#if editScale && c.scale}
            <div class="scale-edit">
              {#each c.scale as s, i (i)}
                <div class="srow">
                  <input class="field" bind:value={s.letter} aria-label="Letter" />
                  <span class="suffix"><input class="field num" type="number" min="0" max="100" step="any" bind:value={s.min} aria-label="Minimum percent" /><i>%+</i></span>
                  <button class="btn icon sm ghost" onclick={() => c.scale!.splice(i, 1)} aria-label="Remove"><Icon name="close" size={13} /></button>
                </div>
              {/each}
              <button class="btn sm ghost add-score" onclick={() => c.scale!.push({ letter: "", min: 0 })}><Icon name="plus" size={13} /> Cutoff</button>
            </div>
          {:else}
            <div class="scale-chips">
              {#each scale as s (s.letter + s.min)}
                <span class="schip" class:cur={g.current !== null && letter(g.current, c) === s.letter}><b>{s.letter}</b><span class="mono small faint">{s.min}+</span></span>
              {/each}
            </div>
          {/if}
        </section>
      </div>
    </div>
  </div>
{/if}

<style>
  .grades { display: grid; gap: 18px; }
  .top { display: flex; align-items: center; gap: 12px; padding-top: 14px; color: var(--hero-ink); text-shadow: var(--hero-shadow); }
  .top .btn, .top .seg { text-shadow: none; color: var(--ink); }
  .titles .eyebrow { color: inherit; opacity: 0.85; }
  .top h1 { font-size: 44px; line-height: 1.05; }
  .switch { max-width: 60%; overflow-x: auto; }
  .g-letter { font-family: var(--font-display); font-size: 48px; line-height: 1; }

  /* overview */
  .ov-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
  .ov-card { display: grid; gap: 10px; text-align: left; cursor: pointer; border-top: 5px solid var(--c); transition: transform 0.18s; }
  .ov-card:hover { transform: translateY(-2px); }
  .ov-top { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .ov-grade { display: grid; justify-items: end; gap: 2px; }
  .ov-line b { color: var(--ink); font-weight: 500; }

  /* summary */
  .summary { display: grid; grid-template-columns: auto 1fr; gap: 18px 28px; align-items: center; }
  .big-grade { display: flex; align-items: center; gap: 14px; }
  .big-grade .g-letter { font-size: 64px; color: var(--c); }
  .cur { font-size: 22px; }
  .sum-main { display: grid; gap: 8px; }
  .tiles { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .tile { display: grid; gap: 2px; padding: 12px 14px; border-radius: var(--r-md); background: var(--field); border: 1px solid var(--line); }
  .tile b { font-family: var(--font-display); font-weight: 400; font-size: 26px; line-height: 1.1; }

  .cols { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(320px, 1fr); gap: 18px; align-items: start; }
  .col { display: grid; gap: 18px; }

  /* categories */
  .setup { display: grid; gap: 8px; margin-bottom: 8px; }
  .setup p { margin: 0; }
  .add-row { display: flex; gap: 8px; align-items: center; }
  .cat { border-top: 1px solid var(--line); padding-bottom: 4px; }
  .cat-head { display: flex; align-items: center; gap: 8px; width: 100%; padding: 12px 0 8px; border: 0; background: none; cursor: pointer; text-align: left; }
  .cname { font-weight: 600; }
  .contrib { min-width: 92px; text-align: right; }
  .contrib b { font-weight: 600; color: var(--c); }
  .cbar { display: flex; height: 4px; border-radius: 4px; overflow: hidden; background: var(--line); margin: 0 0 8px 22px; }
  .cbar i { display: block; height: 100%; transition: width 0.3s; }
  .cbar .e { background: var(--c); }
  .cbar .l { background: color-mix(in srgb, var(--warn) 55%, transparent); }
  .cat-body { display: grid; gap: 10px; padding: 4px 0 12px 22px; }
  .cat-edit { display: grid; grid-template-columns: minmax(0, 1fr) 84px 84px 84px 28px; gap: 8px; align-items: end; }
  .cat-edit .del { margin-bottom: 4px; }
  .opts { display: flex; flex-wrap: wrap; gap: 6px 18px; color: var(--ink-2); }
  .opts label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
  .opts input { accent-color: var(--c); }
  .field.num { text-align: right; font-family: var(--font-mono); font-size: 12.5px; padding: 0 8px; }
  .cat .field { height: 30px; }
  .suffix { position: relative; display: block; }
  .suffix .field { padding-right: 22px; }
  .suffix i { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-style: normal; font-size: 11.5px; color: var(--ink-3); pointer-events: none; }

  .items { display: grid; gap: 4px; }
  .irow { display: grid; grid-template-columns: minmax(80px, 1fr) 150px 52px 58px 58px 62px; gap: 6px; align-items: center; }
  .ihead { font-size: 10px; padding-bottom: 2px; }
  .r { text-align: right; }
  .score { display: grid; grid-template-columns: 1fr 8px 1fr; gap: 4px; align-items: center; }
  .got { color: var(--c); font-weight: 600; }
  .irow.dropped input, .irow.dropped .mono { text-decoration: line-through; opacity: 0.6; }
  .irow.excused { opacity: 0.5; }
  .acts { display: flex; justify-content: flex-end; }
  .ex { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 0.04em; color: var(--ink-3); }
  .ex.on { color: var(--warn); background: var(--warn-soft); }
  .missing { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border-radius: var(--r-sm); border: 1px dashed var(--line-strong); }
  .quick { flex: 1; }
  .zero-note { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border-radius: var(--r-sm); background: var(--warn-soft); color: var(--ink-2); }
  .warn-txt { color: var(--warn); margin-top: 8px; }

  /* goal */
  .target { display: flex; align-items: center; gap: 8px; color: var(--ink-2); }
  .target .suffix { width: 84px; }
  .target .field { height: 32px; }
  .needed { padding: 10px 12px; border-radius: var(--r-sm); background: var(--accent-soft); }
  .needed.hard { background: var(--warn-soft); }

  /* final calc */
  .calc-opts { display: grid; grid-template-columns: 1fr 110px; gap: 10px; }
  .calc-opts .field { height: 32px; }
  .assume-note { margin-top: 8px; }
  .need-table { display: grid; gap: 2px; margin-top: 12px; }
  .nrow { display: grid; grid-template-columns: 52px 46px 1fr 96px; gap: 10px; align-items: center; padding: 5px 8px; border-radius: 8px; }
  .nrow.goal { background: var(--accent-soft); }
  .nl { font-family: var(--font-display); font-size: 19px; line-height: 1; }
  .nb > i { background: var(--c); }
  .nv { text-align: right; font-size: 12.5px; }
  .nrow.locked .nv { color: var(--accent); }
  .nrow.out { opacity: 0.55; }
  .nrow.out .nv { color: var(--warn); }
  .nrow.out .nb > i { background: var(--warn); }
  .whatif { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--ink-2); }
  .whatif .suffix { width: 80px; }
  .whatif .field { height: 30px; }
  .whatif b { color: var(--ink); font-size: 15px; }

  /* scale */
  .preset { height: 28px; width: auto; font-size: 12px; }
  .scale-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .schip { display: inline-flex; align-items: baseline; gap: 5px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line); background: var(--field); }
  .schip.cur { border-color: var(--c); background: color-mix(in srgb, var(--c) 16%, var(--field)); }
  .scale-edit { display: grid; gap: 6px; }
  .srow { display: grid; grid-template-columns: 1fr 100px 28px; gap: 6px; }
  .srow .field { height: 30px; }
  .add-score { justify-self: start; }

  @media (max-width: 1180px) {
    .cols { grid-template-columns: 1fr; }
    .tiles { grid-template-columns: repeat(2, 1fr); }
  }
</style>
