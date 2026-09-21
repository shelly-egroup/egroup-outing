import LoadingIndicator from "./loading-indicator";

export default function OpeningSplash({ loading = false }: { loading?: boolean }) {
  return <div className="film-start">
    <span className="film-start-eyebrow">THE AUTUMN SHOWDOWN</span>
    <h1>揪是<span>要對決</span></h1>
    {loading ? <div className="film-start-loading"><LoadingIndicator label="正在載入" compact /></div> : <p role="status">精彩即將登場</p>}
  </div>;
}
