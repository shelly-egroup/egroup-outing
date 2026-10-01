import type { Catalog } from "./trips";
export const defaultCatalog: Catalog = {
  schemaVersion: 4,
  settings: {
    title: "10/29 秋季員工旅遊",
    eventDate: "2026-10-29",
    expectedVoters: 12,
    votingOpen: true,
    closesAt: 1791540000000,
  },
  plans: {
    A: {
      code: "A",
      title: "釣蝦＋村民食堂",
      shortName: "釣趣派",
      category: "釣趣派",
      description:
        "先在室內輕鬆釣蝦、比比誰的收穫最好，再一起前往附近的村民食堂享用平日港點午餐。",
      priceNote: "釣蝦 1 小時 $400 起・村民食堂 $720＋10%",
      color: "yellow",
      tags: ["室內行程", "輕鬆釣蝦", "港式點心", "聚餐聊天"],
      schedule: [
        {
          time: "10:00",
          title: "至善釣蝦場集合",
          description: "台北市士林區至善路三段 13 號，自行前往。",
        },
        {
          time: "10:00–11:30",
          title: "釣蝦體驗",
          description: "釣蝦約 1.5 小時，輕鬆同樂。",
        },
        {
          time: "11:30",
          title: "準備前往餐廳",
          description: "由釣蝦場出發前往附近用餐。",
        },
        {
          time: "午餐",
          title: "村民食堂・廚窗港點",
          description: "士林官邸店，台北市士林區福林路 188 號；平日午餐享用港式點心。",
        },
      ],
      groups: {},
      order: 0,
      active: true,
    },
    B: {
      code: "B",
      title: "雷射對戰＋下午茶",
      shortName: "熱血對戰派",
      category: "熱血對戰派",
      description:
        "先在霓虹迷宮裡組隊攻防、電腦計分，玩完再到飯店享用平日下午茶 Buffet，約兩小時。",
      priceNote: "雷射槍戰 NT$550／人（至少 12 人）・Buffet $968 起／人",
      color: "coral",
      tags: ["室內行程", "團隊對戰", "安全不痛", "飯店下午茶"],
      schedule: [
        {
          time: "12:00",
          title: "六度空間集合",
          description: "台北市中山區中山北路二段 185 號 B1，自行前往。",
        },
        {
          time: "12:00–14:00",
          title: "LazerTreks 雷射槍戰",
          description: "穿感應背心、拿雷射槍，分隊挑戰多種模式。",
        },
        {
          time: "戰後",
          title: "前往飯店",
          description: "移動時間與飯店訂位確認後公布。",
        },
        {
          time: "下午茶",
          title: "下午茶 Buffet",
          description: "三間飯店擇一，依各飯店的平日下午茶時段安排。",
        },
      ],
      groups: {
        g1: {
          order: 0,
          label: "下午茶 Buffet 想吃哪一間？",
          choices: {
            c0: {
              label: "台北老爺酒店｜Le Café",
              description: "14:30–16:30｜平日下午茶",
              price: "$880＋10%",
              store: { id: "le-cafe" },
            },
            c1: {
              label: "台北晶華酒店｜栢麗廳",
              description: "14:30–16:30｜平日下午茶",
              price: "$1,180＋10%",
              store: { id: "brasserie" },
            },
            c2: {
              label: "圓山大飯店｜松鶴餐廳",
              description: "14:30–16:30｜平日下午茶・百道中西日料理與義法甜點，空間大、圓山氛圍最有特色",
              price: "$900＋10%",
              store: { id: "grand-hotel-garden" },
            },
          },
        },
      },
      order: 1,
      active: true,
    },
  },
  updatedAt: 0,
};
