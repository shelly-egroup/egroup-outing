import type { ChoiceGroup } from "./trips";

export const footBathGroup: ChoiceGroup = {
  label: "足湯の底四選一",
  selectionMode: "individual",
  order: 1,
  choices: {
    rejuvenate: { label: "返老還童", subtitle: "年長虛弱者", ingredients: "玄參、青皮、艾葉、薑黃、白芷、五加皮、黃芩", description: "延緩老化、活絡氣血、安心定神、改善睡眠品質、肩緊痠痛", price: "", order: 0 },
    beauty: { label: "貴妃美人", subtitle: "女性愛美者", ingredients: "丹參、紅花、川芎、澤蘭、益母草、女貞子、黃芩", description: "美容養顏、美白淨化、預防水腫、靜脈曲張、手腳冰冷、補血活血", price: "", order: 1 },
    energy: { label: "元氣十足", subtitle: "上班壓力者", ingredients: "丹參、桂枝、五爪金英、茯苓、桑葉、伸筋草、黃芩", description: "提神醒腦、紓解眼睛疲勞、肩頸僵硬、緩解壓力、疏通筋脈", price: "", order: 2 },
    flowers: { label: "捻花惹草", subtitle: "喜愛花草者", ingredients: "薰衣草、迷迭香、蒲公英、紫菊花、香茅、黃芩", description: "失眠焦慮、腰痠背痛、活絡氣血、提神醒腦、消除疲勞、舒夢好眠", price: "", order: 3 },
  },
};
