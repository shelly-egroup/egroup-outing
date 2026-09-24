export type StoreReviewSnapshot = {
  storeName: string;
  rating: number;
  reviewCount: number;
  capturedAt: string;
  sourceUrl: string;
  reviews: {
    author: string;
    authorUrl: string;
    rating: number;
    relativeTimeAtCapture: string;
    text: string;
    translated?: boolean;
    excerpt?: boolean;
  }[];
};

// Public Google review panel, sorted by 最新; captured in the in-app browser.
// This is a dated snapshot, not a live feed. Preserve source order and ratings.
export const massageReviews: StoreReviewSnapshot = {
  "storeName": "不老松足湯新生行館",
  "rating": 4.7,
  "reviewCount": 13297,
  "capturedAt": "2026-09-24T07:25:59.469Z",
  "sourceUrl": "https://www.google.com/search?q=不老松新生#lrd=0x3442a95d663d922f:0x8ff9103cdbe86393,1,,,,",
  "reviews": [
    {
      "author": "Justin Mendonca",
      "authorUrl": "https://www.google.com/maps/contrib/109967605932861454500/reviews?hl=zh-Hant-TW",
      "rating": 5,
      "relativeTimeAtCapture": "15 小時前",
      "text": "這是我做過的最好的足底按摩。 110號按摩師真是太棒了。",
      "translated": true
    },
    {
      "author": "Nidhi Kalaiya",
      "authorUrl": "https://www.google.com/maps/contrib/106031938448774667475/reviews?hl=zh-Hant-TW",
      "rating": 5,
      "relativeTimeAtCapture": "15 小時前",
      "text": "非常棒的體驗！特別感謝工作人員，他們專業又熱情，讓我感覺很愉快——尤其要感謝112號工作人員，她做的足部護理技術精湛。我已經迫不及待想再光顧了！",
      "translated": true
    },
    {
      "author": "蘅",
      "authorUrl": "https://www.google.com/maps/contrib/106850072980998214138/reviews?hl=zh-Hant-TW",
      "rating": 5,
      "relativeTimeAtCapture": "18 小時前",
      "text": "139號技術高超，力度控制剛好，按到很少人找到的舊患，地方環境非常好！推薦！"
    },
    {
      "author": "曾柔諭",
      "authorUrl": "https://www.google.com/maps/contrib/110909719952443606021/reviews?hl=zh-Hant-TW",
      "rating": 4,
      "relativeTimeAtCapture": "18 小時前",
      "text": "環境舒服👍"
    },
    {
      "author": "Joan",
      "authorUrl": "https://www.google.com/maps/contrib/110499077127686982082/reviews?hl=zh-Hant-TW",
      "rating": 5,
      "relativeTimeAtCapture": "18 小時前",
      "text": "舒適的環境\n來放鬆真的可以緩解身體緊繃☺️☺️\n師傅的手法很老道很讚😎\n龜苓膏滿好吃的😁😁"
    }
  ]
};
