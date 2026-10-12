/** Show cut-outs (B&W hosts, hand-held props) used by the page's plan art and the trailer's dossier. */
export const OPENING_IMAGES = {
  hostA: "/assets/show-host-a.webp",
  hostB: "/assets/show-host-b.webp",
  photoA: "/assets/show-photo-a.webp",
  photoB: "/assets/show-photo-b.webp",
  feastA: "/assets/show-feast-a.webp",
  feastB: "/assets/show-feast-b.webp",
} as const;

/** Every picture the opening trailer cuts to. Shared by the film, the first-visit preload and the START cover. */
export const TRAILER_IMAGES = {
  keyArt: "/assets/trailer/key-art.webp",
  agentWalk: "/assets/trailer/agent-a-walk.webp",
  agentAim: "/assets/trailer/agent-a-aim.webp",
  agentB: "/assets/trailer/agent-b-pose.webp",
  hostA: OPENING_IMAGES.hostA,
  hostB: OPENING_IMAGES.hostB,
  arena: "/assets/trailer/arena.webp",
  gear: "/assets/trailer/gear.webp",
  teams: "/assets/trailer/teams.webp",
  fireA: "/assets/trailer/agent-a-laser.webp",
  target: "/assets/trailer/target-hit.webp",
  aimB: "/assets/trailer/agent-b-aim.webp",
  squad: "/assets/trailer/squad.webp",
  tea: "/assets/trailer/tea.webp",
  vault: "/assets/trailer/vault.webp",
  targetA: "/assets/trailer/target-a.webp",
  targetB: "/assets/trailer/target-b.webp",
} as const;

/** Faces the trailer sets type in; START waits for them so no title swaps font mid-cut. */
export const TRAILER_FONTS = [
  '900 64px "Noto Serif TC"',
  '700 64px "Noto Sans TC"',
  '900 64px "Noto Sans TC"',
  '600 32px "JetBrains Mono"',
  '400 32px "Marcellus"',
  '600 32px "Oswald"',
];

export const OPENING_SCORE = "/assets/trailer-score.m4a?v=1";
