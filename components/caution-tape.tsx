type Props = { words: string[]; tone?: "yellow" | "ink"; reverse?: boolean; className?: string };

/** Hazard-striped tape with a running label; the phrase repeats so moving the track by half its width loops seamlessly. */
export default function CautionTape({ words, tone = "yellow", reverse = false, className = "" }: Props) {
  const run = Array.from({ length: 6 }, () => words).flat();
  return <div className={"caution-tape tape-" + tone + (reverse ? " is-reverse" : "") + (className ? " " + className : "")} aria-hidden="true">
    <div className="caution-track">{[...run, ...run].map((word, index) => <span key={index}>{word}<i>✦</i></span>)}</div>
  </div>;
}
