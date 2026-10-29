<script lang="ts">
  import { untrack } from "svelte";
  import type { Deadline, DeadlineKind } from "../lib/types";
  import { activeCourses, courseById, db, deleteDeadline, saveDeadline, toast, ui } from "../lib/store.svelte";
  import { KIND_LABEL } from "../lib/colors";
  import { compareLabels, parseLabels } from "../lib/sections";
  import Modal from "./Modal.svelte";
  import Icon from "./Icon.svelte";

  let { draft }: { draft: Deadline } = $props();

  // Edit a copy; nothing changes until Save.
  const initial = untrack(() => $state.snapshot(draft) as Deadline);
  const d = $state(initial);
  const isNew = !db.deadlines.some((x) => x.id === initial.id);
  const course = $derived(courseById(d.courseId));
  const sections = $derived(course ? [...course.sections].sort((a, b) => compareLabels(a.label, b.label)) : []);
  let range = $state("");

  const close = () => (ui.deadlineDraft = null);

  function toggleCover(id: string) {
    d.covers = d.covers.includes(id) ? d.covers.filter((x) => x !== id) : [...d.covers, id];
  }

  function applyRange() {
    if (!course) return;
    const labels = new Set(parseLabels(range).map((l) => l.toLowerCase()));
    // "3.1-3.5" style ranges select every section between the two ends, even across chapters.
    const ends = parseLabels(range);
    let picked = course.sections.filter((s) => labels.has(s.label.toLowerCase()));
    if (ends.length === 2 && picked.length === 2) {
      const [a, b] = ends.sort(compareLabels);
      picked = course.sections.filter((s) => compareLabels(s.label, a) >= 0 && compareLabels(s.label, b) <= 0);
    }
    d.covers = [...new Set([...d.covers, ...picked.map((s) => s.id)])];
    range = "";
  }

  function save() {
    if (!d.title.trim()) return;
    d.title = d.title.trim();
    if (!d.time) d.time = undefined;
    if (!course) d.covers = [];
    saveDeadline(d);
    toast(isNew ? "Added" : "Saved");
    close();
  }

  function remove() {
    deleteDeadline(d.id);
    toast("Deleted");
    close();
  }

  const KINDS = Object.keys(KIND_LABEL) as DeadlineKind[];
</script>

<Modal title={isNew ? "New deadline" : "Edit deadline"} onclose={close} width={560}>
  <!-- svelte-ignore a11y_autofocus -->
  <input class="field title" placeholder="What's due? e.g. Midterm 2" bind:value={d.title} autofocus onkeydown={(e) => e.key === "Enter" && save()} />

  <div class="seg kinds">
    {#each KINDS as k}
      <button class:on={d.kind === k} onclick={() => (d.kind = k)}>{KIND_LABEL[k]}</button>
    {/each}
  </div>

  <div class="cols">
    <label class="lbl">Class
      <select class="field" bind:value={d.courseId}>
        <option value={null}>None</option>
        {#each activeCourses() as c (c.id)}<option value={c.id}>{c.code ? `${c.code} — ${c.name}` : c.name}</option>{/each}
      </select>
    </label>
    <label class="lbl">Date<input class="field" type="date" bind:value={d.date} /></label>
    <label class="lbl">Time <span class="faint">(optional)</span><input class="field" type="time" bind:value={d.time} /></label>
  </div>

  {#if course && sections.length}
    <div class="covers">
      <div class="hstack">
        <span class="lbl-text">Covers sections</span>
        <span class="faint small">{d.covers.length} selected</span>
        <div class="spacer"></div>
        <input class="field range" placeholder="e.g. 2.4-3.3" bind:value={range} onkeydown={(e) => e.key === "Enter" && applyRange()} />
        <button class="btn sm" onclick={applyRange}>Select</button>
        {#if d.covers.length}<button class="btn sm ghost" onclick={() => (d.covers = [])}>Clear</button>{/if}
      </div>
      <div class="chips">
        {#each sections as s (s.id)}
          <button class="chip mono" class:on={d.covers.includes(s.id)} onclick={() => toggleCover(s.id)}>{s.label}</button>
        {/each}
      </div>
    </div>
  {/if}

  <label class="lbl">Notes<textarea class="field" bind:value={d.notes} placeholder="Room, allowed materials, submission link…"></textarea></label>

  {#snippet footer()}
    {#if !isNew}<button class="btn ghost danger" onclick={remove}><Icon name="trash" size={15} /> Delete</button>{/if}
    <div class="spacer"></div>
    <button class="btn" onclick={close}>Cancel</button>
    <button class="btn primary" onclick={save} disabled={!d.title.trim()}>{isNew ? "Add deadline" : "Save"}</button>
  {/snippet}
</Modal>

<style>
  .title { height: 44px; font-size: 16px; }
  .kinds { flex-wrap: wrap; justify-self: start; }
  .cols { display: grid; grid-template-columns: 1.4fr 1fr 0.8fr; gap: 10px; }
  .covers { display: grid; gap: 10px; }
  .lbl-text { font-size: 12px; color: var(--ink-2); font-weight: 500; }
  .range { width: 130px; height: 28px; font-size: 12.5px; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; max-height: 140px; overflow: auto; }
  .chip {
    font-size: 12px;
    padding: 4px 9px;
    border-radius: 8px;
    border: 1px solid var(--line-strong);
    background: transparent;
    cursor: pointer;
  }
  .chip.on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
</style>
