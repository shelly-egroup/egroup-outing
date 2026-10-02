import type { ReactNode } from "react";
import LoadingIndicator from "./loading-indicator";
import ShowLogo from "./show-logo";
import { OPENING_IMAGES } from "@/lib/opening-assets";

export default function OpeningSplash({ loading = false, children }: { loading?: boolean; children?: ReactNode }) {
  return <div className={"film-start" + (children ? " film-start-gate" : "")}>
    {children && <div className="gate-fx" aria-hidden="true">
      <i className="gate-rays" />
      <i className="gate-lines" />
      <span className="gate-host gate-host-a"><img src={OPENING_IMAGES.poster} alt="" /></span>
      <span className="gate-host gate-host-b"><img src={OPENING_IMAGES.poster} alt="" /></span>
    </div>}
    <span className="film-start-eyebrow">THE AUTUMN OUTING</span>
    <ShowLogo title />
    {children || (loading ? <div className="film-start-loading"><LoadingIndicator label="正在載入" compact /></div> : <p role="status">精彩即將登場</p>)}
  </div>;
}
