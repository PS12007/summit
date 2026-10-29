<script lang="ts">
  import { db, emptyData, normalize, replaceAll, toast } from "../lib/store.svelte";
  import { SCENES, sceneById, sceneOfTheDay, thumbUrl } from "../lib/scenes";
  import { STYLES, artFor } from "../lib/art";
  import { buildIcs } from "../lib/ics";
  import { sampleData } from "../lib/sample";
  import { confirmDialog, dataFolder, openFile, openUrl, saveFile } from "../lib/platform";
  import { today } from "../lib/dates";
  import Icon from "../components/Icon.svelte";

  const s = $derived(db.settings);
  const shown = $derived(s.dailyScene ? sceneOfTheDay() : sceneById(s.scene));

  // Thumbnails drawn in the chosen style (the plain photo shows until each one is ready).
  let thumbs = $state<Record<string, string>>({});
  $effect(() => {
    const style = s.artStyle;
    for (const sc of SCENES) {
      artFor(thumbUrl(sc.id), style, 480, 0.42).then((a) => {
        if (db.settings.artStyle === style) thumbs[sc.id] = a.url;
      }, () => {});
    }
    return () => (thumbs = {});
  });

  let folder = $state("");
  dataFolder().then((f) => (folder = f));
  let includeClasses = $state(true);

  async function exportJson() {
    if (await saveFile(`summit-backup-${today()}.json`, JSON.stringify($state.snapshot(db), null, 2), "json", "Summit backup")) toast("Backup saved");
  }
  async function importJson() {
    const text = await openFile("json", "Summit backup");
    if (!text) return;
    try {
      const data = normalize(JSON.parse(text));
      if (!(await confirmDialog(`Replace everything with this backup? (${data.courses.length} classes, ${data.deadlines.length} deadlines, ${data.todos.length} tasks)`))) return;
      replaceAll(data);
      toast("Backup restored");
    } catch {
      toast("That file isn't a valid Summit backup");
    }
  }
  async function exportIcs() {
    if (await saveFile(`summit-${today()}.ics`, buildIcs($state.snapshot(db), includeClasses), "ics", "Calendar")) toast("Calendar file saved — import it into Google/Outlook/Apple Calendar");
  }
  async function loadSample() {
    if (db.courses.length && !(await confirmDialog("Replace your current data with the sample semester?"))) return;
    replaceAll(sampleData($state.snapshot(db)));
    toast("Sample semester loaded");
  }
  async function resetAll() {
    if (!(await confirmDialog("Delete all classes, deadlines, tasks and focus history? This can't be undone (daily backups are kept in the data folder)."))) return;
    replaceAll({ ...emptyData(), settings: $state.snapshot(db.settings) });
    toast("Everything cleared");
  }
</script>

<div class="settings fade-in">
  <header class="top"><h1>Settings</h1></header>

  <section class="panel">
    <div class="panel-head"><h2>Scenery</h2></div>
    <div class="row style-row">
      <span class="label">Style</span>
      <div class="seg">
        {#each STYLES as st (st.id)}<button class:on={s.artStyle === st.id} onclick={() => (s.artStyle = st.id)}>{st.name}</button>{/each}
      </div>
    </div>
    <div class="scenes">
      {#each SCENES as sc (sc.id)}
        <button class="scene" class:on={shown.id === sc.id} onclick={() => ((s.scene = sc.id), (s.dailyScene = false))} title="{sc.name} · {sc.place}">
          <span class="thumb"><img src={thumbs[sc.id] ?? thumbUrl(sc.id)} alt="" draggable="false" /></span>
          <span class="small">{sc.name}</span>
        </button>
      {/each}
    </div>
    <div class="row">
      <span class="label">New place every day</span>
      <button class="toggle" class:on={s.dailyScene} onclick={() => (s.dailyScene = !s.dailyScene)} aria-label="Change the background every day"><i></i></button>
      <span class="small faint">cycles through all {SCENES.length} photos</span>
    </div>
    <p class="small faint credit">
      {shown.name}, {shown.place} · Photo by {shown.credit}, {shown.license} ·
      <button class="linkish" onclick={() => openUrl(shown.source)}>Wikimedia Commons</button>
    </p>
    <div class="row">
      <span class="label">Panel opacity</span>
      <input type="range" min="0.4" max="0.95" step="0.01" bind:value={s.glass} />
      <span class="mono small faint">{Math.round(s.glass * 100)}%</span>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head"><h2>You & your term</h2></div>
    <div class="form">
      <label class="lbl">Your name<input class="field" bind:value={s.name} placeholder="For the greeting" /></label>
      <label class="lbl">Semester starts<input class="field" type="date" bind:value={s.semesterStart} /></label>
      <label class="lbl">Semester ends<input class="field" type="date" bind:value={s.semesterEnd} /></label>
    </div>
    <p class="small faint">Semester dates limit class times to the term and show “Week 9 of 15” on Today.</p>
    <div class="row">
      <span class="label">Week starts on</span>
      <div class="seg">
        <button class:on={s.weekStartsMonday} onclick={() => (s.weekStartsMonday = true)}>Monday</button>
        <button class:on={!s.weekStartsMonday} onclick={() => (s.weekStartsMonday = false)}>Sunday</button>
      </div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head"><h2>Reminders & focus</h2></div>
    <div class="row">
      <span class="label">Desktop reminders</span>
      <button class="toggle" class:on={s.notifications} onclick={() => (s.notifications = !s.notifications)} aria-label="Toggle reminders"><i></i></button>
      <span class="small faint">while Summit is open, once a day per deadline</span>
    </div>
    <div class="row">
      <span class="label">Remind me</span>
      <select class="field short" bind:value={s.remindDaysBefore}>
        {#each [0, 1, 2, 3, 5, 7] as n}<option value={n}>{n === 0 ? "on the day" : `${n} day${n > 1 ? "s" : ""} before`}</option>{/each}
      </select>
    </div>
    <div class="row">
      <span class="label">Focus / break</span>
      <input class="field tiny" type="number" min="1" max="120" bind:value={s.focusMinutes} />
      <span class="faint">/</span>
      <input class="field tiny" type="number" min="1" max="60" bind:value={s.breakMinutes} />
      <span class="small faint">minutes</span>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head"><h2>Your data</h2></div>
    <p class="small muted">Everything is stored in one file on this computer. A copy is saved to <span class="mono">backups/</span> once a day (last 14 days).</p>
    <div class="mono small path">{folder}</div>
    <div class="buttons">
      <button class="btn" onclick={exportJson}><Icon name="download" size={15} /> Export backup</button>
      <button class="btn" onclick={importJson}><Icon name="upload" size={15} /> Import backup</button>
      <button class="btn" onclick={exportIcs}><Icon name="calendar" size={15} /> Export to calendar (.ics)</button>
      <label class="small inc"><input type="checkbox" bind:checked={includeClasses} /> include weekly classes</label>
    </div>
    <div class="buttons">
      <button class="btn ghost" onclick={loadSample}>Load sample semester</button>
      <button class="btn ghost danger" onclick={resetAll}><Icon name="trash" size={15} /> Clear all data</button>
    </div>
  </section>

  <section class="panel keys">
    <div class="panel-head"><h2>Shortcuts</h2></div>
    <div class="kgrid small">
      <span><span class="kbd">Ctrl K</span> Quick add</span>
      <span><span class="kbd">Ctrl 1–5</span> Switch pages</span>
      <span><span class="kbd">Ctrl ,</span> Settings</span>
      <span><span class="kbd">← →</span> Move in calendar</span>
      <span><span class="kbd">Shift-click</span> Done through a section</span>
      <span><span class="kbd">Right-click</span> Section options</span>
    </div>
  </section>
</div>

<style>
  .settings { display: grid; gap: 18px; max-width: 860px; }
  .top { padding-top: 16px; color: var(--hero-ink); text-shadow: var(--hero-shadow); }
  .top h1 { font-size: 46px; line-height: 1; }
  .style-row { margin: 0 0 14px; }
  .scenes { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 8px; }
  .scene { display: grid; gap: 6px; padding: 0; border: 0; background: none; cursor: pointer; text-align: center; color: var(--ink-2); }
  .thumb { display: block; aspect-ratio: 16 / 10; border-radius: 12px; overflow: hidden; outline: 2px solid transparent; outline-offset: 2px; transition: outline-color 0.15s; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .credit { margin: 12px 0 0; }
  .linkish { border: 0; background: none; padding: 0; color: inherit; text-decoration: underline; cursor: pointer; font-size: inherit; }
  .scene:hover .thumb { outline-color: var(--line-strong); }
  .scene.on .thumb { outline-color: var(--accent); }
  .scene.on { color: var(--ink); font-weight: 600; }
  .row { display: flex; align-items: center; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
  .label { width: 150px; font-weight: 500; font-size: 13px; }
  input[type="range"] { width: 220px; accent-color: var(--accent); }
  .form { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 10px; }
  .short { width: 180px; }
  .tiny { width: 70px; }
  .toggle { width: 40px; height: 24px; border-radius: 999px; border: 0; background: var(--line-strong); position: relative; cursor: pointer; transition: background 0.2s; }
  .toggle i { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2); }
  .toggle.on { background: var(--accent); }
  .toggle.on i { transform: translateX(16px); }
  .path { padding: 8px 10px; border-radius: 8px; background: var(--field); border: 1px solid var(--line); margin: 8px 0 12px; user-select: text; word-break: break-all; }
  .buttons { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
  .inc { display: inline-flex; gap: 6px; align-items: center; color: var(--ink-2); }
  .inc input { accent-color: var(--accent); }
  .kgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; color: var(--ink-2); }
  .kgrid .kbd { margin-right: 6px; }
</style>
