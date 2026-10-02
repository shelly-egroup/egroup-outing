import type { ReactNode } from "react";
import LoadingIndicator from "./loading-indicator";
import ShowLogo from "./show-logo";

export default function OpeningSplash({ loading = false, children }: { loading?: boolean; children?: ReactNode }) {
  return <div className={"film-start" + (children ? " film-start-gate" : "")}>
    <span className="film-start-eyebrow">THE AUTUMN OUTING</span>
    <ShowLogo title />
    {children || (loading ? <div className="film-start-loading"><LoadingIndicator label="正在載入" compact /></div> : <p role="status">精彩即將登場</p>)}
  </div>;
}
