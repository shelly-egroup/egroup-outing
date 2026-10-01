import ImageLightbox, { type MenuPage } from "./image-lightbox";

// Screenshots supplied for this outing show the restaurant's gallery, dish page,
// and Shilin weekday-lunch price card. Keep the price card intact for zooming.
const pages: readonly [MenuPage, ...MenuPage[]] = [
  {
    src: "/assets/villager-gallery.png",
    alt: "村民食堂官網相簿，包含港點、甜品、廚師料理與店內照片",
    title: "菜色與店內相簿",
  },
  {
    src: "/assets/villager-dish.png",
    alt: "村民食堂官網菜色頁的港式蘿蔔糕照片",
    title: "官網菜色照片",
  },
  {
    src: "/assets/villager-weekday-lunch-pricing.png",
    alt: "士林官邸店官網價目圖：平日午餐 11:00 至 14:00，720 元另加一成服務費，供餐至 13:45，用餐 2 小時",
    title: "士林平日午餐資訊",
  },
];

export default function VillagerBook() {
  return <div className="villager-book">
    <ImageLightbox pages={pages} bookLabel="村民食堂菜色與平日午餐圖冊" heading="村民食堂 · 菜色與午餐" pageLabel="圖頁" />
  </div>;
}
