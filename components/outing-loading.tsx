import TitleMark from "./title-mark";

/**
 * The first thing on screen while the page boots: the IMF console coming on. The mark is cut by its laser and a pulse keeps
 * running down the beam; a status line establishes the secure link under a sweeping hairline; viewfinder corners, two laser
 * lines drifting through the dark. Pure CSS, so it plays before any script has run.
 */
export default function OutingLoading() {
  return <main className="boot-screen" role="status" aria-live="polite">
    <span className="sr-only">秋遊特務 載入中</span>
    <i className="boot-screen-beam is-red" aria-hidden="true" /><i className="boot-screen-beam is-blue" aria-hidden="true" />
    <span className="boot-screen-frame" aria-hidden="true"><i /><i /><i /><i /></span>
    <p className="boot-screen-corner is-tl" aria-hidden="true">MISSION 10.29</p>
    <p className="boot-screen-corner is-tr" aria-hidden="true"><i />REC</p>
    <p className="boot-screen-corner is-bl" aria-hidden="true">CHANNEL・ENCRYPTED</p>
    <p className="boot-screen-corner is-br" aria-hidden="true">AUTUMN AGENTS</p>
    <div className="boot-screen-core" aria-hidden="true">
      <TitleMark className="boot-screen-mark" sub="AUTUMN AGENTS" motion="scan" />
      <p className="boot-screen-status"><span>ESTABLISHING SECURE LINK</span><i /></p>
      <span className="boot-screen-bar"><i /></span>
      <p className="boot-screen-note">任務檔案解密中</p>
    </div>
  </main>;
}
