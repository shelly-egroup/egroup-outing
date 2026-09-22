import LoadingPanel from "@/components/loading-panel";

export default function Loading() {
  return <main className="wrap admin-route-loading">
    <LoadingPanel label="主辦專區準備中" description="正在整理方案與投票資料。" />
  </main>;
}
