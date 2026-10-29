<script lang="ts">
  import type { Todo } from "../lib/types";
  import { activeCourses, courseById, deleteTodo, toggleTodo, uid } from "../lib/store.svelte";
  import { colorOf } from "../lib/colors";
  import { daysBetween, fmtDay, relative, toStr, today } from "../lib/dates";
  import Icon from "./Icon.svelte";

  let { t, compact = false }: { t: Todo; compact?: boolean } = $props();

  let open = $state(false);
  let newSub = $state("");
  const course = $derived(courseById(t.courseId));
  const late = $derived(!t.done && !!t.due && daysBetween(today(), t.due) < 0);
  const subsDone = $derived(t.subtasks.filter((s) => s.done).length);

  function addSub() {
    if (!newSub.trim()) return;
    t.subtasks.push({ id: uid(), text: newSub.trim(), done: false });
    newSub = "";
  }
  const cyclePriority = () => (t.priority = ((t.priority + 1) % 3) as 0 | 1 | 2);

  /** "today", "yesterday" or "Mon, Oct 27" */
  function doneWhen(ms: number): string {
    const d = toStr(new Date(ms));
    const n = daysBetween(d, today());
    return n === 0 ? "today" : n === 1 ? "yesterday" : fmtDay(d);
  }
</script>

<div class="todo" class:done={t.done}>
  <div class="row-item">
    <button class="check" class:on={t.done} onclick={() => toggleTodo(t)} aria-label="Toggle done">
      {#if t.done}<Icon name="check" size={12} stroke={2.4} />{/if}
    </button>
    <button class="text" onclick={() => (open = !open)}>
      <span class="label"><span class="strike">{t.text}</span></span>
      <span class="meta">
        {#if course && !compact}<span class="course small"><span class="dot" style="background:{colorOf(course.color)}"></span>{course.code || course.name}</span>{/if}
        {#if t.subtasks.length}<span class="small faint mono">{subsDone}/{t.subtasks.length}</span>{/if}
        {#if t.due && !t.done}<span class="tag" class:warn={late || t.due === today()}>{late ? `${fmtDay(t.due)} · late` : relative(t.due)}</span>{/if}
        {#if t.done && t.doneAt}<span class="small faint done-when">done {doneWhen(t.doneAt)}</span>{/if}
      </span>
    </button>
    <button class="flag p{t.priority}" onclick={cyclePriority} title="Priority: {['normal', 'high', 'urgent'][t.priority]}">
      <Icon name="flag" size={15} />
    </button>
  </div>

  {#if open && !compact}
    <div class="details fade-in">
      {#each t.subtasks as s (s.id)}
        <div class="sub">
          <button class="check sm" class:on={s.done} onclick={() => (s.done = !s.done)} aria-label="Toggle subtask">
            {#if s.done}<Icon name="check" size={10} stroke={2.6} />{/if}
          </button>
          <span class:struck={s.done}>{s.text}</span>
          <button class="btn icon sm ghost" onclick={() => (t.subtasks = t.subtasks.filter((x) => x.id !== s.id))} aria-label="Remove subtask"><Icon name="close" size={13} /></button>
        </div>
      {/each}
      <input class="field sub-input" placeholder="Add a step…" bind:value={newSub} onkeydown={(e) => e.key === "Enter" && addSub()} />
      <div class="edit-row">
        <input class="field" bind:value={t.text} aria-label="Task text" />
        <select class="field" bind:value={t.courseId} aria-label="Class">
          <option value={null}>No class</option>
          {#each activeCourses() as c (c.id)}<option value={c.id}>{c.code || c.name}</option>{/each}
        </select>
        <input class="field" type="date" bind:value={t.due} aria-label="Due date" />
        <button class="btn icon ghost danger" onclick={() => deleteTodo(t.id)} aria-label="Delete task"><Icon name="trash" size={16} /></button>
      </div>
    </div>
  {/if}
</div>

<style>
  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 0;
    background: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
  }
  .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* A line that draws across the text when a task is ticked off. */
  .strike {
    background: linear-gradient(currentColor, currentColor) no-repeat 0 55% / 0% 1.5px;
    transition: background-size 0.35s ease, color 0.25s;
  }
  .done .strike { background-size: 100% 1.5px; color: var(--ink-3); }
  .todo.done { opacity: 0.8; }
  .done-when { white-space: nowrap; }
  .meta { display: flex; align-items: center; gap: 8px; flex: none; }
  .course { display: inline-flex; align-items: center; gap: 5px; color: var(--ink-2); }
  .flag { border: 0; background: none; padding: 2px; cursor: pointer; color: var(--ink-3); opacity: 0; transition: opacity 0.12s; }
  .row-item:hover .flag, .flag.p1, .flag.p2 { opacity: 1; }
  .flag.p1 { color: var(--doing); }
  .flag.p2 { color: var(--warn); }
  .details { padding: 4px 0 12px 28px; display: grid; gap: 6px; }
  .sub { display: flex; align-items: center; gap: 9px; font-size: 13px; }
  .sub span { flex: 1; }
  .struck { text-decoration: line-through; color: var(--ink-3); }
  .check.sm { width: 15px; height: 15px; border-radius: 5px; }
  .sub-input { height: 32px; }
  .edit-row { display: grid; grid-template-columns: 1fr 130px 150px auto; gap: 6px; margin-top: 4px; }
  .edit-row .field { height: 32px; }
</style>
