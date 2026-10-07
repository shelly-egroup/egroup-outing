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
      title: "忍者闖關\n＋好食在食堂",
      shortName: "極限體能派",
      category: "極限體能派",
      description:
        "先由教練帶領挑戰體能王關卡，再自由練習喜歡的項目，活動結束後步行前往附近的好食在食堂享用午餐。",
      priceNote: "體能王包班 成人 $1,200／人（6 人起）・好食在食堂依現場消費",
      color: "yellow",
      tags: ["室內行程", "教練帶領", "忍者闖關", "聚餐聊天"],
      schedule: [
        {
          time: "10:00",
          title: "忍者館集合",
          description: "台北市信義區基隆路一段 25 號 1 樓，自行前往。",
        },
        {
          time: "10:00–12:00",
          title: "體能王包班",
          description: "90 分鐘教練教學與闖關，最後 30 分鐘自由練習。",
        },
        {
          time: "12:00",
          title: "步行前往餐廳",
          description: "從忍者館步行前往附近的好食在食堂。",
        },
        {
          time: "午餐",
          title: "好食在食堂",
          description: "台北市松山區基隆路一段 8 號，一起享用午餐、輕鬆聊天。",
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
