<script lang="ts">
  import { activeCourses, courseById, db, deadlinesOn, go, meetingsOn, newDeadline, ui } from "../lib/store.svelte";
  import { colorOf } from "../lib/colors";
  import { addDays, DAY_SHORT, fmtLong, fmtTime, minutesOf, MONTH_LONG, monthGrid, parse, startOfWeek, today, toStr } from "../lib/dates";
  import DeadlineRow from "../components/DeadlineRow.svelte";
  import TodoRow from "../components/TodoRow.svelte";
  import Icon from "../components/Icon.svelte";

  let mode = $state<"month" | "week">("month");
  let cursor = $state(today());
  let selected = $state(today());
  const t = today();

  const monday = $derived(db.settings.weekStartsMonday);
  const days = $derived(monthGrid(cursor, monday));
  const weekDays = $derived(Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor, monday), i)));
  const headers = $derived(monday ? [...DAY_SHORT.slice(1), DAY_SHORT[0]] : DAY_SHORT);
  const cur = $derived(parse(cursor));
  const title = $derived(
    mode === "month"
      ? `${MONTH_LONG[cur.getMonth()]} ${cur.getFullYear()}`
      : (() => {
          const a = parse(weekDays[0]), b = parse(weekDays[6]);
          return a.getMonth() === b.getMonth()
            ? `${MONTH_LONG[a.getMonth()]} ${a.getDate()} – ${b.getDate()}`
            : `${MONTH_LONG[a.getMonth()].slice(0, 3)} ${a.getDate()} – ${MONTH_LONG[b.getMonth()].slice(0, 3)} ${b.getDate()}`;
        })(),
  );

  function shift(n: number) {
    if (mode === "week") cursor = addDays(cursor, 7 * n);
    else {
      const d = parse(cursor);
      cursor = toStr(new Date(d.getFullYear(), d.getMonth() + n, 1));
    }
  }
  const goToday = () => ((cursor = t), (selected = t));

  const tasksOn = (date: string) => db.todos.filter((x) => x.due === date);
  const sel = $derived({ deadlines: deadlinesOn(selected), classes: meetingsOn(selected), tasks: tasksOn(selected) });

  // Week grid geometry
  const START = 7 * 60, END = 22 * 60, HOUR_PX = 46;
  const hours = Array.from({ length: (END - START) / 60 }, (_, i) => START / 60 + i);
  const top = (time: string) => ((Math.max(START, Math.min(END, minutesOf(time))) - START) / 60) * HOUR_PX;

  let nowMin = $state(new Date().getHours() * 60 + new Date().getMinutes());
  $effect(() => {
    const id = setInterval(() => (nowMin = new Date().getHours() * 60 + new Date().getMinutes()), 60_000);
    return () => clearInterval(id);
  });

  function onkey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest("input,textarea,select") || ui.deadlineDraft || ui.courseDraft || ui.quickAdd) return;
    if (e.key === "ArrowLeft") shift(-1);
    if (e.key === "ArrowRight") shift(1);
    if (e.key.toLowerCase() === "t") goToday();
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="cal fade-in">
  <header class="top">
    <h1>{title}</h1>
    <div class="spacer"></div>
    <div class="seg">
      <button class:on={mode === "month"} onclick={() => (mode = "month")}>Month</button>
      <button class:on={mode === "week"} onclick={() => (mode = "week")}>Week</button>
    </div>
    <div class="hstack nav">
      <button class="btn icon" onclick={() => shift(-1)} aria-label="Previous"><Icon name="left" /></button>
      <button class="btn" onclick={goToday}>Today</button>
      <button class="btn icon" onclick={() => shift(1)} aria-label="Next"><Icon name="right" /></button>
    </div>
  </header>

  <div class="layout">
    {#if mode === "month"}
      <section class="panel month">
        <div class="heads">{#each headers as h}<div class="eyebrow">{h}</div>{/each}</div>
        <div class="cells">
          {#each days as date (date)}
            {@const ds = deadlinesOn(date)}
            {@const cls = meetingsOn(date)}
            {@const out = parse(date).getMonth() !== cur.getMonth()}
            <button
              class="cell"
              class:out
              class:is-today={date === t}
              class:sel={date === selected}
              onclick={() => (selected = date)}
              ondblclick={() => (ui.deadlineDraft = newDeadline({ date }))}
            >
              <span class="n">{parse(date).getDate()}</span>
              {#if cls.length}
                <span class="class-dots">{#each cls as { course, m } (m.id)}<i style="background:{colorOf(course.color)}"></i>{/each}</span>
              {/if}
              <span class="items">
                {#each ds.slice(0, 3) as d (d.id)}
                  {@const c = courseById(d.courseId)}
                  <span class="pill" class:done={d.done} class:exam={d.kind === "exam"} style="--c:{colorOf(c?.color)}">{d.title}</span>
                {/each}
                {#if ds.length > 3}<span class="more small faint">+{ds.length - 3} more</span>{/if}
              </span>
            </button>
          {/each}
        </div>
      </section>
    {:else}
      <section class="panel weekview">
        <div class="wk-head">
          <div></div>
          {#each weekDays as date (date)}
            <button class="wk-day" class:is-today={date === t} class:sel={date === selected} onclick={() => (selected = date)}>
              <span class="eyebrow">{DAY_SHORT[parse(date).getDay()]}</span><span class="num">{parse(date).getDate()}</span>
            </button>
          {/each}
        </div>
        <div class="allday">
          <div class="eyebrow gutter">due</div>
          {#each weekDays as date (date)}
            <div class="ad-cell">
              {#each deadlinesOn(date).filter((d) => !d.time) as d (d.id)}
                <button class="pill" class:done={d.done} style="--c:{colorOf(courseById(d.courseId)?.color)}" onclick={() => (ui.deadlineDraft = $state.snapshot(d))}>{d.title}</button>
              {/each}
            </div>
          {/each}
        </div>
        <div class="wk-body">
          <div class="hours">{#each hours as h}<div class="h mono" style="height:{HOUR_PX}px">{fmtTime(`${String(h).padStart(2, "0")}:00`)}</div>{/each}</div>
          {#each weekDays as date (date)}
            <div class="col" class:is-today={date === t} style="height:{hours.length * HOUR_PX}px" role="presentation" ondblclick={() => (ui.deadlineDraft = newDeadline({ date }))}>
              {#each meetingsOn(date) as { course, m } (m.id)}
                <button class="block" style="top:{top(m.start)}px;height:{Math.max(22, top(m.end) - top(m.start) - 2)}px;--c:{colorOf(course.color)}" onclick={() => go("course", course.id)}>
                  <b>{course.code || course.name}</b><span>{m.kind}{m.place ? ` · ${m.place}` : ""}</span>
                </button>
              {/each}
              {#each deadlinesOn(date).filter((d) => d.time) as d (d.id)}
                <button class="due-mark" class:done={d.done} style="top:{top(d.time!)}px;--c:{colorOf(courseById(d.courseId)?.color)}" onclick={() => (ui.deadlineDraft = $state.snapshot(d))}>
                  <i></i>{fmtTime(d.time)} {d.title}
                </button>
              {/each}
              {#if date === t && nowMin >= START && nowMin <= END}<div class="now" style="top:{((nowMin - START) / 60) * HOUR_PX}px"></div>{/if}
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <aside class="panel side">
      <div class="eyebrow">{selected === t ? "Today" : ""}</div>
      <h2>{fmtLong(selected)}</h2>
      <button class="btn sm add" onclick={() => (ui.deadlineDraft = newDeadline({ date: selected }))}><Icon name="plus" size={14} /> Add on this day</button>

      {#if sel.classes.length}
        <div class="eyebrow sub">Classes</div>
        {#each sel.classes as { course, m } (m.id)}
          <button class="row-item cls" onclick={() => go("course", course.id)}>
            <span class="dot" style="background:{colorOf(course.color)}"></span>
            <span class="grow">{course.code || course.name} <span class="faint small">· {m.kind}</span></span>
            <span class="mono small faint">{fmtTime(m.start)}</span>
          </button>
        {/each}
      {/if}

      <div class="eyebrow sub">Due</div>
      {#each sel.deadlines as d (d.id)}<DeadlineRow {d} showDate={false} />{:else}<div class="small faint">Nothing due.</div>{/each}

      {#if sel.tasks.length}
        <div class="eyebrow sub">Tasks</div>
        {#each sel.tasks as task (task.id)}<TodoRow t={task} compact />{/each}
      {/if}

      {#if !activeCourses().length}<p class="small faint">Add classes with weekly times to see them here.</p>{/if}
      <p class="small faint hint">Double-click a day to add a deadline · <span class="kbd">←</span> <span class="kbd">→</span> to move · <span class="kbd">T</span> today</p>
    </aside>
  </div>
</div>

<style>
  .cal { display: grid; gap: 16px; }
  .top { display: flex; align-items: center; gap: 14px; padding-top: 16px; color: var(--hero-ink); text-shadow: var(--hero-shadow); }
  .top h1 { font-size: 46px; line-height: 1; }
  .top .btn, .top .seg { text-shadow: none; color: var(--ink); }
  .nav { gap: 6px; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }

  .month { padding: 14px; }
  .heads, .cells { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .heads div { padding: 2px 8px 8px; }
  .cells { gap: 4px; }
  .cell {
    display: flex; flex-direction: column; align-items: stretch; gap: 3px; min-height: 96px; padding: 6px 6px 8px;
    border-radius: 12px; border: 1px solid transparent; background: transparent; cursor: pointer; text-align: left; overflow: hidden;
  }
  .cell:hover { background: var(--panel-hover); }
  .cell.out { opacity: 0.4; }
  .cell.sel { border-color: var(--line-strong); background: var(--panel-hover); }
  .cell .n { font-family: var(--font-display); font-size: 18px; line-height: 1; padding: 2px 4px; }
  .cell.is-today .n { background: var(--accent); color: var(--accent-ink); border-radius: 999px; align-self: flex-start; padding: 3px 8px 2px; }
  .class-dots { display: flex; gap: 3px; padding: 0 4px; }
  .class-dots i { width: 5px; height: 5px; border-radius: 50%; opacity: 0.7; }
  .items { display: grid; gap: 2px; }
  .pill {
    display: block; font-size: 11.5px; line-height: 1.25; padding: 3px 6px; border-radius: 6px; border: 0; text-align: left;
    background: color-mix(in srgb, var(--c) 18%, transparent); color: var(--ink);
    border-left: 2.5px solid var(--c); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; width: 100%;
  }
  .pill.exam { background: color-mix(in srgb, var(--c) 32%, transparent); font-weight: 600; }
  .pill.done { opacity: 0.45; text-decoration: line-through; }
  .more { padding-left: 6px; }

  .weekview { padding: 10px 12px 12px; overflow: hidden; }
  .wk-head, .allday, .wk-body { display: grid; grid-template-columns: 52px repeat(7, minmax(0, 1fr)); }
  .wk-day { display: grid; justify-items: center; gap: 1px; padding: 6px 0; border: 0; background: none; cursor: pointer; border-radius: 10px; }
  .wk-day:hover { background: var(--panel-hover); }
  .wk-day.sel { background: var(--panel-hover); }
  .wk-day .num { font-family: var(--font-display); font-size: 22px; line-height: 1.1; }
  .wk-day.is-today .num { color: var(--accent); }
  .allday { border-bottom: 1px solid var(--line); padding: 4px 0 6px; }
  .gutter { align-self: center; font-size: 9.5px; }
  .ad-cell { display: grid; gap: 2px; padding: 0 2px; align-content: start; }
  .wk-body { max-height: calc(100vh - 290px); overflow-y: auto; padding-top: 8px; }
  .hours .h { font-size: 10px; color: var(--ink-3); transform: translateY(-6px); }
  .col { position: relative; border-left: 1px solid var(--line); background-image: linear-gradient(var(--line) 1px, transparent 1px); background-size: 100% 46px; }
  .col.is-today { background-color: color-mix(in srgb, var(--accent) 5%, transparent); }
  .block {
    position: absolute; left: 3px; right: 3px; display: grid; align-content: start; gap: 1px; padding: 4px 7px; border-radius: 8px;
    border: 0; border-left: 3px solid var(--c); background: color-mix(in srgb, var(--c) 22%, var(--panel-solid)); color: var(--ink);
    font-size: 11.5px; text-align: left; overflow: hidden; cursor: pointer; line-height: 1.25;
  }
  .block span { color: var(--ink-2); font-size: 10.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .due-mark {
    position: absolute; left: 3px; right: 3px; transform: translateY(-50%); display: flex; align-items: center; gap: 5px;
    padding: 2px 6px; border-radius: 6px; border: 0; background: var(--panel-solid); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
    font-size: 10.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; z-index: 2; color: var(--ink);
  }
  .due-mark i { width: 7px; height: 7px; border-radius: 50%; background: var(--c); flex: none; }
  .due-mark.done { opacity: 0.45; text-decoration: line-through; }
  .now { position: absolute; left: -1px; right: 0; height: 2px; background: var(--warn); z-index: 3; }
  .now::before { content: ""; position: absolute; left: -4px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--warn); }

  .side { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; align-content: start; position: sticky; top: 0; }
  .side h2 { margin-bottom: 8px; }
  .add { justify-self: start; margin-bottom: 4px; }
  .sub { margin-top: 14px; margin-bottom: 2px; }
  .cls { border: 0; background: none; cursor: pointer; text-align: left; width: auto; min-width: 0; }
  .cls .grow { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .grow { flex: 1; }
  .hint { margin-top: 18px; line-height: 1.8; }
  @media (max-width: 1150px) { .layout { grid-template-columns: 1fr; } .side { position: static; } }
</style>
