export const APP_NAME = "DailyQuill";

export const APP_DESCRIPTION =
  "A private daily diary. Write your thoughts, keep them to yourself, or share them with the people you choose.";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://dailyquill.app";

export const FAVICON =
  "https://res.cloudinary.com/dg2fmkcsg/image/upload/v1744737249/euqv6thxbta9auk52jjk.png";

export const LOGO =
  "https://res.cloudinary.com/dg2fmkcsg/image/upload/v1729183137/au5yt9d7rvai0mtmtkd3.png";

/** Labels the product uses for its main sections. */
export const NAV_LABELS = {
  profile: "Persona",
  feed: "Moments",
  inbox: "Inbox",
  requests: "Requests",
  bin: "Recycle",
  settings: "Adjustments",
  logout: "Adios!",
} as const;
