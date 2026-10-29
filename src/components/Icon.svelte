<script lang="ts" module>
  // Simple 24px line icons (stroke-based, so they follow text colour).
  const PATHS = {
    today: "M12 3v2M12 19v2M5.6 5.6 7 7M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
    calendar: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7ZM4 10h16M8 3v4M16 3v4",
    courses: "M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13V4Z",
    tasks: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
    focus: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 9v4l2.5 2M10 2h4",
    settings: "M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4",
    plus: "M12 5v14M5 12h14",
    close: "M6 6l12 12M18 6 6 18",
    check: "M5 12.5 9.5 17 19 7",
    trash: "M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12",
    link: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1",
    left: "M15 6l-6 6 6 6",
    right: "M9 6l6 6-6 6",
    down: "M6 9l6 6 6-6",
    edit: "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
    pin: "M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11ZM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    flag: "M5 21V4M5 4h11l-2 4 2 4H5",
    play: "M8 5v14l11-7L8 5Z",
    pause: "M8 5v14M16 5v14",
    reset: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
    search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
    spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z",
    download: "M12 4v11M7 10l5 5 5-5M5 20h14",
    upload: "M12 20V9M7 14l5-5 5 5M5 4h14",
    folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
    grade: "M4 19h16M7 16V9M12 16V5M17 16v-4",
    note: "M6 4h9l4 4v12H6V4ZM14 4v5h5M9 13h7M9 17h5",
    archive: "M4 5h16v4H4zM5 9v10h14V9M10 13h4",
    mountain: "M3 19 9.5 8l4 6.5L16 11l5 8H3Z",
  } as const;
  export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
  let { name, size = 18, stroke = 1.6 }: { name: IconName; size?: number; stroke?: number } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={name === "play" ? "currentColor" : "none"}
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  style="flex:none"
>
  <path d={PATHS[name]} />
</svg>
