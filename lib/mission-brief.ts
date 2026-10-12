// The laser-tag session as LazerTreks describes it on its official site (lazertreks.com, checked 2026-10-12):
// the 2-hour corporate plan "歡樂團隊凝聚", its team missions, the house rules and how to get there.

export const MISSION_IMAGES = {
  arena: "/assets/mission/arena.webp",
  tea: "/assets/mission/tea.webp",
  walkout: "/assets/mission/walkout.webp",
  /** the captains as cut-outs, aiming at each other: red mirrored to face right, blue facing left */
  captainRed: "/assets/mission/captain-red.webp?v=3",
  captainBlue: "/assets/mission/captain-blue.webp",
  smoke: "/assets/mission/smoke.webp",
} as const;

/** The afternoon-tea vote's winner as the organisers reported it (台北晶華酒店・栢麗廳): shown until the live tally loads, or if it
 *  cannot be read; the tally decides once it answers. */
export const TEA_WINNER = "晶華";

export const ARENA_FACTS = [
  { label: "時長", value: "2 小時・5 場對戰", note: "遲到會少玩場次" },
  { label: "流程", value: "裝備教學 → 暖身個人賽 → 團隊對抗", note: "教練全程帶領" },
  { label: "裝備", value: "感應背心＋雷射槍", note: "場館提供，不必穿護具" },
  { label: "戰場", value: "近 300 m² 霓虹迷宮", note: "碉堡與感應基地，對戰時整場只有我們這團" },
] as const;

export const MISSION_MODES = [
  { code: "M-01", name: "堡壘攻防戰", line: "分成兩隊、各配一色正面對決，還能加碼策略挑戰。" },
  { code: "M-02", name: "堡壘爭奪戰", line: "佔領敵方碉堡越久越好，但在前線站太久就會被集火。" },
  { code: "M-03", name: "團隊死鬥", line: "每人只有 10 條命，先把命數用完的一隊落敗。" },
  { code: "M-04", name: "VIP", line: "一人擔任 VIP，說不定就是老闆，全隊拚命護駕；VIP 陣亡就輸。" },
  { code: "M-05", name: "Team Capture", line: "射中對手，他就變成你的隊色；被射中，換你倒戈。" },
  { code: "M-06", name: "狼人 vs 吸血鬼", line: "狼人起始命數多，吸血鬼能偷走對手的命，誰撐到最後？" },
] as const;

export type ManualIcon = "gear" | "clock" | "locker" | "nofood" | "heart";
export const FIELD_MANUAL: { key: string; icon: ManualIcon; title: string; body: string }[] = [
  { key: "服裝", icon: "gear", title: "好活動的衣服＋運動鞋", body: "避開裙子、拖鞋與尖銳飾品；手環、手錶上場前先收好。" },
  { key: "準時", icon: "clock", title: "提早 10–15 分鐘到", body: "遊戲依預約時間開始計算，遲到只能中途加入、少玩場次。" },
  { key: "置物", icon: "locker", title: "手機、錢包鎖進置物櫃", body: "大包包和外套放休息區，貴重物品先上鎖。" },
  { key: "飲食", icon: "nofood", title: "禁止攜帶外食", body: "場內不提供餐點，也不能帶食物進場；肚子留給戰後的下午茶。" },
  { key: "身心", icon: "heart", title: "愉快團結的心、健康的身體", body: "帶著好心情和隊友默契上場、彼此掩護。Class II 雷射對人體無害，不像漆彈會痛；嚴重心臟疾病或懷孕不建議上場。" },
];

export const ARENA_TRANSIT = [
  { mode: "捷運", text: "民權西路站 9 號出口，步行約 8 分鐘" },
  { mode: "公車", text: "「大同公司（晴光市場）」或「民權中山路口」站" },
  { mode: "開車", text: "場館沒有停車場，請停附近公有停車場" },
] as const;

const DAY = 86400000, HOUR = 3600000, MINUTE = 60000;
/** Time left until the mission starts (Asia/Taipei), or where the day stands once it has begun. */
export function missionClock(eventDate: string, startTime: string, now: number) {
  const time = /^\d{1,2}:\d{2}/.exec(startTime)?.[0] || "12:00";
  const start = Date.parse(eventDate + "T" + time.padStart(5, "0") + ":00+08:00");
  if (!Number.isFinite(start)) return null;
  const left = start - now;
  if (left <= 0) return { state: now - start < 10 * HOUR ? "live" as const : "done" as const, days: 0, hours: 0, minutes: 0, seconds: 0 };
  return { state: "counting" as const, days: Math.floor(left / DAY), hours: Math.floor(left % DAY / HOUR), minutes: Math.floor(left % HOUR / MINUTE), seconds: Math.floor(left % MINUTE / 1000) };
}

/** A Google Calendar draft for the day: the meet-up at the arena through the end of the afternoon-tea seating. */
export function missionCalendarUrl({ title, eventDate, start, end, location, details }: { title: string; eventDate: string; start: string; end: string; location: string; details: string }) {
  const stamp = (time: string) => new Date(eventDate + "T" + time + ":00+08:00").toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const query = new URLSearchParams({ action: "TEMPLATE", text: title, dates: stamp(start) + "/" + stamp(end), location, details, ctz: "Asia/Taipei" });
  return "https://calendar.google.com/calendar/render?" + query.toString();
}
