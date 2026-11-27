const DEFAULT_DATA = {
  settings: {
    status: "open",
    orderWhatsapp: "201124349186",
    hotline: "17205",
    promoActive: true,
    promoText: "فطير طازج من الفرن يومياً • توصيل سريع لباب البيت"
  },
  categories: [
    { id: "meshaltet", ar: "فطير مشلتت", en: "Meshaltet", fr: "Meshaltet" },
    { id: "savory", ar: "فطير حادق", en: "Savory Feteer", fr: "Feteer Sale" },
    { id: "sweet", ar: "فطير حلو", en: "Sweet Feteer", fr: "Feteer Sucre" },
    { id: "roka", ar: "الحاجة روقة", en: "Haga Roka", fr: "Haga Roka" }
  ],
  items: [
    { id: "m1", cat: "meshaltet", ar: "فطير مشلتت سمن بلدي", en: "Baladi Ghee Meshaltet", fr: "Meshaltet Beurre", descAr: "مورق بسمن بلدي صافي", descEn: "Layered with pure baladi ghee", p1: 140, p2: 210, img: "meshaltet.jpg", available: true },
    { id: "s1", cat: "savory", ar: "فطير سجق شرقي", en: "Oriental Sausage Feteer", fr: "Feteer Saucisse", descAr: "سجق بلدي متبل مع ميكس أجبان وفلفل", descEn: "Spiced sausage with cheese mix and peppers", p1: 165, p2: 235, img: "savory_feteer.jpg", available: true },
    { id: "sw1", cat: "sweet", ar: "فطير كاسترد ومكسرات", en: "Custard & Nuts Feteer", fr: "Feteer Creme et Noix", descAr: "كاسترد ناعم مع جوز هند وزبيب ومكسرات", descEn: "Smooth custard with coconut, raisins and nuts", p1: 150, p2: 215, img: "sweet_feteer.jpg", available: true },
    { id: "r1", cat: "roka", ar: "رقاق باللحمة المفرومة", en: "Minced Meat Roka", fr: "Roka Viande Hachee", descAr: "طبقات رقاق مقرمشة بحشوة لحمة مفرومة", descEn: "Crispy layers with seasoned minced meat", p1: 175, p2: 245, img: "haga_roka.jpg", available: true }
  ],
  zones: [
    { id: "z1", ar: "دار السلام", en: "Dar El Salam", fee: 20 },
    { id: "z2", ar: "المعادي", en: "Maadi", fee: 30 },
    { id: "z3", ar: "مدينة نصر", en: "Nasr City", fee: 45 }
  ],
  orders: []
};
