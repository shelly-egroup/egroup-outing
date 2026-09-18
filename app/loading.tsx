import LoadingIndicator from "@/components/loading-indicator";
export default function Loading() {
  return <main className="route-loading">
    <span className="eyebrow">THE AUTUMN SHOWDOWN</span>
    <div className="loading-match" aria-hidden="true"><span>A</span><b>VS</b><span>B</span></div>
    <h1>秋遊要對決</h1>
    <LoadingIndicator label="正在準備你的秋遊" />
  </main>;
}
