<script lang="ts">
  import Icon, { type IconName } from "./Icon.svelte";
  import { activeCourses, go, ui, upcoming, overdue, db, type View } from "../lib/store.svelte";
  import { timer, fmtClock } from "../lib/focus.svelte";
  import { colorOf } from "../lib/colors";
  import { progress } from "../lib/sections";
  import { today } from "../lib/dates";

  const NAV: { view: View; label: string; icon: IconName }[] = [
    { view: "today", label: "Today", icon: "today" },
    { view: "calendar", label: "Calendar", icon: "calendar" },
    { view: "courses", label: "Classes", icon: "courses" },
    { view: "tasks", label: "Tasks", icon: "tasks" },
    { view: "focus", label: "Focus", icon: "focus" },
  ];

  const dueSoon = $derived(upcoming(3).length + overdue().length);
  const openTasks = $derived(db.todos.filter((t) => !t.done && (!t.due || t.due <= today())).length);
  const badge = (v: View) => (v === "today" ? dueSoon : v === "tasks" ? openTasks : 0);
</script>

<aside class="sidebar panel">
  <div class="brand">
    <Icon name="mountain" size={20} stroke={1.5} />
    <span>Summit</span>
  </div>

  <nav>
    {#each NAV as item, i}
      <button
        class="nav"
        class:on={ui.view === item.view || (item.view === "courses" && ui.view === "course")}
        onclick={() => go(item.view)}
        title="{item.label} (Ctrl+{i + 1})"
      >
        <Icon name={item.icon} />
        <span>{item.label}</span>
        {#if item.view === "focus" && (timer.running || timer.remaining !== db.settings.focusMinutes * 60)}
          <span class="count mono" class:live={timer.running}>{fmtClock(timer.remaining)}</span>
        {:else if badge(item.view)}
          <span class="count mono">{badge(item.view)}</span>
        {/if}
      </button>
    {/each}
  </nav>

  {#if activeCourses().length}
    <div class="eyebrow section-title">Classes</div>
    <div class="courses">
      {#each activeCourses() as c (c.id)}
        {@const p = progress(c)}
        <button class="course" class:on={ui.view === "course" && ui.courseId === c.id} onclick={() => go("course", c.id)}>
          <span class="dot" style="background:{colorOf(c.color)}"></span>
          <span class="name">{c.code || c.name}</span>
          {#if p.total}<span class="pct mono">{p.pct}%</span>{/if}
        </button>
      {/each}
    </div>
  {/if}

  <div class="spacer"></div>

  <button class="btn primary add" onclick={() => (ui.quickAdd = true)}>
    <Icon name="plus" size={16} /> Quick add <span class="kbd on-accent">Ctrl K</span>
  </button>
  <button class="nav" class:on={ui.view === "settings"} onclick={() => go("settings")} title="Settings (Ctrl+6)">
    <Icon name="settings" />
    <span>Settings</span>
  </button>
</aside>

<style>
  .sidebar {
    width: 228px;
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 18px 12px 12px;
    overflow-y: auto;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 2px 10px 18px;
    font-family: var(--font-display);
    font-size: 26px;
    line-height: 1;
  }
  nav { display: grid; gap: 2px; }
  .nav {
    display: flex;
    align-items: center;
    gap: 11px;
    width: 100%;
    height: 38px;
    padding: 0 10px;
    border: 0;
    border-radius: 11px;
    background: transparent;
    color: var(--ink-2);
    cursor: pointer;
    font-size: 13.5px;
    font-weight: 500;
    text-align: left;
    transition: background 0.12s, color 0.12s;
  }
  .nav:hover { background: var(--panel-hover); color: var(--ink); }
  .nav.on { background: var(--panel-solid); color: var(--ink); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
  .nav span:nth-child(2) { flex: 1; }
  .count {
    font-size: 11px;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--line);
    color: var(--ink-2);
  }
  .count.live { background: var(--accent); color: var(--accent-ink); }
  .section-title { padding: 22px 10px 8px; }
  .courses { display: grid; gap: 1px; }
  .course {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 32px;
    padding: 0 10px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    cursor: pointer;
    color: var(--ink-2);
    font-size: 13px;
    text-align: left;
  }
  .course:hover { background: var(--panel-hover); color: var(--ink); }
  .course.on { background: var(--panel-hover); color: var(--ink); }
  .course .name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pct { font-size: 10.5px; color: var(--ink-3); }
  .add { width: 100%; margin: 12px 0 6px; height: 38px; }
  .kbd.on-accent { border-color: color-mix(in srgb, var(--accent-ink) 30%, transparent); color: inherit; opacity: 0.7; margin-left: 4px; }
</style>
