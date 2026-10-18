export default function Icon({ name, size = 20, ...props }) {
  const paths = {
    menu: "M4 6h16M4 12h16M4 18h16",
    film: "M3 4h18v16H3ZM7 4v16M17 4v16M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4",
    user: "M8 8a4 4 0 1 0 8 0 4 4 0 0 0-8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
    login: "M14 4h6v16h-6M3 12h12m-4-4 4 4-4 4",
    lock: "M6 10h12v11H6ZM8 10V7a4 4 0 0 1 8 0v3M12 14v3",
    logout: "M10 4H4v16h6M10 12h11m-4-4 4 4-4 4",
    signup:
      "M8 8a4 4 0 1 0 8 0 4 4 0 0 0-8 0ZM3 21v-2a7 7 0 0 1 10-6M18 14v7M14.5 17.5h7",
    filters: "M4 7h16M4 17h16M8 4v6M16 14v6",
    search: "m21 21-5-5 M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15",
    play: "m9 5 11 7-11 7Z",
    plus: "M12 5v14M5 12h14",
    check: "m5 12 4 4 10-10",
    heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    left: "m15 5-7 7 7 7",
    right: "m9 5 7 7-7 7",
    bookmark: "M6 3h12v18l-6-4-6 4Z",
    globe:
      "M3 12h18M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c5 5 5 13 0 18-5-5-5-13 0-18",
    tv: "M4 7h16v13H4ZM8 3l4 4 4-4",
    lights:
      "M9 18h6M10 21h4M8 13a6 6 0 1 1 8 0c-1.5 1.3-2 2.4-2 3H10c0-.6-.5-1.7-2-3ZM12 2V1M4 5 3 4M20 5l1-1M3 11H1M21 11h2",
    fullscreen: "M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5",
    browse: "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
    retry: "M20 7v5h-5M20 12a8 8 0 1 0-2 5",
    live: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14",
    close: "m6 6 12 12M6 18 18 6",
    info: "M12 11v6m0-10v.1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === "play" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.arrow} />
    </svg>
  );
}
