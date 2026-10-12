/** The hosts' file photos and feast shots used by the plan art. */
export const OPENING_IMAGES = {
  photoA: "/assets/show-photo-a.webp",
  photoB: "/assets/show-photo-b.webp",
  feastA: "/assets/show-feast-a.webp",
  feastB: "/assets/show-feast-b.webp",
} as const;

/** The trailer's poster: landscape for the page's key visual and wide screens, a vertical one-sheet for portrait phones. */
export const TRAILER_IMAGES = { keyArt: "/assets/trailer/key-art.webp?v=3", keyArtTall: "/assets/trailer/key-art-tall.webp?v=2" } as const;

/** The pre-rendered trailer (scripts/trailer/render-film.mjs): widescreen, plus a vertical cut for portrait phones. */
export const TRAILER_VIDEO = {
  wide: "/assets/trailer/trailer-16x9.mp4?v=14",
  tall: "/assets/trailer/trailer-9x16.mp4?v=14",
} as const;

/** When the trailer's end card starts to burn (scripts/trailer/timeline.json "burn"): from here the site burns the frozen frame
 *  away live, revealing the page underneath, while the film's own score plays on. */
export const TRAILER_BURN_AT = 37.53;
