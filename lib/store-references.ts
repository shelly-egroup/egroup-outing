export type StoreInfo = {
  id: string;
  name: string;
  mapsQuery: string;
  mapsUrl?: string;
  branch?: string;
  website?: string;
  facebook?: string;
  line?: string;
};

// Links checked against official store pages on 2026-09-24.
// Known names keep links correct when organizers reorder or replace choices.
export const restaurantStores: (StoreInfo & { labels: string[] })[] = [
  { id: "hpw-changan", name: "海霸王・台北長安店", branch: "台北市・長安店", labels: ["海霸王", "海霸王長安店", "海霸王・台北長安店"], mapsQuery: "海霸王 長安店 台北市大同區長安西路287號", website: "https://www.hpw.com.tw/zh-tw/海霸王/Room/台北市-長安店" },
  { id: "malaya", name: "馬來亞餐廳", labels: ["馬來亞餐廳", "馬來亞"], mapsQuery: "台北 馬來亞餐廳", website: "https://malaya.com.tw/index" },
  { id: "rice-dihua", name: "稻舍食館", labels: ["稻舍食館", "稻舍"], mapsQuery: "稻舍食館 迪化店", website: "https://www.rice1923.com/" },
  { id: "le-cafe", name: "台北老爺酒店｜Le Café", labels: ["台北老爺酒店｜Le Café", "Le Café・台北老爺酒店", "Le Café", "Le Café 咖啡廳"], mapsQuery: "台北老爺酒店 Le Café", website: "https://www.royal-taipei.com.tw/dining-detail/E3/" },
  { id: "brasserie", name: "台北晶華酒店｜栢麗廳", labels: ["台北晶華酒店｜栢麗廳", "栢麗廳・台北晶華酒店", "栢麗廳"], mapsQuery: "台北晶華酒店 栢麗廳", website: "https://www.regenttaiwan.com/dining/brasserie" },
  { id: "grand-hotel-garden", name: "圓山大飯店｜松鶴餐廳", labels: ["圓山大飯店｜松鶴餐廳", "圓山大飯店 松鶴餐廳", "松鶴餐廳"], mapsQuery: "圓山大飯店 松鶴餐廳 台北市中山區中山北路四段1號", website: "https://www.grand-hotel.org/TW/official/restaurant-detail.aspx?gh=tp&serno=1" },
  { id: "kitchen12", name: "十二廚・台北喜來登", labels: ["十二廚・台北喜來登", "十二廚"], mapsQuery: "台北喜來登 十二廚", website: "https://www.sheratongrandtaipei.com/websev?cat=2&id=15&lang=zh-tw&ref=pages" },
];

const normalizedLabel = (label: string) => label.normalize("NFKC").replace(/[\s・·]/g, "").toLowerCase();
export function choiceStore(label: string): StoreInfo | undefined {
  if (["村民食堂・廚窗港點", "村民食堂・廚窗港點士林官邸店", "村民食堂・廚窗港點（士林官邸店）"].some(name => normalizedLabel(name) === normalizedLabel(label))) return villagerStore;
  return restaurantStores.find(store => store.labels.some(name => normalizedLabel(name) === normalizedLabel(label)));
}

// Fixed itinerary venues are linked directly without entering the review-snapshot directory.
export const zhishanFishingStore: StoreInfo = {
  id: "zhishan-shrimp-fishing",
  name: "至善釣蝦場",
  mapsQuery: "至善釣蝦場 台北市士林區",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=%E5%8F%B0%E5%8C%97%E5%B8%82%E5%A3%AB%E6%9E%97%E5%8D%80%E8%87%B3%E5%96%84%E9%87%A3%E8%9D%A6%E5%A0%B4&query_place_id=ChIJVXB7M7WtQjQRSpFuB75PJ54",
};

export const villagerStore: StoreInfo = {
  id: "villager-shilin",
  name: "村民食堂・廚窗港點（士林官邸店）",
  branch: "台北市士林區福林路 188 號",
  mapsQuery: "村民食堂 廚窗港點 士林官邸店 台北市士林區福林路188號",
  website: "https://villager.com.tw/",
};

export const lazerTreksStore: StoreInfo = {
  id: "lazertreks-taipei",
  name: "六度空間 雷射槍戰（LazerTreks）",
  mapsQuery: "LazerTreks Taipei 台北",
  website: "https://www.lazertreks.com/packages/corporate-groups-company-events/",
};

export const massageStore: StoreInfo = {
  id: "youngsong-xinsheng",
  name: "不老松足湯・台北新生行館",
  mapsQuery: "不老松足湯台北新生行館 新生北路二段70號",
  facebook: "https://www.facebook.com/youngsongshu3",
  line: "https://page.line.me/wop0224t",
};
