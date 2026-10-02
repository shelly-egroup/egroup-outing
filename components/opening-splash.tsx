import type { ReactNode } from "react";
import LoadingIndicator from "./loading-indicator";
import ShowLogo from "./show-logo";

export default function OpeningSplash({ loading = false, launching = false, children }: { loading?: boolean; launching?: boolean; children?: ReactNode }) {
  return <div className={"film-start" + (children ? " film-start-gate" : "") + (launching ? " is-launching" : "")}>
    {children && <div className="gate-fx" aria-hidden="true">
      <i className="gate-rays" />
      <i className="gate-lines" />
    </div>}
    <span className="film-start-eyebrow">THE AUTUMN OUTING</span>
    <ShowLogo title />
    {children || (loading ? <div className="film-start-loading"><LoadingIndicator label="正在載入" compact /></div> : <p role="status">精彩即將登場</p>)}
  </div>;
}
