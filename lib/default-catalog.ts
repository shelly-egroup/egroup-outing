import { footBathGroup } from "./foot-bath";
import type { Catalog } from "./trips";
export const defaultCatalog: Catalog = {
  schemaVersion: 2,
  settings: {
    title: "10/29 秋季員工旅遊",
    eventDate: "2026-10-29",
    expectedVoters: 12,
    votingOpen: true,
    closesAt: 0,
  },
  plans: {
    A: {
      code: "A",
      title: "大稻埕人文慢旅",
      shortName: "走讀派",
      category: "文化體驗組",
      description:
        "兩小時走讀，從紅磚街屋一路聊到港町往事；午餐與手作把整天排得剛剛好。",
      priceNote: "走讀 $500／人・手作約 $600／人",
      color: "yellow",
      tags: ["戶外步行", "專業導覽", "團體感高", "雨天照常"],
      schedule: [
        {
          time: "10:00",
          title: "大橋頭站集合",
          description: "1 號出口，穿好走的鞋。",
        },
        {
          time: "10–12",
          title: "大稻埕走讀",
          description: "導覽、耳機與保險皆包含。",
        },
        {
          time: "12:00+",
          title: "餐廳三選一",
          description: "海霸王、馬來亞或稻舍食館。",
        },
        {
          time: "午後",
          title: "手作體驗",
          description: "約 1.5 小時，項目確認後公布。",
        },
      ],
      groups: {
        g0: {
          label: "午餐想吃哪一間？",
          choices: {
            c0: {
              label: "海霸王",
              description: "經典中式桌菜，熱鬧聚餐型",
              price: "",
            },
            c1: {
              label: "馬來亞餐廳",
              description: "台菜／酒家菜桌菜",
              price: "",
            },
            c2: {
              label: "稻舍食館",
              description: "大稻埕老屋裡的個人套餐",
              price: "",
            },
          },
        },
      },
      order: 0,
      active: true,
    },
    B: {
      code: "B",
      title: "按摩鬆一下＋下午茶",
      shortName: "放鬆派",
      category: "充電休息組",
      description:
        "每個人挑自己喜歡的按摩強度，結束後集合吃飯店 Buffet，下午留給自由活動。",
      priceNote: "按摩 $1,275 起・Buffet 含服務費 $968 起",
      color: "coral",
      tags: ["室內行程", "按摩任選", "飯店 Buffet", "自由度高"],
      schedule: [
        {
          time: "11:00",
          title: "不老松集合",
          description: "台北新生行館。",
        },
        {
          time: "11:15+",
          title: "按摩體驗",
          description: "依個人方案約 70～100 分鐘。",
        },
        {
          time: "14:30+",
          title: "下午茶 Buffet",
          description: "三間飯店餐廳可選。",
        },
        {
          time: "餐後",
          title: "自由活動",
          description: "想逛街、續攤或回家都可以。",
        },
      ],
      groups: {
        g0: {
          label: "按摩想選哪一種？",
          order: 0,
          selectionMode: "individual",
          choices: {
            c0: {
              label: "足湯腳底按摩・60分鐘",
              description: "",
              price: "$1,275",
            },
            c1: {
              label: "足湯腳底按摩・80分鐘",
              description: "",
              price: "$1,700",
            },
            c2: {
              label: "足湯全身指壓・60分鐘",
              description: "",
              price: "$1,300",
            },
            c3: {
              label: "足湯全身指壓・90分鐘",
              description: "",
              price: "$1,950",
            },
            c4: {
              label: "足湯全身油壓・60分鐘",
              description: "",
              price: "$1,500",
            },
            c5: {
              label: "足湯全身精油SPA・60分鐘",
              description: "",
              price: "$1,800",
            },
            c6: {
              label: "延禧養身套餐・70分鐘",
              description: "",
              price: "$1,675",
            },
            c7: {
              label: "如懿養身套餐・90分鐘",
              description: "",
              price: "$2,099",
            },
          },
        },
        footBath: footBathGroup,
        g1: {
          order: 2,
          label: "下午茶 Buffet 想吃哪一間？",
          choices: {
            c0: {
              label: "Le Café・台北老爺酒店",
              description: "14:30–16:30｜平日下午茶 $880＋10%",
              price: "$968／人",
            },
            c1: {
              label: "栢麗廳・台北晶華酒店",
              description: "14:30–16:30｜平日下午茶 $1,180＋10%",
              price: "$1,298／人",
            },
            c2: {
              label: "十二廚・台北喜來登",
              description: "15:00–17:00｜平日下午茶 $990＋10%・7人以上可能分桌",
              price: "$1,089／人",
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
