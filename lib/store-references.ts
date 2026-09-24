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
  { id: "le-cafe", name: "Le Café・台北老爺酒店", labels: ["Le Café・台北老爺酒店", "Le Café", "Le Café 咖啡廳"], mapsQuery: "台北老爺酒店 Le Café", website: "https://www.royal-taipei.com.tw/dining-detail/E3/" },
  { id: "brasserie", name: "栢麗廳・台北晶華酒店", labels: ["栢麗廳・台北晶華酒店", "栢麗廳"], mapsQuery: "台北晶華酒店 栢麗廳", website: "https://www.regenttaiwan.com/dining/brasserie" },
  { id: "kitchen12", name: "十二廚・台北喜來登", labels: ["十二廚・台北喜來登", "十二廚"], mapsQuery: "台北喜來登 十二廚", website: "https://www.sheratongrandtaipei.com/websev?cat=2&id=15&lang=zh-tw&ref=pages" },
];

const normalizedLabel = (label: string) => label.normalize("NFKC").replace(/[\s・·]/g, "").toLowerCase();
export function choiceStore(label: string): StoreInfo | undefined {
  return restaurantStores.find(store => store.labels.some(name => normalizedLabel(name) === normalizedLabel(label)));
}

export const massageStore: StoreInfo = {
  id: "youngsong-xinsheng",
  name: "不老松足湯・台北新生行館",
  mapsQuery: "不老松足湯台北新生行館 新生北路二段70號",
  facebook: "https://www.facebook.com/youngsongshu3",
  line: "https://page.line.me/wop0224t",
};
