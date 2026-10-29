<script lang="ts">
  import { untrack } from "svelte";
  import type { Course } from "../lib/types";
  import { db, deleteCourse, go, toast, ui, uid } from "../lib/store.svelte";
  import { COURSE_COLORS } from "../lib/colors";
  import { DAY_SHORT } from "../lib/dates";
  import { confirmDialog } from "../lib/platform";
  import Modal from "./Modal.svelte";
  import Icon from "./Icon.svelte";

  let { draft }: { draft: Course } = $props();

  // Edit a copy; nothing changes until Save.
  const initial = untrack(() => $state.snapshot(draft) as Course);
  const c = $state(initial);
  const isNew = !db.courses.some((x) => x.id === initial.id);
  const close = () => (ui.courseDraft = null);

  const addMeeting = () => {
    const last = c.meetings.at(-1);
    c.meetings.push({ id: uid(), day: last ? (last.day + 2) % 7 : 1, start: last?.start ?? "09:00", end: last?.end ?? "10:15", kind: last?.kind ?? "Lecture", place: last?.place });
  };
  const addLink = () => c.links.push({ id: uid(), label: "", url: "" });

  function save() {
    if (!c.name.trim()) return;
    c.name = c.name.trim();
    c.links = c.links.filter((l) => l.url.trim());
    c.links.forEach((l) => (l.label = l.label.trim() || l.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]));
    const copy = $state.snapshot(c) as Course;
    const i = db.courses.findIndex((x) => x.id === c.id);
    if (i >= 0) db.courses[i] = copy;
    else db.courses.push(copy);
    toast(isNew ? `Added ${c.code || c.name}` : "Saved");
    close();
    if (isNew) go("course", c.id);
  }

  async function remove() {
    if (!(await confirmDialog(`Delete ${c.name}? Its sections, grades and deadlines will be removed. Tasks are kept.`))) return;
    deleteCourse(c.id);
    close();
    go("courses");
    toast("Class deleted");
  }

  function archive() {
    const real = db.courses.find((x) => x.id === c.id);
    if (real) real.archived = !real.archived;
    toast(real?.archived ? "Archived — find it under Classes" : "Restored");
    close();
  }
</script>

<Modal title={isNew ? "New class" : "Edit class"} onclose={close} width={620}>
  <div class="cols-2">
    <!-- svelte-ignore a11y_autofocus -->
    <label class="lbl">Name<input class="field" bind:value={c.name} placeholder="Calculus I" autofocus /></label>
    <label class="lbl">Code <span class="faint">(short name)</span><input class="field" bind:value={c.code} placeholder="MATH 151" /></label>
  </div>
  <div class="cols-2">
    <label class="lbl">Instructor<input class="field" bind:value={c.instructor} placeholder="Prof. Rivera" /></label>
    <label class="lbl">Target grade %<input class="field" type="number" min="0" max="100" bind:value={c.target} placeholder="90" /></label>
  </div>

  <div class="lbl">
    Colour
    <div class="swatches">
      {#each Object.entries(COURSE_COLORS) as [key, hex]}
        <button class="swatch" class:on={c.color === key} style="background:{hex}" onclick={() => (c.color = key)} aria-label={key}></button>
      {/each}
    </div>
  </div>

  <div class="block">
    <div class="hstack"><span class="eyebrow">Weekly schedule</span><div class="spacer"></div><button class="btn sm" onclick={addMeeting}><Icon name="plus" size={14} /> Add time</button></div>
    {#each c.meetings as m (m.id)}
      <div class="meeting">
        <select class="field" bind:value={m.day}>{#each DAY_SHORT as d, i}<option value={i}>{d}</option>{/each}</select>
        <input class="field" type="time" bind:value={m.start} />
        <input class="field" type="time" bind:value={m.end} />
        <input class="field" bind:value={m.kind} placeholder="Lecture" list="kinds" />
        <input class="field" bind:value={m.place} placeholder="Room" />
        <button class="btn icon sm ghost" onclick={() => (c.meetings = c.meetings.filter((x) => x.id !== m.id))} aria-label="Remove"><Icon name="close" size={14} /></button>
      </div>
    {:else}
      <div class="faint small">No class times yet. They show up on Today and in the week calendar.</div>
    {/each}
    <datalist id="kinds"><option>Lecture</option><option>Lab</option><option>Discussion</option><option>Recitation</option><option>Office hours</option><option>Seminar</option></datalist>
  </div>

  <div class="block">
    <div class="hstack"><span class="eyebrow">Links</span><div class="spacer"></div><button class="btn sm" onclick={addLink}><Icon name="plus" size={14} /> Add link</button></div>
    {#each c.links as l (l.id)}
      <div class="link">
        <input class="field" bind:value={l.label} placeholder="Canvas" />
        <input class="field" bind:value={l.url} placeholder="https://…" />
        <button class="btn icon sm ghost" onclick={() => (c.links = c.links.filter((x) => x.id !== l.id))} aria-label="Remove"><Icon name="close" size={14} /></button>
      </div>
    {:else}
      <div class="faint small">Course site, Gradescope, Piazza, Zoom…</div>
    {/each}
  </div>

  {#snippet footer()}
    {#if !isNew}
      <button class="btn ghost danger" onclick={remove}><Icon name="trash" size={15} /> Delete</button>
      <button class="btn ghost" onclick={archive}><Icon name="archive" size={15} /> {c.archived ? "Restore" : "Archive"}</button>
    {/if}
    <div class="spacer"></div>
    <button class="btn" onclick={close}>Cancel</button>
    <button class="btn primary" onclick={save} disabled={!c.name.trim()}>{isNew ? "Add class" : "Save"}</button>
  {/snippet}
</Modal>

<style>
  .cols-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .swatches { display: flex; gap: 8px; }
  .swatch { width: 26px; height: 26px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.35); }
  .swatch.on { border-color: var(--ink); }
  .block { display: grid; gap: 8px; padding-top: 6px; }
  .meeting { display: grid; grid-template-columns: 80px 104px 104px 1fr 1fr 28px; gap: 6px; align-items: center; }
  .link { display: grid; grid-template-columns: 160px 1fr 28px; gap: 6px; align-items: center; }
  .meeting .field, .link .field { height: 32px; }
</style>
