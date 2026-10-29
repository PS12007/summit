<script lang="ts">
  import { activeCourses, addTodo, db, deadlinesOn, finishedToday, go, meetingsOn, newDeadline, overdue, replaceAll, ui, upcoming } from "../lib/store.svelte";
  import { colorOf } from "../lib/colors";
  import { addDays, daysBetween, DAY_SHORT, fmtLong, fmtTime, minutesOf, parse, startOfWeek, today } from "../lib/dates";
  import { lastDone, nextUp, progress } from "../lib/sections";
  import { sampleData } from "../lib/sample";
  import DeadlineRow from "../components/DeadlineRow.svelte";
  import TodoRow from "../components/TodoRow.svelte";
  import Icon from "../components/Icon.svelte";

  let nowMin = $state(new Date().getHours() * 60 + new Date().getMinutes());
  $effect(() => {
    const t = setInterval(() => (nowMin = new Date().getHours() * 60 + new Date().getMinutes()), 60_000);
    return () => clearInterval(t);
  });

  const t = today();
  const greeting = $derived(nowMin < 300 ? "Still up" : nowMin < 720 ? "Good morning" : nowMin < 1050 ? "Good afternoon" : "Good evening");
  const late = $derived(overdue());
  const soon = $derived(upcoming(14));
  // Same list, but finished deadlines stay in place (crossed out) instead of disappearing.
  const comingUp = $derived(
    db.settings.showDone
      ? db.deadlines
          .filter((d) => d.date >= t && d.date <= addDays(t, 14))
          .sort((a, b) => (a.date + (a.time ?? "99")).localeCompare(b.date + (b.time ?? "99")))
      : soon,
  );
  const classes = $derived(meetingsOn(t));
  const todayTasks = $derived(
    db.todos
      .filter((x) => (!x.done && (x.priority > 0 || (x.due && x.due <= t))) || (db.settings.showDone && x.done && (x.due === t || finishedToday(x))))
      .sort((a, b) => Number(a.done) - Number(b.done) || b.priority - a.priority || (a.due ?? "9").localeCompare(b.due ?? "9")),
  );
  const otherOpen = $derived(db.todos.filter((x) => !x.done).length - todayTasks.filter((x) => !x.done).length);
  const weekStart = $derived(startOfWeek(t, db.settings.weekStartsMonday));
  const week = $derived(
    Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const items = deadlinesOn(date).filter((d) => !d.done);
      return { date, items, heavy: items.some((d) => d.kind === "exam") || items.length >= 3 };
    }),
  );
  const semester = $derived.by(() => {
    const { semesterStart: s, semesterEnd: e } = db.settings;
    if (!s || !e || t < s || t > e) return null;
    const total = daysBetween(s, e), gone = daysBetween(s, t);
    return { week: Math.floor(gone / 7) + 1, weeks: Math.ceil(total / 7), pct: Math.round((gone / total) * 100), left: daysBetween(t, e) };
  });

  const summary = $derived.by(() => {
    const due = soon.filter((d) => daysBetween(t, d.date) <= 7).length;
    const parts: string[] = [];
    if (classes.length) parts.push(`${classes.length} class${classes.length > 1 ? "es" : ""} today`);
    if (due) parts.push(`${due} deadline${due > 1 ? "s" : ""} this week`);
    if (late.length) parts.push(`${late.length} overdue`);
    return parts.length ? parts.join(" · ") : "Nothing pressing. A good day to get ahead.";
  });

  const isEmpty = $derived(!db.courses.length && !db.deadlines.length && !db.todos.length);
  let newTask = $state("");
  function quickTask() {
    if (!newTask.trim()) return;
    addTodo(newTask.trim(), { due: t });
    newTask = "";
  }
</script>

<div class="today fade-in">
  <header class="hero">
    <div class="eyebrow hero-eyebrow">{fmtLong(t)}{semester ? ` · Week ${semester.week} of ${semester.weeks}` : ""}</div>
    <h1>{greeting}{db.settings.name ? `, ${db.settings.name}` : ""}.</h1>
    <p>{summary}</p>
  </header>

  {#if isEmpty}
    <section class="panel welcome">
      <h2>Welcome to Summit</h2>
      <p class="muted">A quiet place for your classes, sections, deadlines and tasks. Everything is saved on this computer and works offline.</p>
      <div class="hstack">
        <button class="btn primary" onclick={() => go("courses")}><Icon name="plus" size={16} /> Add your first class</button>
        <button class="btn" onclick={() => replaceAll(sampleData($state.snapshot(db)))}>Explore with sample data</button>
      </div>
      <p class="small faint">Tip: press <span class="kbd">Ctrl K</span> anywhere to quick-add, like “calc quiz fri 3pm”.</p>
    </section>
  {:else}
    <div class="cols">
      <div class="col">
        <section class="panel">
          <div class="panel-head">
            <h2>Coming up</h2>
            <button class="btn sm" onclick={() => (ui.deadlineDraft = newDeadline())}><Icon name="plus" size={14} /> Deadline</button>
          </div>
          {#if late.length}
            <div class="eyebrow warn-label">Overdue</div>
            {#each late as d (d.id)}<DeadlineRow {d} />{/each}
            <div class="divider"></div>
          {/if}
          {#each comingUp as d (d.id)}
            <DeadlineRow {d} />
          {:else}
            <div class="empty">Nothing due in the next two weeks.</div>
          {/each}
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Where you are</h2><button class="btn sm ghost" onclick={() => go("courses")}>All classes <Icon name="right" size={14} /></button></div>
          <div class="course-grid">
            {#each activeCourses() as c (c.id)}
              {@const p = progress(c)}
              {@const next = nextUp(c)}
              {@const last = lastDone(c)}
              <button class="course-card" onclick={() => go("course", c.id)}>
                <div class="hstack"><span class="dot" style="background:{colorOf(c.color)}"></span><span class="cname">{c.code || c.name}</span><div class="spacer"></div><span class="mono small faint">{p.done}/{p.total}</span></div>
                <div class="bar"><i style="width:{p.pct}%;background:{colorOf(c.color)}"></i></div>
                <div class="where small">
                  {#if !p.total}<span class="faint">No sections yet — add some</span>
                  {:else if next}<span class="faint">{last ? `Done ${last.label} ·` : ""}</span> Next <b class="mono">{next.label}</b>
                  {:else}<span class="ok">All sections done</span>{/if}
                  {#if p.review}<span class="tag review">{p.review} to review</span>{/if}
                </div>
              </button>
            {:else}
              <div class="empty">No classes yet.</div>
            {/each}
          </div>
        </section>
      </div>

      <div class="col">
        <section class="panel">
          <div class="panel-head"><h2>Today's classes</h2></div>
          {#each classes as { course, m } (m.id)}
            {@const s = minutesOf(m.start)}
            {@const e = minutesOf(m.end)}
            {@const next = nextUp(course)}
            <button class="class-row" class:past={nowMin > e} class:live={nowMin >= s && nowMin <= e} onclick={() => go("course", course.id)}>
              <span class="time mono small">{fmtTime(m.start)}<br /><span class="faint">{fmtTime(m.end)}</span></span>
              <span class="bar-color" style="background:{colorOf(course.color)}"></span>
              <span class="info">
                <span class="cname">{course.code || course.name} <span class="faint small">· {m.kind}</span></span>
                <span class="small faint">{m.place ?? ""}{next ? `${m.place ? " · " : ""}on ${next.label}` : ""}</span>
              </span>
              {#if nowMin >= s && nowMin <= e}<span class="tag accent">Now</span>{:else if nowMin < s && s - nowMin <= 90}<span class="tag">in {s - nowMin}m</span>{/if}
            </button>
          {:else}
            <div class="empty">No classes today.</div>
          {/each}
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Tasks</h2><button class="btn sm ghost" onclick={() => go("tasks")}>{otherOpen > 0 ? `+${otherOpen} more` : "All tasks"} <Icon name="right" size={14} /></button></div>
          {#each todayTasks as task (task.id)}<TodoRow t={task} />{:else}<div class="empty small">Clear for today.</div>{/each}
          <input class="field add-task" placeholder="Add a task for today…" bind:value={newTask} onkeydown={(e) => e.key === "Enter" && quickTask()} />
        </section>

        <section class="panel">
          <div class="panel-head"><h2>This week</h2>{#if semester}<span class="mono small faint">{semester.left} days left in term</span>{/if}</div>
          <div class="week">
            {#each week as day (day.date)}
              <button class="day" class:is-today={day.date === t} class:heavy={day.heavy} class:past={day.date < t} onclick={() => go("calendar")}>
                <span class="eyebrow">{DAY_SHORT[parse(day.date).getDay()]}</span>
                <span class="num">{parse(day.date).getDate()}</span>
                <span class="dots">
                  {#each day.items.slice(0, 4) as d (d.id)}<i style="background:{colorOf(activeCourses().find((c) => c.id === d.courseId)?.color)}"></i>{/each}
                </span>
              </button>
            {/each}
          </div>
          {#if semester}<div class="bar term"><i style="width:{semester.pct}%;background:var(--accent)"></i></div>{/if}
        </section>
      </div>
    </div>
  {/if}
</div>

<style>
  .today { display: grid; gap: 22px; }
  .hero { padding: 28px 4px 8px; color: var(--hero-ink); text-shadow: var(--hero-shadow); }
  .hero-eyebrow { color: inherit; opacity: 0.85; }
  .hero h1 { font-size: clamp(44px, 5.4vw, 68px); line-height: 1.02; margin: 10px 0 10px; }
  .hero p { margin: 0; font-size: 16px; opacity: 0.92; }
  .welcome { display: grid; gap: 14px; max-width: 620px; padding: 28px; }
  .welcome p { margin: 0; }
  .cols { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 18px; align-items: start; }
  .col { display: grid; gap: 18px; }
  .warn-label { color: var(--warn); margin-bottom: 4px; }
  .divider { height: 1px; background: var(--line); margin: 10px 0; }
  .course-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
  .course-card {
    display: grid; gap: 9px; padding: 14px; border-radius: var(--r-md); border: 1px solid var(--line);
    background: var(--field); cursor: pointer; text-align: left; transition: border-color 0.15s, transform 0.15s;
  }
  .course-card:hover { border-color: var(--line-strong); transform: translateY(-1px); }
  .cname { font-weight: 600; }
  .where { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-height: 22px; }
  .where b { font-weight: 500; }
  .ok { color: var(--accent); }
  .tag.review { background: color-mix(in srgb, var(--review) 14%, transparent); color: var(--review); border-color: transparent; }
  .class-row {
    display: flex; align-items: center; gap: 12px; width: calc(100% + 20px); margin: 0 -10px; padding: 9px 10px;
    border: 0; background: none; border-radius: var(--r-sm); cursor: pointer; text-align: left;
  }
  .class-row:hover { background: var(--panel-hover); }
  .class-row.past { opacity: 0.5; }
  .class-row.live { background: var(--accent-soft); }
  .time { width: 52px; line-height: 1.35; }
  .bar-color { width: 3px; align-self: stretch; border-radius: 3px; }
  .info { display: grid; flex: 1; min-width: 0; }
  .add-task { margin-top: 8px; height: 34px; }
  .week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .day {
    display: grid; justify-items: center; gap: 2px; padding: 9px 0 8px; border-radius: 12px; border: 1px solid transparent;
    background: none; cursor: pointer;
  }
  .day:hover { background: var(--panel-hover); }
  .day.past { opacity: 0.45; }
  .day.is-today { background: var(--panel-solid); border-color: var(--line); }
  .day.heavy .num { color: var(--warn); }
  .num { font-family: var(--font-display); font-size: 22px; line-height: 1.1; }
  .dots { display: flex; gap: 3px; height: 6px; }
  .dots i { width: 6px; height: 6px; border-radius: 50%; }
  .term { margin-top: 14px; height: 4px; }
  @media (max-width: 1180px) { .cols { grid-template-columns: 1fr; } }
</style>
