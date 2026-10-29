<script lang="ts">
  import { activeCourses, addTodo, db, finishedToday, toast } from "../lib/store.svelte";
  import { colorOf } from "../lib/colors";
  import { addDays, fmtDay, parseWhen, today } from "../lib/dates";
  import TodoRow from "../components/TodoRow.svelte";
  import type { Todo } from "../lib/types";

  type Filter = "open" | "today" | "week" | "someday" | "done";
  let filter = $state<Filter>("open");
  let courseFilter = $state<string | null>(null);
  let text = $state("");
  let addCourse = $state<string | null>(null);

  const t = today();
  const parsed = $derived(parseWhen(text));

  const showDone = $derived(db.settings.showDone);

  /** Should a finished task still show up under this filter? (crossed out, so you can see what you got done) */
  function keepDone(x: Todo, week: string): boolean {
    if (!showDone) return false;
    const today_ = x.due === t || finishedToday(x);
    if (filter === "today") return today_;
    if (filter === "week") return today_ || (!!x.due && x.due >= t && x.due <= week);
    if (filter === "someday") return !x.due;
    return true;
  }

  const list = $derived.by(() => {
    let xs = db.todos.filter((x) => !courseFilter || x.courseId === courseFilter);
    const week = addDays(t, 7);
    if (filter === "done") return xs.filter((x) => x.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
    const open = xs.filter((x) => !x.done && (
      filter === "today" ? x.due && x.due <= t :
      filter === "week" ? x.due && x.due <= week :
      filter === "someday" ? !x.due : true));
    open.sort((a, b) => b.priority - a.priority || (a.due || "9999").localeCompare(b.due || "9999") || b.createdAt - a.createdAt);
    // Finished ones go after the open ones, most recently finished first.
    const done = xs.filter((x) => x.done && keepDone(x, week)).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
    return [...open, ...done];
  });

  /** Group tasks by when they're due. Finished tasks stay in their group, crossed out. */
  const sections = $derived.by(() => {
    if (filter === "done" || filter === "someday") return [{ name: "", items: list, open: list.length }];
    const buckets: Record<string, Todo[]> = { Overdue: [], Today: [], Tomorrow: [], "This week": [], Later: [], "No date": [], "Done earlier": [] };
    for (const x of list) {
      if (!x.due) buckets["No date"].push(x);
      else if (x.due < t) buckets[x.done ? "Done earlier" : "Overdue"].push(x);
      else if (x.due === t) buckets.Today.push(x);
      else if (x.due === addDays(t, 1)) buckets.Tomorrow.push(x);
      else if (x.due <= addDays(t, 7)) buckets["This week"].push(x);
      else buckets.Later.push(x);
    }
    return Object.entries(buckets).filter(([, v]) => v.length).map(([name, items]) => ({ name, items, open: items.filter((x) => !x.done).length }));
  });

  const counts = $derived({
    open: db.todos.filter((x) => !x.done).length,
    today: db.todos.filter((x) => !x.done && x.due && x.due <= t).length,
    done: db.todos.filter((x) => x.done).length,
    doneToday: db.todos.filter(finishedToday).length,
  });

  function add() {
    const p = parsed;
    if (!p.rest) return;
    addTodo(p.rest, { due: p.date, courseId: addCourse ?? courseFilter });
    text = "";
  }

  function clearDone() {
    const n = db.todos.filter((x) => x.done).length;
    db.todos = db.todos.filter((x) => !x.done);
    toast(`Cleared ${n} finished task${n === 1 ? "" : "s"}`);
  }
</script>

<div class="tasks fade-in">
  <header class="top">
    <h1>Tasks</h1>
    <p>{counts.open} open{counts.today ? ` · ${counts.today} due today` : ""}{counts.doneToday ? ` · ${counts.doneToday} done today` : ""}</p>
  </header>

  <section class="panel">
    <div class="add">
      <input class="field big" placeholder="Add a task… (try “finish lab writeup thu”)" bind:value={text} onkeydown={(e) => e.key === "Enter" && add()} />
      <select class="field cls" bind:value={addCourse} aria-label="Class for new task">
        <option value={null}>{courseFilter ? "This class" : "No class"}</option>
        {#each activeCourses() as c (c.id)}<option value={c.id}>{c.code || c.name}</option>{/each}
      </select>
      <button class="btn primary" onclick={add} disabled={!parsed.rest}>Add</button>
    </div>
    {#if parsed.date}<div class="small faint hint">Due {fmtDay(parsed.date)}</div>{/if}

    <div class="filters">
      <div class="seg">
        <button class:on={filter === "open"} onclick={() => (filter = "open")}>All</button>
        <button class:on={filter === "today"} onclick={() => (filter = "today")}>Today</button>
        <button class:on={filter === "week"} onclick={() => (filter = "week")}>Next 7 days</button>
        <button class:on={filter === "someday"} onclick={() => (filter = "someday")}>No date</button>
        <button class:on={filter === "done"} onclick={() => (filter = "done")}>Done</button>
      </div>
      {#if filter !== "done"}
        <label class="small show-done"><input type="checkbox" bind:checked={db.settings.showDone} /> Show finished</label>
      {/if}
      <div class="spacer"></div>
      <div class="course-filter">
        <button class="cf" class:on={!courseFilter} onclick={() => (courseFilter = null)}>All</button>
        {#each activeCourses() as c (c.id)}
          <button class="cf" class:on={courseFilter === c.id} onclick={() => (courseFilter = courseFilter === c.id ? null : c.id)}>
            <span class="dot" style="background:{colorOf(c.color)}"></span>{c.code || c.name}
          </button>
        {/each}
      </div>
    </div>

    {#each sections as sec (sec.name)}
      {#if sec.name}
        <div class="eyebrow bucket" class:late={sec.name === "Overdue"}>
          {sec.name} · {sec.open === sec.items.length ? sec.items.length : `${sec.open} left of ${sec.items.length}`}
        </div>
      {/if}
      {#each sec.items as task (task.id)}<TodoRow t={task} />{/each}
    {:else}
      <div class="empty">{filter === "done" ? "Nothing finished yet." : "Nothing here. Enjoy it."}</div>
    {/each}

    {#if filter === "done" && counts.done}
      <button class="btn sm ghost clear" onclick={clearDone}>Clear finished tasks</button>
    {/if}
  </section>
</div>

<style>
  .tasks { display: grid; gap: 18px; max-width: 920px; }
  .top { padding-top: 16px; color: var(--hero-ink); text-shadow: var(--hero-shadow); }
  .top h1 { font-size: 46px; line-height: 1; }
  .top p { margin: 8px 0 0; opacity: 0.9; }
  .add { display: grid; grid-template-columns: 1fr 150px auto; gap: 8px; }
  .big { height: 42px; font-size: 15px; }
  .cls { height: 42px; }
  .add .btn { height: 42px; padding: 0 20px; }
  .hint { margin-top: 6px; }
  .filters { display: flex; align-items: center; gap: 10px; margin: 16px 0 6px; flex-wrap: wrap; }
  .course-filter { display: flex; gap: 4px; flex-wrap: wrap; }
  .cf { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 999px; border: 1px solid transparent; background: none; cursor: pointer; font-size: 12.5px; color: var(--ink-2); }
  .cf:hover { background: var(--panel-hover); }
  .cf.on { border-color: var(--line-strong); background: var(--field); color: var(--ink); }
  .bucket { margin: 16px 0 4px; }
  .bucket.late { color: var(--warn); }
  .clear { margin-top: 10px; }
  .show-done { display: inline-flex; align-items: center; gap: 6px; color: var(--ink-2); cursor: pointer; }
  .show-done input { accent-color: var(--accent); }
</style>
