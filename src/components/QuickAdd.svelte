<script lang="ts">
  import type { Course, DeadlineKind } from "../lib/types";
  import { activeCourses, addTodo, newDeadline, saveDeadline, toast, ui } from "../lib/store.svelte";
  import { colorOf, KIND_LABEL } from "../lib/colors";
  import { fmtDay, fmtTime, parseWhen } from "../lib/dates";
  import Icon from "./Icon.svelte";

  let text = $state("");
  let forced = $state<"deadline" | "task" | null>(null);

  const KIND_WORDS: [RegExp, DeadlineKind][] = [
    [/\b(exam|midterm|final)s?\b/i, "exam"],
    [/\bquiz(zes)?\b/i, "quiz"],
    [/\b(hw|homework|assignment|pset|problem set|worksheet|lab report)\b/i, "assignment"],
    [/\b(project|paper|essay|presentation)\b/i, "project"],
    [/\b(read|reading)\b/i, "reading"],
  ];

  function findCourse(s: string): { course?: Course; rest: string } {
    const words = s.toLowerCase();
    for (const c of activeCourses()) {
      const names = [c.code, c.code?.replace(/\s+/g, ""), c.name, c.name.split(/\s+/)[0]]
        .filter((x): x is string => !!x && x.length >= 2)
        .sort((a, b) => b.length - a.length);
      for (const n of names) {
        const re = new RegExp(`(^|\\s)${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "i");
        if (re.test(words)) return { course: c, rest: s.replace(re, " ").replace(/\s+/g, " ").trim() };
      }
    }
    // Short forms: "calc" → Calculus, "chem" → General Chemistry / CHEM 110, "cs" → CS 101.
    const tokens = s.split(/\s+/);
    for (const [i, tok] of tokens.entries()) {
      const w = tok.toLowerCase();
      if (w.length < 2) continue;
      const c = activeCourses().find((c) => {
        const subject = c.code?.toLowerCase().replace(/[\d\s]+$/, "").trim();
        const nameWords = c.name.toLowerCase().split(/\s+/);
        return subject === w || (w.length >= 3 && nameWords.some((n) => n.startsWith(w)));
      });
      if (c) return { course: c, rest: tokens.filter((_, j) => j !== i).join(" ") };
    }
    return { rest: s };
  }

  const parsed = $derived.by(() => {
    const when = parseWhen(text);
    const { course, rest } = findCourse(when.rest);
    const kind = KIND_WORDS.find(([re]) => re.test(rest))?.[1];
    const title = rest ? rest[0].toUpperCase() + rest.slice(1) : "";
    return { ...when, course, kind, title };
  });
  const mode = $derived(forced ?? (parsed.kind ? "deadline" : "task"));

  const close = () => (ui.quickAdd = false);

  function submit() {
    const p = parsed;
    if (!p.title) return;
    if (mode === "deadline") {
      saveDeadline(newDeadline({ title: p.title, courseId: p.course?.id ?? null, kind: p.kind ?? "assignment", ...(p.date ? { date: p.date } : {}), time: p.time }));
      toast(`Deadline added${p.date ? ` for ${fmtDay(p.date)}` : ""}`);
    } else {
      addTodo(p.title, { courseId: p.course?.id ?? null, due: p.date });
      toast("Task added");
    }
    close();
  }

  function onkey(e: KeyboardEvent) {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") close();
    if (e.key === "Tab") {
      e.preventDefault();
      forced = mode === "deadline" ? "task" : "deadline";
    }
  }

  function openFull() {
    const p = parsed;
    ui.deadlineDraft = newDeadline({ title: p.title, courseId: p.course?.id ?? null, kind: p.kind ?? "assignment", ...(p.date ? { date: p.date } : {}), time: p.time });
    close();
  }
</script>

<div class="backdrop" role="presentation" onmousedown={(e) => e.target === e.currentTarget && close()}>
  <div class="quick panel" role="dialog" aria-label="Quick add">
    <div class="input-row">
      <Icon name="plus" size={20} />
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={text} onkeydown={onkey} autofocus placeholder="calc quiz fri 3pm  ·  read ch 4 tomorrow  ·  email prof" />
    </div>
    <div class="preview">
      <div class="seg">
        <button class:on={mode === "task"} onclick={() => (forced = "task")}>Task</button>
        <button class:on={mode === "deadline"} onclick={() => (forced = "deadline")}>Deadline</button>
      </div>
      {#if parsed.course}<span class="tag"><span class="dot" style="background:{colorOf(parsed.course.color)}"></span>{parsed.course.code || parsed.course.name}</span>{/if}
      {#if mode === "deadline"}<span class="tag">{KIND_LABEL[parsed.kind ?? "assignment"]}</span>{/if}
      {#if parsed.date}<span class="tag accent">{fmtDay(parsed.date)}</span>{/if}
      {#if parsed.time}<span class="tag accent">{fmtTime(parsed.time)}</span>{/if}
      <div class="spacer"></div>
      {#if mode === "deadline"}<button class="btn sm ghost" onclick={openFull}>More options</button>{/if}
      <span class="small faint"><span class="kbd">Tab</span> switch · <span class="kbd">Enter</span> add</span>
    </div>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 60; display: flex; justify-content: center; padding-top: 16vh; background: rgba(12, 16, 28, 0.25); animation: fade 0.15s both; }
  .quick { --glass: 0.94; width: 640px; max-width: calc(100vw - 48px); height: fit-content; padding: 6px 8px 10px; animation: rise 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  .input-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; color: var(--ink-3); }
  input { flex: 1; border: 0; background: none; outline: none; font-size: 18px; color: var(--ink); }
  input::placeholder { color: var(--ink-3); }
  .preview { display: flex; align-items: center; gap: 8px; padding: 8px 12px 2px; border-top: 1px solid var(--line); flex-wrap: wrap; }
  @keyframes fade { from { opacity: 0; } }
  @keyframes rise { from { opacity: 0; transform: translateY(-8px); } }
</style>
