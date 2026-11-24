export type Card = {
  id: string; name: string; set: string; grade: string; grader: string; cert: string;
  value: number; hue: [string, string]; glyph: "bolt" | "moon" | "wave" | "ball" | "star" | "flame";
  digital?: boolean;
};

export const cards: Card[] = [
  { id: "1", name: "charizard holo", set: "base set 1999", grade: "9", grader: "psa", cert: "48213907", value: 4200, hue: ["#F6A15B", "#E2487F"], glyph: "flame" },
  { id: "2", name: "umbreon vmax alt art", set: "evolving skies", grade: "10", grader: "psa", cert: "71930244", value: 1650, hue: ["#2B1A22", "#6B4BA8"], glyph: "moon" },
  { id: "3", name: "monkey.d.luffy leader", set: "romance dawn op-01", grade: "10", grader: "bgs", cert: "00921837", value: 310, hue: ["#E2487F", "#F7D26A"], glyph: "star" },
  { id: "4", name: "wembanyama prizm rc", set: "2023 panini prizm", grade: "10", grader: "psa", cert: "88120476", value: 890, hue: ["#3D7BD9", "#9AD3E8"], glyph: "ball" },
  { id: "5", name: "pikachu illustrator promo", set: "corocoro 1998", grade: "7", grader: "psa", cert: "10293847", value: 9800, hue: ["#F7D26A", "#F6A15B"], glyph: "bolt" },
  { id: "6", name: "blue-eyes white dragon", set: "lob 1st edition", grade: "8", grader: "psa", cert: "56473829", value: 2100, hue: ["#9AD3E8", "#F4C3D3"], glyph: "wave" },
  { id: "7", name: "black lotus", set: "unlimited", grade: "6", grader: "bgs", cert: "33219874", value: 7400, hue: ["#2B1A22", "#C2336A"], glyph: "star" },
  { id: "8", name: "lugia neo genesis", set: "neo genesis 1st ed", grade: "9", grader: "cgc", cert: "41029384", value: 1280, hue: ["#C9D6F2", "#F4C3D3"], glyph: "wave", digital: true },
];

export const fmt = (n: number) => "$" + n.toLocaleString("en-US");
