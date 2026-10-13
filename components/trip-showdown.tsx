"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import OutingHeader from "./outing-header";
import OpeningAnimation from "./opening-animation";
import MissionHero from "./mission-hero";
import MissionSections, { MissionFooter } from "./mission-sections";
import OutingLoading from "./outing-loading";
import { useSectionReveal } from "./use-section-reveal";
import { useOuting } from "./outing-provider";
import { openingHistory } from "@/lib/opening-history";
import { defaultCatalog } from "@/lib/default-catalog";

/** The outing page: the trailer on a first visit, then the trip (plan B, 熱血對戰派) and nothing else. */
export default function TripShowdown() {
  const { catalog: remoteCatalog, now } = useOuting();
  const catalog = remoteCatalog || defaultCatalog;
  // Looked up by plan code rather than position, so reordering plans in the organiser desk never swaps the trip.
  const [planId, plan] = Object.entries(catalog.plans || {}).find(([, item]) => item.code === "B") || ["B", defaultCatalog.plans.B];
  const [intro, setIntro] = useState(false), [introReady, setIntroReady] = useState(false), [replaying, setReplaying] = useState(false);
  // while the trailer burns away the page is already showing underneath it
  const [revealing, setRevealing] = useState(false), shown = !intro || revealing;
  useLayoutEffect(() => { setIntro(!openingHistory.hasSeen()); setIntroReady(true); }, []);
  // After the trailer, cue the key visual's first action so the film hands straight over to the mission.
  const [cueNext, setCueNext] = useState(false);
  const nextStepRef = useRef<HTMLAnchorElement>(null), pageRef = useRef<HTMLDivElement>(null), heroActionsRef = useRef<HTMLDivElement>(null);
  useSectionReveal(pageRef, introReady && shown);
  const finishIntro = useCallback(() => { openingHistory.markSeen(); setIntro(false); setRevealing(false); setCueNext(true); }, []);
  const revealPage = useCallback(() => setRevealing(true), []);
  const replay = useCallback(() => { setReplaying(true); setIntro(true); window.scrollTo({ top: 0, behavior: "instant" }); }, []);
  useEffect(() => {
    if (!cueNext) return;
    nextStepRef.current?.focus({ preventScroll: true });
    const timer = setTimeout(() => setCueNext(false), 3600);
    return () => clearTimeout(timer);
  }, [cueNext]);
  if (!introReady) return <OutingLoading />;
  const { title, eventDate } = catalog.settings;
  return <>
    {intro && <OpeningAnimation onFinish={finishIntro} onReveal={revealPage} autoStart={replaying} />}
    <div ref={pageRef} hidden={!shown} className="outing-page mission-page">
      <OutingHeader active={shown} heroActions={heroActionsRef} title={title} eventDate={eventDate} acceptClosesAt={catalog.settings.acceptClosesAt || 0} now={now} />
      <MissionHero eventDate={eventDate} plan={plan} ready={shown} cued={cueNext} actionsRef={heroActionsRef} primaryRef={nextStepRef} onReplay={replay} />
      <main><MissionSections plan={plan} planId={planId} eventDate={eventDate} now={now} /></main>
      <MissionFooter plan={plan} eventDate={eventDate} title={title} onReplay={replay} />
    </div>
  </>;
}
