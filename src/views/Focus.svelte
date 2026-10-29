<script lang="ts">
  import { activeCourses, courseById, db } from "../lib/store.svelte";
  import { timer, startTimer, pauseTimer, resetTimer, fmtClock } from "../lib/focus.svelte";
  import { colorOf } from "../lib/colors";
  import { addDays, DAY_SHORT, parse, startOfWeek, today, toStr } from "../lib/dates";
  import { nextUp } from "../lib/sections";
  import Icon from "../components/Icon.svelte";

  const total = $derived((timer.mode === "focus" ? db.settings.focusMinutes : db.settings.breakMinutes) * 60);
  const frac = $derived(1 - timer.remaining / total);
  const R = 132;
  const C = 2 * Math.PI * R;
  const course = $derived(courseById(timer.courseId));
  const next = $derived(course ? nextUp(course) : undefined);

  const t = today();
  const dayOf = (ms: number) => toStr(new Date(ms));
  const todayMin = $derived(db.focus.filter((f) => dayOf(f.at) === t).reduce((s, f) => s + f.minutes, 0));
  const weekStart = $derived(startOfWeek(t, db.settings.weekStartsMonday));
  const week = $derived(
    Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart, i);
      return { d, min: db.focus.filter((f) => dayOf(f.at) === d).reduce((s, f) => s + f.minutes, 0) };
    }),
  );
  const weekMax = $derived(Math.max(60, ...week.map((w) => w.min)));
  const weekTotal = $derived(week.reduce((s, w) => s + w.min, 0));
  const byCourse = $derived.by(() => {
    const m = new Map<string | null, number>();
    for (const f of db.focus) if (dayOf(f.at) >= weekStart) m.set(f.courseId, (m.get(f.courseId) ?? 0) + f.minutes);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  });
  const streak = $derived.by(() => {
    const days = new Set(db.focus.map((f) => dayOf(f.at)));
    let n = 0, d = days.has(t) ? t : addDays(t, -1);
    while (days.has(d)) { n++; d = addDays(d, -1); }
    return n;
  });
  const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}` : `${m}m`);

  function setLength(mode: "focus" | "break", delta: number) {
    const key = mode === "focus" ? "focusMinutes" : "breakMinutes";
    db.settings[key] = Math.max(1, Math.min(120, db.settings[key] + delta));
    if (!timer.running && timer.mode === mode) resetTimer(mode);
  }
</script>

<div class="page fade-in">
<header class="top"><h1>Focus</h1><p>{course ? `Studying ${course.code || course.name}` : "Pick a class, start the timer, and put your phone away."}</p></header>
<div class="focus">
  <section class="panel timer">
    <div class="seg">
      <button class:on={timer.mode === "focus"} onclick={() => resetTimer("focus")}>Focus</button>
      <button class:on={timer.mode === "break"} onclick={() => resetTimer("break")}>Break</button>
    </div>

    <div class="dial">
      <svg viewBox="0 0 300 300" width="300" height="300">
        <circle cx="150" cy="150" r={R} stroke="var(--line)" stroke-width="5" fill="none" />
        <circle cx="150" cy="150" r={R} stroke={course ? colorOf(course.color) : "var(--accent)"} stroke-width="5" fill="none" stroke-linecap="round"
          stroke-dasharray={C} stroke-dashoffset={C * (1 - frac)} transform="rotate(-90 150 150)" style="transition: stroke-dashoffset 1s linear" />
      </svg>
      <div class="readout">
        <div class="clock">{fmtClock(timer.remaining)}</div>
        <div class="eyebrow">{timer.mode === "focus" ? (timer.running ? "focusing" : "ready") : "break"}</div>
      </div>
    </div>

    <div class="len small faint">
      <button class="btn icon sm ghost" onclick={() => setLength(timer.mode, -5)} aria-label="Shorter">−</button>
      <span class="mono">{timer.mode === "focus" ? db.settings.focusMinutes : db.settings.breakMinutes} min</span>
      <button class="btn icon sm ghost" onclick={() => setLength(timer.mode, 5)} aria-label="Longer">+</button>
    </div>

    <select class="field which" bind:value={timer.courseId} aria-label="What are you working on">
      <option value={null}>General study</option>
      {#each activeCourses() as c (c.id)}<option value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>{/each}
    </select>
    {#if next}<div class="small faint">Suggested: work on <b class="mono">{next.label}</b>{next.title ? ` — ${next.title}` : ""}</div>{/if}

    <div class="controls">
      <button class="btn icon big-ctl" onclick={() => resetTimer()} aria-label="Reset"><Icon name="reset" /></button>
      {#if timer.running}
        <button class="btn primary play" onclick={pauseTimer}><Icon name="pause" size={20} /> Pause</button>
      {:else}
        <button class="btn primary play" onclick={startTimer}><Icon name="play" size={16} /> Start</button>
      {/if}
    </div>
  </section>

  <div class="side">
    <section class="panel stats">
      <div><span class="num">{hm(todayMin)}</span><span class="eyebrow">today</span></div>
      <div><span class="num">{hm(weekTotal)}</span><span class="eyebrow">this week</span></div>
      <div><span class="num">{streak}</span><span class="eyebrow">day streak</span></div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>This week</h2></div>
      <div class="bars">
        {#each week as w (w.d)}
          <div class="b" class:is-today={w.d === t}>
            <div class="track"><i style="height:{(w.min / weekMax) * 100}%"></i></div>
            <span class="eyebrow">{DAY_SHORT[parse(w.d).getDay()].slice(0, 2)}</span>
          </div>
        {/each}
      </div>
      {#if byCourse.length}
        <div class="by">
          {#each byCourse as [id, min] (id)}
            {@const c = courseById(id)}
            <div class="hstack small">
              <span class="dot" style="background:{colorOf(c?.color)}"></span>
              <span class="grow">{c ? c.code || c.name : "General"}</span>
              <span class="mono faint">{hm(min)}</span>
            </div>
          {/each}
        </div>
      {:else}
        <p class="small faint">Finished focus sessions show up here.</p>
      {/if}
    </section>
  </div>
</div>
</div>

<style>
  .page { display: grid; gap: 18px; }
  .top { padding-top: 16px; color: var(--hero-ink); text-shadow: var(--hero-shadow); }
  .top h1 { font-size: 46px; line-height: 1; }
  .top p { margin: 8px 0 0; opacity: 0.9; }
  .focus { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; align-items: start; }
  .timer { display: grid; justify-items: center; gap: 14px; padding: 28px; }
  .dial { position: relative; width: 300px; height: 300px; }
  .readout { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; gap: 4px; }
  .clock { font-family: var(--font-display); font-size: 76px; line-height: 1; font-variant-numeric: tabular-nums; }
  .len { display: flex; align-items: center; gap: 6px; margin-top: -6px; }
  .which { width: 320px; }
  .controls { display: flex; gap: 10px; align-items: center; margin-top: 6px; }
  .play { height: 46px; padding: 0 30px; font-size: 15px; }
  .big-ctl { width: 46px; height: 46px; }
  .side { display: grid; gap: 18px; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); }
  .stats div { display: grid; gap: 2px; }
  .num { font-family: var(--font-display); font-size: 28px; line-height: 1.1; }
  .bars { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; height: 130px; }
  .b { display: grid; grid-template-rows: 1fr auto; justify-items: center; gap: 6px; }
  .track { width: 14px; height: 100%; border-radius: 8px; background: var(--line); display: flex; align-items: flex-end; overflow: hidden; }
  .track i { width: 100%; background: var(--accent); border-radius: 8px; min-height: 0; transition: height 0.4s; }
  .b.is-today .eyebrow { color: var(--accent); }
  .by { display: grid; gap: 8px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); }
  .grow { flex: 1; }
  @media (max-width: 1100px) { .focus { grid-template-columns: 1fr; } }
</style>
