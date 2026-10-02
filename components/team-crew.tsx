"use client";
import { useId, useState } from "react";
import { Avatar } from "./account-menu";
import type { PublicVote } from "@/lib/trips";

// Up to this many teammates are named outright; beyond it, an avatar row opens the full roster.
const NAMED_MAX = 3;
const STACK_MAX = 4;

function Plate({ vote, me }: { vote: PublicVote; me: boolean }) {
  return <li className={"crew-plate" + (me ? " is-me" : "")}>
    <Avatar name={vote.displayName} src={vote.photoURL} />
    <span className="crew-name">{vote.displayName}</span>
    {me && <b className="crew-you">你</b>}
  </li>;
}

/** Who stands with a team: an invite to go first, white name plates, or an avatar row that opens the roster. */
export default function TeamCrew({ supporters, currentUid, name, onJoin }: {
  supporters: [string, PublicVote][]; currentUid?: string; name: string; onJoin?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rosterId = useId();
  // The visitor comes first so they can find themselves; the rest keep their order.
  const people = [...supporters].sort(([a], [b]) => Number(b === currentUid) - Number(a === currentUid));
  if (!people.length) return <div className="team-crew is-empty">
    <span className="crew-label">第一位隊友，等你來當</span>
    {onJoin && <button type="button" className="crew-join" onClick={onJoin}>搶頭香 →</button>}
  </div>;
  const label = <span className="crew-label">這一派的隊友<b>{people.length}</b></span>;
  if (people.length <= NAMED_MAX) return <div className="team-crew">
    {label}
    <ul className="crew-plates" aria-label={name + "的隊友"}>{people.map(([uid, vote]) => <Plate key={uid} vote={vote} me={uid === currentUid} />)}</ul>
  </div>;
  return <div className={"team-crew" + (open ? " is-open" : "")}>
    <button type="button" className="crew-toggle" aria-expanded={open} aria-controls={rosterId} onClick={() => setOpen(value => !value)}>
      {label}<span className="sr-only">{open ? "，收合名單" : "，展開名單"}</span>
      <span className="crew-stack" aria-hidden="true">
        {people.slice(0, STACK_MAX).map(([uid, vote]) => <span key={uid} className={"crew-face" + (uid === currentUid ? " is-me" : "")}><Avatar name={vote.displayName} src={vote.photoURL} /></span>)}
        {people.length > STACK_MAX && <span className="crew-more">+{people.length - STACK_MAX}</span>}
      </span>
      <span className="crew-chevron" aria-hidden="true">›</span>
    </button>
    {open && <ul id={rosterId} className="crew-roster" aria-label={name + "的全部隊友"}>{people.map(([uid, vote]) => <Plate key={uid} vote={vote} me={uid === currentUid} />)}</ul>}
  </div>;
}
