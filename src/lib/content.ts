// Static game content for the 7-day adventure (Turkish -> English).

export interface SceneContent {
  day: number;
  title: string;
  emoji: string;
  short: string;
  location: string;
  description: string;
  xpReward: number;
  mission: string;
  npcName: string;
  npcRole: string;
  npcEmoji: string;
  // secondary character for multi-character scenes (sevgili + garson gibi)
  secondaryNpc?: { name: string; role: string; emoji: string };
  // dialog screen sequence — her adımda farklı konuşmacı olabilir (sahneye göre kişilik)
  dialog: {
    prompt: string;
    fallback?: string;
    options?: { text: string; isCorrect: boolean }[];
    xp: number;
    chips?: string[];
    vocab?: string[];
    line?: string; // full example answer shown
    task?: string;
    speaker?: string; // per-step override: "primary" | "secondary" | npcName
    speakerRole?: string;
    speakerEmoji?: string;
  }[];
  vocabulary: {
    word: string;
    pronunciation: string;
    translation: string;
    emoji: string;
    visual: string;
    story: string;
    example: string;
  }[];
  map?: {
    prompt: string;
    target: string;
    options: { id: string; label: string; emoji: string; isCorrect: boolean }[];
  };
  badge?: string;
}

export const DAYS: SceneContent[] = [
  // ============================ DAY 1 — AIRPORT ============================
  {
    day: 1,
    title: "Havaalanı",
    emoji: "✈️",
    short: "Londra'ya uçuşunu bul ve hazır ol.",
    location: "Heathrow Airport",
    description:
      "Havaalanına gel. Biniş kartını al, pasaport kontrolünden geç ve doğru kapıyı bul.",
    xpReward: 100,
    mission: "Pasaport kontrolünden geç ve London uçağını bul.",
    npcName: "Officer Sarah",
    npcRole: "Havaalanı Görevlisi",
    npcEmoji: "🛃",
    dialog: [
      {
        task: "Görev: Pasaport kontrolünden geç.",
        prompt: "Hello! Welcome to the airport. Where are you going?",
        line: "I'm going to London.",
        fallback: "I'm going to London.",
        xp: 20,
        vocab: ["I'm going to", "London", "reservation"],
        chips: ["I'm going to", "London", "please"],
      },
      {
        task: "Görev: Biniş kartını iste.",
        prompt: "Can I see your passport and ticket, please?",
        line: "Here is my passport and ticket.",
        fallback: "Here is my passport and ticket.",
        xp: 20,
        vocab: ["passport", "ticket"],
        chips: ["Here is", "my passport", "ticket"],
      },
      {
        task: "Görev: Gate 12'yi sor.",
        prompt: "Have a nice flight! Where is your gate?",
        line: "Where is gate 12?",
        fallback: "Where is gate 12?",
        xp: 20,
        chips: ["Where", "is", "gate 12"],
      },
      {
        task: "Görev: Son güvenlik kontrolü.",
        prompt: "Do you have any luggage for the flight?",
        options: [
          { text: "Yes, I have one luggage.", isCorrect: true },
          { text: "No, I want pizza.", isCorrect: false },
          { text: "Where is the bill?", isCorrect: false },
        ],
        xp: 20,
        fallback: "Yes, I have one luggage.",
        chips: ["Yes", "I have", "one luggage"],
      },
    ],
    vocabulary: [
      { word: "Airport", pronunciation: "/ˈer.pɔːrt/", translation: "havaalanı", emoji: "✈️", visual: "✈️ 🛬 🛫", story: "Uçağın kalktığı yer. A dan Airport'a, hep uçakları düşün.", example: "The airport is big." },
      { word: "Passport", pronunciation: "/ˈpæs.pɔːrt/", translation: "pasaport", emoji: "🛂", visual: "🛂 📒 ✈️", story: "Sınırı geçmek için mühürlü küçük kitapçık.", example: "My passport is on the desk." },
      { word: "Ticket", pronunciation: "/ˈtɪk.ɪt/", translation: "bilet", emoji: "🎫", visual: "🎫 🧾 🗺️", story: "Uçağa binmek için elindeki kağıt.", example: "I have a ticket to London." },
      { word: "Gate", pronunciation: "/ɡeɪt/", translation: "kapı (uçuş)", emoji: "🛫", visual: "🛫 🚪 ✈️", story: "Uçağa giden kapı numarası.", example: "Gate 12 is on your right." },
      { word: "London", pronunciation: "/ˈlʌn.dən/", translation: "Londra", emoji: "🇬🇧", visual: "🏰 🎡 🌧️", story: "Big Ben ve kırmızı otobüslerin şehri.", example: "I'm going to London." },
      { word: "Flight", pronunciation: "/flaɪt/", translation: "uçuş", emoji: "🛫", visual: "🛫 ☁️ 🌥️", story: "Gökyüzünde süzülen uçak yolculuğu.", example: "My flight is at five." },
    ],
    badge: "✈️ Yol Bulucu",
  },

  // ============================ DAY 2 — HOTEL ============================
  {
    day: 2,
    title: "Otel",
    emoji: "🏨",
    short: "Check-in yap ve odaya yerleş.",
    location: "London Hotel",
    description: "Otele gir, rezervasyonunu bildir ve odanın anahtarını al.",
    xpReward: 100,
    mission: "Resepsiyonda check-in yap.",
    npcName: "Receptionist Tom",
    npcRole: "Otel Çalışanı",
    npcEmoji: "🛎️",
    dialog: [
      {
        task: "Görev: Otel girişinde rezervasyonunu söyle.",
        prompt: "Welcome to our hotel! Do you have a reservation?",
        line: "Yes, I have a reservation.",
        fallback: "Yes, I have a reservation.",
        xp: 20,
        chips: ["Yes", "I have a", "reservation"],
      },
      {
        task: "Görev: Anahtarını iste.",
        prompt: "Perfect, your room is 204. Here's your key.",
        line: "Thank you. Can I have the key, please?",
        fallback: "Thank you. Can I have the key, please?",
        xp: 20,
        chips: ["Thank you", "the key", "please"],
      },
      {
        task: "Görev: Kaç gece kalacağını söyle.",
        prompt: "How many nights would you like to stay?",
        options: [
          { text: "I will stay for two nights.", isCorrect: true },
          { text: "I want a pizza tonight.", isCorrect: false },
          { text: "Where is gate 12?", isCorrect: false },
        ],
        xp: 20,
        fallback: "I will stay for two nights.",
        chips: ["I will stay", "two nights", "hotel"],
      },
    ],
    vocabulary: [
      { word: "Hotel", pronunciation: "/hoʊˈtel/", translation: "otel", emoji: "🏨", visual: "🏨 🛎️ 🛏️", story: "Yatak ve duşun olduğu konaklama yeri.", example: "The hotel is near the station." },
      { word: "Reservation", pronunciation: "/ˌrez.ərˈveɪ.ʃən/", translation: "rezervasyon", emoji: "📅", visual: "📅 ✅ 🏨", story: "Önceden ayırttığın oda ya da masa.", example: "I have a reservation." },
      { word: "Room", pronunciation: "/ruːm/", translation: "oda", emoji: "🛏️", visual: "🛏️ 🚪 🛁", story: "Otelde uyuduğun yer.", example: "Room 204 is ready." },
      { word: "Key", pronunciation: "/kiː/", translation: "anahtar", emoji: "🔑", visual: "🔑 🚪 🧳", story: "Kapıyı açan metal parça.", example: "Here is your key." },
      { word: "Check-in", pronunciation: "/ˈtʃek ˌɪn/", translation: "giriş yapmak", emoji: "🛎️", visual: "🛎️ ✅ 🏨", story: "Otele varınca kayıt yaptırma.", example: "I want to check in." },
    ],
    badge: "🏨 Otel Ustası",
  },

  // ============================ DAY 3 — RESTAURANT ============================
  {
    day: 3,
    title: "Restoran",
    emoji: "🍽️",
    short: "Menü iste, yemek sipariş et.",
    location: "London Restaurant",
    description: "Restoranda otur, menüyü iste ve sevdiğin yemeği söyle.",
    xpReward: 100,
    mission: "Garsona yemek siparişi ver.",
    npcName: "Waiter Marco",
    npcRole: "Garson",
    npcEmoji: "👨‍🍳",
    dialog: [
      {
        task: "Görev: Menüyü iste.",
        prompt: "Good evening! Would you like to see the menu?",
        line: "Yes, can I see the menu, please?",
        fallback: "Yes, can I see the menu, please?",
        xp: 20,
        chips: ["Yes", "the menu", "please"],
      },
      {
        task: "Görev: Yemek sipariş et.",
        prompt: "What would you like to order?",
        line: "I want a pizza, please.",
        fallback: "I want a pizza, please.",
        xp: 20,
        vocab: ["I want a", "pizza", "please"],
        chips: ["I want a", "pizza", "please"],
      },
      {
        task: "Görev: İçecek iste.",
        prompt: "And anything to drink?",
        line: "Yes, a glass of water, please.",
        fallback: "Yes, a glass of water, please.",
        xp: 20,
        chips: ["a glass", "of water", "please"],
      },
      {
        task: "Görev: Hesabı iste.",
        prompt: "Great choice! Anything else?",
        options: [
          { text: "No, can I have the bill, please?", isCorrect: true },
          { text: "Yes, where is the airport?", isCorrect: false },
          { text: "I have a reservation.", isCorrect: false },
        ],
        xp: 20,
        fallback: "No, can I have the bill, please?",
        chips: ["No", "the bill", "please"],
      },
    ],
    vocabulary: [
      { word: "Menu", pronunciation: "/ˈmen.juː/", translation: "menü", emoji: "📋", visual: "📋 🍽️ 🥘", story: "Yemeklerin listelendiği kart.", example: "Can I see the menu?" },
      { word: "Pizza", pronunciation: "/ˈpiːt.sə/", translation: "pizza", emoji: "🍕", visual: "🍕 🧀 🍅", story: "Peynirli, domatesli sıcak hamur.", example: "I want a pizza." },
      { word: "Water", pronunciation: "/ˈwɔː.tər/", translation: "su", emoji: "💧", visual: "💧 🥤 🦆", story: "Her zaman lazım olan içecek.", example: "A glass of water, please." },
      { word: "Order", pronunciation: "/ˈɔːr.dər/", translation: "sipariş", emoji: "🧾", visual: "🧾 🍽️ 🛎️", story: "Garsona ne istediğini söyleme.", example: "I want to order." },
      { word: "Bill", pronunciation: "/bɪl/", translation: "hesap", emoji: "🧾", visual: "🧾 💷 🍽️", story: "Yemeğin sonunda gelen ücret kağıdı.", example: "Can I have the bill?" },
    ],
    badge: "🍽️ Restoran Ustası",
  },

  // ============================ DAY 4 — SHOPPING ============================
  {
    day: 4,
    title: "Alışveriş",
    emoji: "🛍️",
    short: "Mağaza bul, ürün sor, satın al.",
    location: "Shopping Street",
    description: "Bir mağaza bul, fiyat sor ve ürünü satın al.",
    xpReward: 100,
    mission: "Kıyafet mağazasını bul ve bir şey satın al.",
    npcName: "Shop Assistant Emma",
    npcRole: "Mağaza Çalışanı",
    npcEmoji: "🧑‍💼",
    dialog: [
      {
        task: "Görev: Mağazayı bul. (Haritadan seç)",
        prompt: "Excuse me, where is the nearest clothing store?",
        fallback: "Where is the nearest clothing store?",
        xp: 20,
        chips: ["nearest", "clothing store", "near"],
        line: "Where is the nearest clothing store?",
      },
      {
        task: "Görev: Yardım iste.",
        prompt: "Hello! Can I help you?",
        line: "Yes, I want this shirt. How much is it?",
        fallback: "Yes, I want this shirt.",
        xp: 20,
        chips: ["I want", "this shirt", "please"],
      },
      {
        task: "Görev: Fiyatı sor ve satın al.",
        prompt: "It's 20 pounds. Would you like to take it?",
        options: [
          { text: "Yes, I want this.", isCorrect: true },
          { text: "No, I want a pizza.", isCorrect: false },
          { text: "Here is my passport.", isCorrect: false },
        ],
        xp: 20,
        fallback: "Yes, I want this.",
        chips: ["Yes", "I want this", "bought"],
      },
    ],
    vocabulary: [
      { word: "Shop", pronunciation: "/ʃɑːp/", translation: "mağaza/dükkan", emoji: "🏪", visual: "🏪 🛍️ 🛒", story: "Bir şeyler satın aldığın yer.", example: "The shop is open." },
      { word: "Money", pronunciation: "/ˈmʌn.i/", translation: "para", emoji: "💷", visual: "💷 💳 💰", story: "Bir şey almak için gerekli olan.", example: "I need money." },
      { word: "Clothes", pronunciation: "/kloʊðz/", translation: "giysiler/kıyafet", emoji: "👕", visual: "👕 👖 👗", story: "Üzerinde taşıdığın kıyafetler.", example: "I like these clothes." },
      { word: "Buy", pronunciation: "/baɪ/", translation: "satın almak", emoji: "🛒", visual: "🛒 💷 🧾", story: "Parayı verip bir şeyi almak.", example: "I want to buy this." },
    ],
    map: {
      prompt: "Where is the nearest clothing store?",
      target: "The clothing store is on the left, next to the cafe.",
      options: [
        { id: "left", label: "Left, next to the cafe", emoji: "👕", isCorrect: true },
        { id: "right", label: "Right, near the airport", emoji: "🚕", isCorrect: false },
        { id: "straight", label: "Straight, far away", emoji: "🏛️", isCorrect: false },
      ],
    },
    badge: "🛍️ Alışveriş Tutkunu",
  },

  // ============================ DAY 5 — CITY ============================
  {
    day: 5,
    title: "Şehir",
    emoji: "🌆",
    short: "Yol sor ve yön tariflerini öğren.",
    location: "London City",
    description: "Şehirde yolunu bulmak için yön sor ve tarifleri takip et.",
    xpReward: 100,
    mission: "İstasyona giden yolu sor.",
    npcName: "Traveller Ben",
    npcRole: "Taksi Şoförü",
    npcEmoji: "🚕",
    dialog: [
      {
        task: "Görev: İstasyona yolu sor.",
        prompt: "Excuse me, where is the station?",
        line: "Go straight, then turn left.",
        fallback: "Where is the station?",
        xp: 20,
        chips: ["straight", "turn left", "station"],
      },
      {
        task: "Görev: Yön tarifini uygula.",
        prompt: "Is it near the hotel?",
        line: "Yes, it's near the hotel.",
        fallback: "Yes, it's near the hotel.",
        xp: 20,
        chips: ["near", "the hotel", "yes"],
      },
      {
        task: "Görev: Taksi tarifini sor.",
        prompt: "Sir, can I take you somewhere?",
        options: [
          { text: "Yes, to the city center, please.", isCorrect: true },
          { text: "No, I want a bill, please.", isCorrect: false },
          { text: "Here is my password.", isCorrect: false },
        ],
        xp: 20,
        fallback: "Yes, to the city center, please.",
        chips: ["city center", "please", "taxi"],
      },
    ],
    vocabulary: [
      { word: "Station", pronunciation: "/ˈsteɪ.ʃən/", translation: "istasyon", emoji: "🚉", visual: "🚉 🚇 🚆", story: "Tren veya metroya binilen yer.", example: "Where is the station?" },
      { word: "Straight", pronunciation: "/streɪt/", translation: "düz/dosdoğru", emoji: "➡️", visual: "➡️ 🛣️ 🗺️", story: "Hep ileri git, sağa sola sapma.", example: "Go straight ahead." },
      { word: "Left", pronunciation: "/left/", translation: "sol", emoji: "⬅️", visual: "⬅️ ↰ 🚶", story: "Kalbine yakın olan taraf.", example: "Turn left here." },
      { word: "Right", pronunciation: "/raɪt/", translation: "sağ", emoji: "➡️", visual: "➡️ ↳ 🚶", story: "Yazı yazan elinin olduğu taraf.", example: "It's on your right." },
      { word: "Near", pronunciation: "/nɪr/", translation: "yakın", emoji: "📍", visual: "📍 🏨 🚶", story: "Çok uzakta olmayan, yürüme mesafesinde.", example: "It's near the hotel." },
    ],
    badge: "🧭 Yol Bulucu",
  },

  // ============================ DAY 6 — SOCIAL LIFE ============================
  {
    day: 6,
    title: "Sosyal Hayat",
    emoji: "👥",
    short: "Yeni insanlarla tanış ve kendini tanıt.",
    location: "Social Area",
    description: "Yeni biriyle tanış, kendini ve hobilerini anlat.",
    xpReward: 100,
    mission: "Kendini tanıt ve nereli olduğunu söyle.",
    npcName: "New Friend Mia",
    npcRole: "Turist / Yeni Arkadaş",
    npcEmoji: "🧑‍🤝‍🧑",
    dialog: [
      {
        task: "Görev: Kendini tanıt.",
        prompt: "Hi! I'm Mia. It's nice to meet you. Where are you from?",
        line: "Hello Mia, I'm from Turkey. Nice to meet you.",
        fallback: "I'm from Turkey.",
        xp: 20,
        chips: ["I'm from", "Turkey", "nice to meet you"],
      },
      {
        task: "Görev: Ne yaptığını söyle.",
        prompt: "Nice! So, what do you like to do in your free time?",
        line: "I like music and traveling.",
        fallback: "I like music and traveling.",
        xp: 20,
        chips: ["I like", "music", "traveling"],
      },
      {
        task: "Görev: Hobinden bahset.",
        prompt: "That's cool! Do you like this city?",
        options: [
          { text: "Yes, I love this city.", isCorrect: true },
          { text: "No, my password is lost.", isCorrect: false },
          { text: "Where is gate 12?", isCorrect: false },
        ],
        xp: 20,
        fallback: "Yes, I love this city.",
        chips: ["Yes", "I love", "this city"],
      },
    ],
    vocabulary: [
      { word: "Friend", pronunciation: "/frend/", translation: "arkadaş", emoji: "🤝", visual: "🤝 😊 👋", story: "Birlikte eğlendiğin insan.", example: "Mia is my friend." },
      { word: "Country", pronunciation: "/ˈkʌn.tri/", translation: "ülke", emoji: "🌍", visual: "🌍 🇹🇷 🗺️", story: "Doğduğun veya yaşadığın yer.", example: "I'm from Turkey." },
      { word: "Music", pronunciation: "/ˈmjuː.zɪk/", translation: "müzik", emoji: "🎵", visual: "🎵 🎧 🎤", story: "Kulaklıkla dinlenen sesler.", example: "I like music." },
      { word: "Like", pronunciation: "/laɪk/", translation: "sevmek/hoşlanmak", emoji: "❤️", visual: "❤️ 😍 👍", story: "Bir şeyi sevdiğinde söylersin.", example: "I like this song." },
    ],
    badge: "❤️ Gönül İnsanı",
  },

  // ============================ DAY 7 — BIG ADVENTURE ============================
  {
    day: 7,
    title: "Büyük Macera",
    emoji: "🏆",
    short: "Tüm öğrendiklerini birleştir.",
    location: "London — Full City",
    description: "Londra'da tek başına bir gün. Havaalanından başla, oteli bul, ye, alışveriş yap, yol sor ve konuş!",
    xpReward: 500,
    mission: "Londra'da tek başına bir gün geçir.",
    npcName: "London Tourist Guide",
    npcRole: "Şehir Rehberi",
    npcEmoji: "🇬🇧",
    dialog: [
      {
        task: "Görev: Uçaktan inince otele nasıl gidersin?",
        prompt: "Welcome to London! How can I help you first?",
        line: "I'm going to the hotel, where is it? I have a reservation.",
        fallback: "I'm going to the hotel, I have a reservation.",
        xp: 30,
        chips: ["I'm going to the hotel", "reservation", "where"],
      },
      {
        task: "Görev: Restoranda ne sipariş edersin?",
        prompt: "Perfect! After that, you must be hungry. What would you like?",
        line: "I want a pizza and a glass of water, please.",
        fallback: "I want a pizza and a glass of water, please.",
        xp: 30,
        chips: ["I want", "a pizza", "water please"],
      },
      {
        task: "Görev: Alışverişe ne alacaksın?",
        prompt: "There's a great shop here. Do you want to buy any clothes?",
        line: "Yes, I want to buy this shirt. How much is it?",
        fallback: "Yes, I want to buy this shirt.",
        xp: 30,
        chips: ["I want", "to buy", "this shirt"],
      },
      {
        task: "Görev: Yeni arkadaşına kendini tanıt.",
        prompt: "Great choice! Oh, look — someone wants to talk to you.",
        line: "Hi, I'm from Turkey. I like music and traveling. Nice to meet you!",
        fallback: "I'm from Turkey. Nice to meet you.",
        xp: 30,
        chips: ["I'm from", "Turkey", "nice to meet you"],
      },
    ],
    vocabulary: [
      { word: "Adventure", pronunciation: "/ədˈven.tʃər/", translation: "macera", emoji: "🗺️", visual: "🗺️ 🎒 🏔️", story: "Yeni yerler görüp keşfetme heyecanı.", example: "London is an adventure." },
      { word: "Trip", pronunciation: "/trɪp/", translation: "gezi/seyahat", emoji: "🧳", visual: "🧳 🚆 🌄", story: "Gittiğin kısa veya uzun yolculuk.", example: "Have a nice trip!" },
      { word: "Speak", pronunciation: "/spiːk/", translation: "konuşmak", emoji: "💬", visual: "💬 🗣️ 😊", story: "Duygularını kelimelere dökmek.", example: "I can speak English." },
      { word: "Learn", pronunciation: "/lɝːn/", translation: "öğrenmek", emoji: "🧠", visual: "🧠 📚 💡", story: "Yeni bir şeyi bilmek ve hatırlamak.", example: "I want to learn English." },
      { word: "Talk", pronunciation: "/tɔːk/", translation: "konuşmak", emoji: "🎙️", visual: "🎙️ 👫 💬", story: "Biriyle sohbet etmek.", example: "Let's talk in English." },
      { word: "Live", pronunciation: "/lɪv/", translation: "yaşamak", emoji: "🌇", visual: "🌇 🏡 ❤️", story: "Bir yerde hayatını sürdürmek.", example: "I want to live in London." },
    ],
    badge: "🔥 7 Gün Serisi",
  },

  // ============================ DAY 8 — EV / ANNE ============================
  {
    day: 8,
    title: "Ev",
    emoji: "🏠",
    short: "Annene yardım et, evde İngilizce konuş.",
    location: "Home — Mutfak",
    description: "Evdesin, annen yemek hazırlıyor. Ona yardım et ve sohbet et.",
    xpReward: 120,
    mission: "Annene mutfakta yardım et ve İngilizce sohbet et.",
    npcName: "Anne Ayşe",
    npcRole: "Anne",
    npcEmoji: "👩‍🍳",
    dialog: [
      {
        task: "Görev: Annene selam ver.",
        prompt: "Good morning dear! Did you sleep well?",
        line: "Good morning mom, I slept very well.",
        fallback: "Good morning mom, I slept very well.",
        xp: 20,
        chips: ["Good morning", "mom", "slept well"],
        speaker: "Anne Ayşe",
        speakerRole: "Anne",
        speakerEmoji: "👩‍🍳",
      },
      {
        task: "Görev: Kahvaltıda yardım iste.",
        prompt: "Can you help me with breakfast, sweetie?",
        line: "Yes mom, I can help you.",
        fallback: "Yes mom, I can help you.",
        xp: 20,
        chips: ["help", "breakfast", "mom"],
        speaker: "Anne Ayşe",
        speakerRole: "Anne",
        speakerEmoji: "👩‍🍳",
      },
      {
        task: "Görev: Annenin yemeğini öv.",
        prompt: "How is the soup, honey?",
        options: [
          { text: "It's delicious, mom. Thank you!", isCorrect: true },
          { text: "Where is my passport?", isCorrect: false },
          { text: "I want a pizza.", isCorrect: false },
        ],
        xp: 20,
        fallback: "It's delicious, mom. Thank you!",
        chips: ["delicious", "thank you", "mom"],
        speaker: "Anne Ayşe",
        speakerRole: "Anne",
        speakerEmoji: "👩‍🍳",
      },
    ],
    vocabulary: [
      { word: "Mother", pronunciation: "/ˈmʌð.ər/", translation: "anne", emoji: "👩", visual: "👩 ❤️ 🏠", story: "Evde sana en çok yardım eden kişi.", example: "My mother is cooking." },
      { word: "Help", pronunciation: "/help/", translation: "yardım etmek", emoji: "🤲", visual: "🤲 🧹 🍳", story: "Birine el uzatmak.", example: "Can I help you, mom?" },
      { word: "Delicious", pronunciation: "/dɪˈlɪʃ.əs/", translation: "lezzetli", emoji: "😋", visual: "😋 🍲 👩‍🍳", story: "Yemeğin tadı harika.", example: "It's delicious!" },
      { word: "Morning", pronunciation: "/ˈmɔː.nɪŋ/", translation: "sabah", emoji: "🌅", visual: "🌅 ☀️ 🛏️", story: "Günün ilk saatleri.", example: "Good morning!" },
    ],
    badge: "🏠 Evin Yıldızı",
  },

  // ============================ DAY 9 — İŞ YERİ / PATRON + İŞ ARKADAŞI ============================
  {
    day: 9,
    title: "İş Yeri",
    emoji: "💼",
    short: "Patron ve iş arkadaşınla İngilizce konuş.",
    location: "Office — London",
    description: "Ofistesin. Patronun görev veriyor, iş arkadaşın yardım ediyor.",
    xpReward: 150,
    mission: "Patronunla toplantı yap, iş arkadaşınla konuş.",
    npcName: "Mr. Smith",
    npcRole: "Patron",
    npcEmoji: "👔",
    secondaryNpc: { name: "Lena", role: "İş Arkadaşı", emoji: "👩‍💼" },
    dialog: [
      {
        task: "Görev: Patrona selam ver.",
        prompt: "Good morning! Are you ready for the meeting?",
        line: "Good morning Mr. Smith, I'm ready.",
        fallback: "Good morning Mr. Smith, I'm ready.",
        xp: 20,
        chips: ["Good morning", "ready", "meeting"],
        speaker: "Mr. Smith",
        speakerRole: "Patron",
        speakerEmoji: "👔",
      },
      {
        task: "Görev: İş arkadaşından yardım iste.",
        prompt: "Hey! Do you need help with the report?",
        line: "Yes, can you help me with the report?",
        fallback: "Yes, can you help me with the report?",
        xp: 20,
        chips: ["help", "report", "please"],
        speaker: "Lena",
        speakerRole: "İş Arkadaşı",
        speakerEmoji: "👩‍💼",
      },
      {
        task: "Görev: Patronun görevini onayla.",
        prompt: "Please finish the presentation by 3 pm.",
        options: [
          { text: "Of course, I will finish it by 3 pm.", isCorrect: true },
          { text: "I want a pizza, please.", isCorrect: false },
          { text: "Where is the airport?", isCorrect: false },
        ],
        xp: 20,
        fallback: "Of course, I will finish it by 3 pm.",
        chips: ["finish", "presentation", "by 3 pm"],
        speaker: "Mr. Smith",
        speakerRole: "Patron",
        speakerEmoji: "👔",
      },
    ],
    vocabulary: [
      { word: "Boss", pronunciation: "/bɒs/", translation: "patron", emoji: "👔", visual: "👔 💼 📊", story: "İş yerinde sana görev veren kişi.", example: "My boss is Mr. Smith." },
      { word: "Meeting", pronunciation: "/ˈmiː.tɪŋ/", translation: "toplantı", emoji: "📅", visual: "📅 👔 🗣️", story: "İş yerinde konuşulan buluşma.", example: "We have a meeting at 10." },
      { word: "Report", pronunciation: "/rɪˈpɔːrt/", translation: "rapor", emoji: "📄", visual: "📄 ✍️ 💼", story: "Yazılı görev belgesi.", example: "I finished the report." },
      { word: "Colleague", pronunciation: "/ˈkɒl.iːɡ/", translation: "iş arkadaşı", emoji: "👥", visual: "👥 💼 🤝", story: "Aynı yerde çalıştığın kişi.", example: "Lena is my colleague." },
    ],
    badge: "💼 Ofis Yıldızı",
  },

  // ============================ DAY 10 — RANDEVU / SEVGİLİ + GARSON ============================
  {
    day: 10,
    title: "Randevu",
    emoji: "❤️",
    short: "Sevgilinle restoranda garsonla konuş.",
    location: "Romantic Restaurant",
    description: "Sevgilinle romantik akşam yemeğindesin. Garson sipariş alıyor.",
    xpReward: 180,
    mission: "Sevgilin ve garsonla romantik akşam yemeği.",
    npcName: "Elif",
    npcRole: "Sevgili",
    npcEmoji: "💕",
    secondaryNpc: { name: "Waiter Marco", role: "Garson", emoji: "👨‍🍳" },
    dialog: [
      {
        task: "Görev: Sevgiline iltifat et.",
        prompt: "You look so beautiful tonight!",
        line: "You look very handsome tonight!",
        fallback: "You look very handsome tonight!",
        xp: 20,
        chips: ["beautiful", "handsome", "tonight"],
        speaker: "Elif",
        speakerRole: "Sevgili",
        speakerEmoji: "💕",
      },
      {
        task: "Görev: Garsona sipariş ver.",
        prompt: "Good evening! What would you like to order?",
        line: "We want two pizzas, please.",
        fallback: "We want two pizzas, please.",
        xp: 20,
        chips: ["two pizzas", "please", "order"],
        speaker: "Waiter Marco",
        speakerRole: "Garson",
        speakerEmoji: "👨‍🍳",
      },
      {
        task: "Görev: Garsona hesabı sevgilinle paylaş.",
        prompt: "Would you like to pay together or separate?",
        options: [
          { text: "Together, please. It's on me.", isCorrect: true },
          { text: "Where is my passport?", isCorrect: false },
          { text: "I want to go to the airport.", isCorrect: false },
        ],
        xp: 20,
        fallback: "Together, please.",
        chips: ["together", "pay", "please"],
        speaker: "Waiter Marco",
        speakerRole: "Garson",
        speakerEmoji: "👨‍🍳",
      },
      {
        task: "Görev: Sevgiline teşekkür et.",
        prompt: "Thank you for this lovely evening!",
        line: "Thank you too, I love this evening.",
        fallback: "Thank you too, I love this evening.",
        xp: 20,
        chips: ["thank you", "lovely", "evening"],
        speaker: "Elif",
        speakerRole: "Sevgili",
        speakerEmoji: "💕",
      },
    ],
    vocabulary: [
      { word: "Love", pronunciation: "/lʌv/", translation: "aşk/sevgi", emoji: "❤️", visual: "❤️ 💕 😍", story: "Kalpte hissettiğin en güzel duygu.", example: "I love you." },
      { word: "Beautiful", pronunciation: "/ˈbjuː.tɪ.fəl/", translation: "güzel", emoji: "✨", visual: "✨ 👩 💕", story: "Gözüne güzel gelen kişi.", example: "You look beautiful!" },
      { word: "Together", pronunciation: "/təˈɡeð.ər/", translation: "birlikte", emoji: "👫", visual: "👫 ❤️ 🍽️", story: "İki kişinin yan yana olması.", example: "Let's eat together." },
      { word: "Evening", pronunciation: "/ˈiːv.nɪŋ/", translation: "akşam", emoji: "🌆", visual: "🌆 🌙 🍷", story: "Güneş battıktan sonraki zaman.", example: "Good evening!" },
    ],
    badge: "❤️ Romantik",
  },

  // ============================ DAY 11 — HASTANE ============================
  {
    day: 11,
    title: "Hastane",
    emoji: "🏥",
    short: "Doktora şikayetini anlat, randevu al.",
    location: "City Hospital",
    description: "Hastanedesin. Resepsiyondan randevu al, doktorla konuş ve şikayetini anlat.",
    xpReward: 130,
    mission: "Doktora baş ağrını anlat ve ilaç iste.",
    npcName: "Dr. Miller",
    npcRole: "Doktor",
    npcEmoji: "👨‍⚕️",
    secondaryNpc: { name: "Nurse Lisa", role: "Hemşire", emoji: "👩‍⚕️" },
    dialog: [
      { task: "Görev: Resepsiyonda randevu al.", prompt: "Hello, how can I help you?", line: "I need an appointment with the doctor.", fallback: "I need an appointment with the doctor.", xp: 20, chips: ["appointment", "doctor", "need"], speaker: "Nurse Lisa", speakerRole: "Hemşire", speakerEmoji: "👩‍⚕️" },
      { task: "Görev: Doktoruna şikayetini söyle.", prompt: "What seems to be the problem?", line: "I have a headache and fever.", fallback: "I have a headache and fever.", xp: 20, chips: ["headache", "fever", "have"], speaker: "Dr. Miller", speakerRole: "Doktor", speakerEmoji: "👨‍⚕️" },
      { task: "Görev: İlacı nasıl alacağını sor.", prompt: "Take this medicine twice a day.", options: [{ text: "Thank you, doctor. How should I take it?", isCorrect: true }, { text: "Where is my passport?", isCorrect: false }, { text: "I want a pizza.", isCorrect: false }], xp: 20, fallback: "Thank you, doctor.", chips: ["thank you", "medicine", "doctor"], speaker: "Dr. Miller", speakerRole: "Doktor", speakerEmoji: "👨‍⚕️" },
    ],
    vocabulary: [
      { word: "Doctor", pronunciation: "/ˈdɒk.tər/", translation: "doktor", emoji: "👨‍⚕️", visual: "👨‍⚕️ 🏥 💊", story: "Hastanede seni muayene eden kişi.", example: "The doctor is kind." },
      { word: "Headache", pronunciation: "/ˈhed.eɪk/", translation: "baş ağrısı", emoji: "🤕", visual: "🤕 😣 💊", story: "Başında hissettiğin ağrı.", example: "I have a headache." },
      { word: "Medicine", pronunciation: "/ˈmed.ɪ.sən/", translation: "ilaç", emoji: "💊", visual: "💊 🥤 🏥", story: "İyileşmek için içtiğin şey.", example: "Take your medicine." },
      { word: "Appointment", pronunciation: "/əˈpɔɪnt.mənt/", translation: "randevu", emoji: "📅", visual: "📅 🏥 🕐", story: "Doktorla buluşma saati.", example: "I have an appointment." },
    ],
    badge: "🏥 Şifa",
  },

  // ============================ DAY 12 — BANKA ============================
  {
    day: 12,
    title: "Banka",
    emoji: "🏦",
    short: "Hesap aç, para bozdur, kart iste.",
    location: "City Bank",
    description: "Bankadasın. Gişeden hesap açtır, döviz bozdur ve kart başvurusu yap.",
    xpReward: 130,
    mission: "Banka görevlisine hesap açtırmak istediğini söyle.",
    npcName: "Mr. Brown",
    npcRole: "Banka Görevlisi",
    npcEmoji: "👨‍💼",
    dialog: [
      { task: "Görev: Hesap açmak istediğini söyle.", prompt: "Welcome to our bank. How can I help you?", line: "I want to open a bank account.", fallback: "I want to open a bank account.", xp: 20, chips: ["open", "bank account", "want"] },
      { task: "Görev: Kimliğini göster.", prompt: "Can I see your ID, please?", line: "Here is my ID.", fallback: "Here is my ID.", xp: 20, chips: ["here is", "my ID", "please"] },
      { task: "Görev: Döviz kuru sor.", prompt: "Would you like anything else?", options: [{ text: "What is the exchange rate today?", isCorrect: true }, { text: "Where is the hotel?", isCorrect: false }, { text: "I have a headache.", isCorrect: false }], xp: 20, fallback: "What is the exchange rate today?", chips: ["exchange rate", "today", "what"] },
    ],
    vocabulary: [
      { word: "Bank", pronunciation: "/bæŋk/", translation: "banka", emoji: "🏦", visual: "🏦 💰 💳", story: "Paranı koyduğun yer.", example: "I go to the bank." },
      { word: "Account", pronunciation: "/əˈkaʊnt/", translation: "hesap", emoji: "💳", visual: "💳 📄 🏦", story: "Bankada senin adınla açılan yer.", example: "Open an account." },
      { word: "Money", pronunciation: "/ˈmʌn.i/", translation: "para", emoji: "💷", visual: "💷 💳 🏦", story: "Bankada duran değer.", example: "I need money." },
      { word: "Exchange", pronunciation: "/ɪksˈtʃeɪndʒ/", translation: "döviz/bozdurmak", emoji: "💱", visual: "💱 💵 🔄", story: "Parayı başka paraya çevirmek.", example: "Exchange rate?" },
    ],
    badge: "🏦 Finans",
  },

  // ============================ DAY 13 — ÜNİVERSİTE ============================
  {
    day: 13,
    title: "Üniversite",
    emoji: "🎓",
    short: "Ders sor, ödev iste, kampüsü gez.",
    location: "London University",
    description: "Kampüstesin. Profesöre ders sor, kütüphaneyi bul ve ders programını al.",
    xpReward: 140,
    mission: "Profesöre ders hakkında soru sor.",
    npcName: "Prof. Johnson",
    npcRole: "Profesör",
    npcEmoji: "👨‍🏫",
    secondaryNpc: { name: "Student Amy", role: "Öğrenci", emoji: "👩‍🎓" },
    dialog: [
      { task: "Görev: Profesöre selam ver.", prompt: "Good morning, class. Any questions?", line: "Excuse me, I have a question about the lesson.", fallback: "I have a question about the lesson.", xp: 20, chips: ["question", "lesson", "excuse me"], speaker: "Prof. Johnson", speakerRole: "Profesör", speakerEmoji: "👨‍🏫" },
      { task: "Görev: Öğrenciye kütüphaneyi sor.", prompt: "Hey, do you know where the library is?", line: "Yes, the library is next to the main building.", fallback: "Where is the library?", xp: 20, chips: ["library", "next to", "building"], speaker: "Student Amy", speakerRole: "Öğrenci", speakerEmoji: "👩‍🎓" },
      { task: "Görev: Ders programını iste.", prompt: "The library closes at 6 pm.", options: [{ text: "Can I have the course schedule, please?", isCorrect: true }, { text: "I want a bank account.", isCorrect: false }, { text: "Where is my ticket?", isCorrect: false }], xp: 20, fallback: "Can I have the course schedule, please?", chips: ["course", "schedule", "please"], speaker: "Prof. Johnson", speakerRole: "Profesör", speakerEmoji: "👨‍🏫" },
    ],
    vocabulary: [
      { word: "University", pronunciation: "/ˌjuː.nɪˈvɜː.sə.ti/", translation: "üniversite", emoji: "🎓", visual: "🎓 🏛️ 📚", story: "Büyük okul, derslerin yapıldığı yer.", example: "I study at university." },
      { word: "Lesson", pronunciation: "/ˈles.ən/", translation: "ders", emoji: "📖", visual: "📖 👨‍🏫 ✍️", story: "Öğrendiğin konu.", example: "The lesson is interesting." },
      { word: "Library", pronunciation: "/ˈlaɪ.brer.i/", translation: "kütüphane", emoji: "📚", visual: "📚 🏛️ 🤫", story: "Kitapların sessiz evi.", example: "Where is the library?" },
      { word: "Question", pronunciation: "/ˈkwest.ʃən/", translation: "soru", emoji: "❓", visual: "❓ 🙋 👨‍🏫", story: "Bilmediğini sormak.", example: "I have a question." },
    ],
    badge: "🎓 Bilge",
  },

  // ============================ DAY 14 — SPOR SALONU ============================
  {
    day: 14,
    title: "Spor Salonu",
    emoji: "🏋️",
    short: "Antrenöre kayıt ol, program iste.",
    location: "Fitness Center",
    description: "Spor salonundasın. Antrenörle tanış, üyelik al ve programını sor.",
    xpReward: 120,
    mission: "Antrenöre üyelik ve program sor.",
    npcName: "Coach Alex",
    npcRole: "Antrenör",
    npcEmoji: "🏋️",
    dialog: [
      { task: "Görev: Üyelik iste.", prompt: "Welcome to our gym! Do you want to join?", line: "Yes, I want to become a member.", fallback: "I want to become a member.", xp: 20, chips: ["member", "want", "become"] },
      { task: "Görev: Programı sor.", prompt: "Great! How often do you want to train?", line: "Three times a week.", fallback: "Three times a week.", xp: 20, chips: ["three times", "a week", "train"] },
      { task: "Görev: Saatleri öğren.", prompt: "We are open from 6 am to 10 pm.", options: [{ text: "What are the opening hours?", isCorrect: false }, { text: "Thank you, see you tomorrow!", isCorrect: true }, { text: "Where is the bank?", isCorrect: false }], xp: 20, fallback: "Thank you, see you tomorrow!", chips: ["thank you", "see you", "tomorrow"] },
    ],
    vocabulary: [
      { word: "Gym", pronunciation: "/dʒɪm/", translation: "spor salonu", emoji: "🏋️", visual: "🏋️ 💪 🏃", story: "Kas yaptığın yer.", example: "I go to the gym." },
      { word: "Train", pronunciation: "/treɪn/", translation: "antrenman yapmak", emoji: "💪", visual: "💪 🏋️ 🔥", story: "Vücudunu çalıştırmak.", example: "I train every day." },
      { word: "Member", pronunciation: "/ˈmem.bər/", translation: "üye", emoji: "🎫", visual: "🎫 🏋️ ✅", story: "Salona kayıtlı kişi.", example: "I am a member." },
      { word: "Healthy", pronunciation: "/ˈhel.θi/", translation: "sağlıklı", emoji: "🥗", visual: "🥗 💚 🏃", story: "Vücudun iyi hali.", example: "Be healthy!" },
    ],
    badge: "💪 Güç",
  },

  // ============================ DAY 15 — PARK ============================
  {
    day: 15,
    title: "Park",
    emoji: "🌳",
    short: "Parkta tanış, havadan konuş, piknik yap.",
    location: "Hyde Park",
    description: "Parktasın. Yeni insanlarla tanış, havadan konuş ve pikniğe davet et.",
    xpReward: 110,
    mission: "Parkta biriyle hava durumu hakkında konuş.",
    npcName: "Sophie",
    npcRole: "Park Arkadaşı",
    npcEmoji: "☀️",
    dialog: [
      { task: "Görev: Selam ver.", prompt: "Hi there! Beautiful day, isn't it?", line: "Yes, it's a beautiful day!", fallback: "It's a beautiful day!", xp: 20, chips: ["beautiful day", "yes", "isn't it"] },
      { task: "Görev: Pikniğe davet et.", prompt: "Are you having a picnic?", line: "Yes, would you like to join us?", fallback: "Would you like to join us?", xp: 20, chips: ["join us", "would you", "picnic"] },
      { task: "Görev: Vedalaş.", prompt: "I had a great time! See you again?", options: [{ text: "Yes, let's meet again tomorrow!", isCorrect: true }, { text: "Where is the hospital?", isCorrect: false }, { text: "I need a bank account.", isCorrect: false }], xp: 20, fallback: "Let's meet again tomorrow!", chips: ["meet again", "tomorrow", "yes"] },
    ],
    vocabulary: [
      { word: "Park", pronunciation: "/pɑːrk/", translation: "park", emoji: "🌳", visual: "🌳 🌿 ☀️", story: "Ağaçların, çimenlerin yeri.", example: "Let's go to the park." },
      { word: "Weather", pronunciation: "/ˈweð.ər/", translation: "hava durumu", emoji: "🌦️", visual: "🌦️ ☀️ 🌧️", story: "Havanın nasıl olduğu.", example: "Beautiful weather!" },
      { word: "Picnic", pronunciation: "/ˈpɪk.nɪk/", translation: "piknik", emoji: "🧺", visual: "🧺 🥪 🌳", story: "Dışarıda yemek yeme.", example: "We have a picnic." },
      { word: "Beautiful", pronunciation: "/ˈbjuː.tɪ.fəl/", translation: "güzel", emoji: "✨", visual: "✨ 🌳 ☀️", story: "Gözüne hoş gelen.", example: "Beautiful day!" },
    ],
    badge: "🌳 Doğa",
  },

  // ============================ DAY 16 — SİNEMA ============================
  {
    day: 16,
    title: "Sinema",
    emoji: "🎬",
    short: "Bilet al, film sor, salon bul.",
    location: "Odeon Cinema",
    description: "Sinemadasın. Gişeden bilet al, film saatini sor ve salonu bul.",
    xpReward: 120,
    mission: "Gişeden bilet al ve salonu sor.",
    npcName: "Clerk Sam",
    npcRole: "Gişe Görevlisi",
    npcEmoji: "🎟️",
    dialog: [
      { task: "Görev: Film sor.", prompt: "Welcome to Odeon! Which movie would you like to see?", line: "What movies are on today?", fallback: "What movies are on today?", xp: 20, chips: ["movies", "today", "what"] },
      { task: "Görev: Bilet al.", prompt: "We have action at 7 pm and comedy at 9 pm.", line: "Two tickets for the action movie at 7 pm, please.", fallback: "Two tickets for 7 pm, please.", xp: 20, chips: ["two tickets", "7 pm", "please"] },
      { task: "Görev: Salonu sor.", prompt: "Here are your tickets. Enjoy!", options: [{ text: "Thank you, where is hall 2?", isCorrect: true }, { text: "Where is the gym?", isCorrect: false }, { text: "I have a headache.", isCorrect: false }], xp: 20, fallback: "Where is hall 2?", chips: ["hall", "where", "thank you"] },
    ],
    vocabulary: [
      { word: "Movie", pronunciation: "/ˈmuː.vi/", translation: "film", emoji: "🎬", visual: "🎬 🍿 🎟️", story: "Perdede izlediğin hikaye.", example: "I love this movie." },
      { word: "Ticket", pronunciation: "/ˈtɪk.ɪt/", translation: "bilet", emoji: "🎟️", visual: "🎟️ 🎬 🍿", story: "Sinemaya girmek için kağıt.", example: "Two tickets please." },
      { word: "Hall", pronunciation: "/hɔːl/", translation: "salon", emoji: "🏛️", visual: "🏛️ 🎬 💺", story: "Filmin gösterildiği oda.", example: "Hall 2 is upstairs." },
      { word: "Popcorn", pronunciation: "/ˈpɒp.kɔːrn/", translation: "patlamış mısır", emoji: "🍿", visual: "🍿 🎬 😋", story: "Filmle yenen mısır.", example: "Popcorn please." },
    ],
    badge: "🎬 Film",
  },

  // ============================ DAY 17 — MARKET ============================
  {
    day: 17,
    title: "Süpermarket",
    emoji: "🛒",
    short: "Ürün ara, kasiyere sor, ödeme yap.",
    location: "Tesco Superstore",
    description: "Markettesin. Reyon sor, ürün ara ve kasada ödeme yap.",
    xpReward: 110,
    mission: "Kasiyere ürünün yerini sor ve ödeme yap.",
    npcName: "Cashier Jane",
    npcRole: "Kasiyer",
    npcEmoji: "🧾",
    dialog: [
      { task: "Görev: Reyonu sor.", prompt: "Can I help you find something?", line: "Where can I find the milk?", fallback: "Where is the milk?", xp: 20, chips: ["where", "find", "milk"] },
      { task: "Görev: Fiyat sor.", prompt: "It's in aisle 3, next to the bread.", line: "How much is it?", fallback: "How much is it?", xp: 20, chips: ["how much", "is it", "price"] },
      { task: "Görev: Ödeme yap.", prompt: "That will be 5 pounds.", options: [{ text: "Here you are. Thank you!", isCorrect: true }, { text: "Where is my passport?", isCorrect: false }, { text: "I need a doctor.", isCorrect: false }], xp: 20, fallback: "Here you are.", chips: ["here you are", "thank you", "pounds"] },
    ],
    vocabulary: [
      { word: "Market", pronunciation: "/ˈmɑːr.kɪt/", translation: "market", emoji: "🛒", visual: "🛒 🥛 🍞", story: "Yiyecek aldığın büyük dükkan.", example: "Go to the market." },
      { word: "Aisle", pronunciation: "/aɪl/", translation: "reyon/koridor", emoji: "🏷️", visual: "🏷️ 🛒 📦", story: "Market içinde ürün sırası.", example: "Aisle 3." },
      { word: "Cashier", pronunciation: "/kæˈʃɪər/", translation: "kasiyer", emoji: "🧾", visual: "🧾 💷 🛒", story: "Kasada para alan kişi.", example: "Thank you, cashier." },
      { word: "Milk", pronunciation: "/mɪlk/", translation: "süt", emoji: "🥛", visual: "🥛 🐄 🛒", story: "İnekten gelen beyaz içecek.", example: "Where is the milk?" },
    ],
    badge: "🛒 Market",
  },

  // ============================ DAY 18 — KÜTÜPHANE ============================
  {
    day: 18,
    title: "Kütüphane",
    emoji: "📚",
    short: "Kitap sor, üye ol, sessiz ol.",
    location: "British Library",
    description: "Kütüphanedesin. Görevliye kitap sor, üyelik al ve kuralları öğren.",
    xpReward: 120,
    mission: "Görevliye kitap ve üyelik sor.",
    npcName: "Ms. Green",
    npcRole: "Kütüphaneci",
    npcEmoji: "📚",
    dialog: [
      { task: "Görev: Kitap sor.", prompt: "Welcome to the library. How can I help you?", line: "I'm looking for a book on history.", fallback: "I'm looking for a history book.", xp: 20, chips: ["looking for", "book", "history"] },
      { task: "Görev: Üye ol.", prompt: "Do you have a library card?", line: "No, how can I get one?", fallback: "How can I get a library card?", xp: 20, chips: ["library card", "how", "get"] },
      { task: "Görev: Kuralları sor.", prompt: "Fill this form, please. Keep quiet in the library.", options: [{ text: "Of course, I will be quiet.", isCorrect: true }, { text: "Where is the cinema?", isCorrect: false }, { text: "I want to buy milk.", isCorrect: false }], xp: 20, fallback: "I will be quiet.", chips: ["quiet", "will be", "of course"] },
    ],
    vocabulary: [
      { word: "Library", pronunciation: "/ˈlaɪ.brer.i/", translation: "kütüphane", emoji: "📚", visual: "📚 🤫 🏛️", story: "Sessiz kitap evi.", example: "I love the library." },
      { word: "Book", pronunciation: "/bʊk/", translation: "kitap", emoji: "📖", visual: "📖 📚 ✍️", story: "Okuduğun şey.", example: "This book is great." },
      { word: "Quiet", pronunciation: "/ˈkwaɪ.ət/", translation: "sessiz", emoji: "🤫", visual: "🤫 📚 🤐", story: "Ses çıkarmamak.", example: "Be quiet please." },
      { word: "Card", pronunciation: "/kɑːrd/", translation: "kart", emoji: "💳", visual: "💳 📚 ✅", story: "Üyelik kartı.", example: "Library card." },
    ],
    badge: "📚 Bilgi",
  },
];

// achievement catalog
export const ACHIEVEMENT_DEFS = {
  first_talk: { icon: "🎙️", title: "İlk Konuşma", description: "İlk kez AI ile konuştun." },
  first_mission: { icon: "✅", title: "İlk Görev", description: "İlk görevini tamamladın." },
  road_finder: { icon: "🧭", title: "Yol Bulucu", description: "Yön görevlerini tamamladın." },
  restaurant_master: { icon: "🍽️", title: "Restoran Ustası", description: "İlk restoran görevini bitirdin." },
  shopping_fan: { icon: "🛍️", title: "Alışveriş Tutkunu", description: "Alışveriş görevlerini tamamladın." },
  seven_streak: { icon: "🔥", title: "7 Gün Serisi", description: "7 gün çalışmaya devam et." },
  world_citizen: { icon: "🌍", title: "Dünya Vatandaşı", description: "7 günlük macerayı bitirdin." },
} as const;

// level ladder
export const LEVELS = [
  { level: 1, name: "Yeni Yolcu", min: 0 },
  { level: 2, name: "Meraklı Turist", min: 240 },
  { level: 3, name: "Sokak Dilcisi", min: 700 },
  { level: 4, name: "Şehir Gezgini", min: 1500 },
  { level: 5, name: "Konuşma Ustası", min: 2600 },
  { level: 6, name: "Dünya Vatandaşı", min: 4200 },
];

export function levelForXp(xp: number) {
  let cur = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.min) cur = l;
  }
  return cur;
}

// Chat-based free talk topics for real-life mode
export const TALK_TOPICS = [
  { emoji: "✈️", label: "Seyahat", key: "travel" },
  { emoji: "🍽️", label: "Restoran", key: "food" },
  { emoji: "💼", label: "İş", key: "work" },
  { emoji: "🛍️", label: "Alışveriş", key: "shopping" },
  { emoji: "❤️", label: "Sosyal", key: "social" },
  { emoji: "🏠", label: "Günlük hayat", key: "daily" },
  { emoji: "🎬", label: "Eğlence", key: "fun" },
];
