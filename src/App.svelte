<script lang="ts">
  import { courseById, go, init, ui, type View } from "./lib/store.svelte";
  import Scenery from "./components/Scenery.svelte";
  import Sidebar from "./components/Sidebar.svelte";
  import DeadlineEditor from "./components/DeadlineEditor.svelte";
  import CourseEditor from "./components/CourseEditor.svelte";
  import QuickAdd from "./components/QuickAdd.svelte";
  import Today from "./views/Today.svelte";
  import Calendar from "./views/Calendar.svelte";
  import Courses from "./views/Courses.svelte";
  import CourseDetail from "./views/CourseDetail.svelte";
  import Grades from "./views/Grades.svelte";
  import Tasks from "./views/Tasks.svelte";
  import Focus from "./views/Focus.svelte";
  import Settings from "./views/Settings.svelte";

  init();

  const course = $derived(ui.view === "course" ? courseById(ui.courseId) : undefined);
  const gradeCourse = $derived(ui.view === "grades" ? courseById(ui.courseId) : undefined);
  let main: HTMLElement | undefined = $state();

  // Scroll back to the top when switching pages.
  $effect(() => {
    void ui.view, ui.courseId;
    main?.scrollTo({ top: 0 });
  });

  const PAGES: View[] = ["today", "calendar", "courses", "grades", "tasks", "focus", "settings"];
  function onkey(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key.toLowerCase() === "k" || e.key.toLowerCase() === "n") {
      e.preventDefault();
      ui.quickAdd = !ui.quickAdd;
    } else if (e.key === ",") {
      e.preventDefault();
      go("settings");
    } else if (/^[1-7]$/.test(e.key)) {
      e.preventDefault();
      go(PAGES[Number(e.key) - 1]);
    }
  }
</script>

<svelte:window onkeydown={onkey} />

<Scenery />

{#if ui.ready}
  <div class="shell">
    <Sidebar />
    <main bind:this={main}>
      <div class="content">
        {#key ui.view + (ui.courseId ?? "")}
          {#if ui.view === "today"}<Today />
          {:else if ui.view === "calendar"}<Calendar />
          {:else if ui.view === "courses"}<Courses />
          {:else if ui.view === "course" && course}<CourseDetail {course} />
          {:else if ui.view === "course"}<Courses />
          {:else if ui.view === "grades"}<Grades course={gradeCourse} />
          {:else if ui.view === "tasks"}<Tasks />
          {:else if ui.view === "focus"}<Focus />
          {:else if ui.view === "settings"}<Settings />
          {/if}
        {/key}
      </div>
    </main>
  </div>

  {#if ui.deadlineDraft}<DeadlineEditor draft={ui.deadlineDraft} />{/if}
  {#if ui.courseDraft}<CourseEditor draft={ui.courseDraft} />{/if}
  {#if ui.quickAdd}<QuickAdd />{/if}

  {#if ui.toast}<div class="toast">{ui.toast}</div>{/if}
  {#if ui.saveError}<div class="toast error">{ui.saveError}</div>{/if}
{/if}

<style>
  .shell {
    position: relative;
    z-index: 1;
    display: flex;
    gap: 18px;
    height: 100vh;
    padding: 14px;
  }
  main {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    border-radius: var(--r-lg);
    padding: 0 10px 40px 4px;
  }
  .content {
    max-width: 1240px;
    margin: 0 auto;
  }
  .toast {
    position: fixed;
    left: 50%;
    bottom: 26px;
    transform: translateX(-50%);
    z-index: 80;
    padding: 10px 18px;
    border-radius: 999px;
    background: var(--ink);
    color: var(--panel-solid);
    font-size: 13px;
    box-shadow: var(--shadow);
    animation: up 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  .toast.error { background: var(--warn); color: #fff; bottom: 70px; }
  @keyframes up { from { opacity: 0; transform: translate(-50%, 10px); } }
</style>
