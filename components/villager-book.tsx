import ImageLightbox, { type MenuPage } from "./image-lightbox";

// Photos supplied for this outing show the restaurant, signature dishes, and menu.
const pages: readonly [MenuPage, ...MenuPage[]] = [
  {
    src: "/assets/good-food-menu.webp",
    alt: "好食在食堂菜單與單點價格",
    title: "店內菜單",
  },
  {
    src: "/assets/good-food-sashimi.webp",
    alt: "好食在食堂綜合生魚片拼盤",
    title: "綜合生魚片",
  },
  {
    src: "/assets/good-food-chicken.webp",
    alt: "好食在食堂白斬雞拼盤",
    title: "招牌白斬雞",
  },
  {
    src: "/assets/good-food-storefront.webp",
    alt: "好食在食堂基隆路店面入口",
    title: "店面外觀",
  },
];

export default function VillagerBook() {
  return <div className="villager-book">
    <ImageLightbox pages={pages} bookLabel="好食在食堂菜色與菜單圖冊" heading="好食在食堂 · 菜色與菜單" pageLabel="圖頁" />
  </div>;
}
