// Ders çeşitliliği — 18 konunun her birine somut mikro-senaryo açıları + NPC rolleri.
// Amaç: aynı konu+seviye tekrar seçilse bile AI her seferinde FARKLI durumdan üretsin.
// Açılar İngilizce yazılır (hedef dilden bağımsız — Groq hedef dile çevirir).

export const TOPIC_ANGLES: Record<string, string[]> = {
  travel: [
    "asking a stranger for directions to the old town",
    "buying a metro ticket from a machine",
    "missing the last bus at night",
    "ordering a taxi to the airport",
    "asking museum opening hours",
    "exchanging money at a kiosk",
    "finding the right platform at the station",
    "booking a guided day tour",
  ],
  airport: [
    "waiting in the passport control queue",
    "asking for the gate number",
    "paying an overweight baggage fee",
    "a delayed flight announcement",
    "asking about perfume prices in duty-free",
    "reporting lost luggage at the desk",
    "putting trays through security control",
    "confusion at the boarding call",
  ],
  hotel: [
    "checking in with a reservation",
    "asking for the wifi password",
    "requesting extra towels",
    "complaining about noisy neighbors",
    "asking breakfast hours",
    "requesting a late check-out",
    "room key card not working",
    "calling reception for an iron",
  ],
  restaurant: [
    "ordering the main dish",
    "asking for the bill",
    "warning about a nut allergy",
    "booking a table for tonight",
    "sending back a cold soup",
    "asking the chef's recommendation",
    "splitting the bill with friends",
    "ordering takeaway by phone",
  ],
  shopping: [
    "asking the price of a jacket",
    "trying on clothes in the fitting room",
    "returning a defective charger",
    "bargaining at the bazaar",
    "asking for a bigger size",
    "card payment fails at the till",
    "asking about the warranty",
    "requesting gift wrapping",
  ],
  work: [
    "giving a daily standup update",
    "asking for a deadline extension",
    "presenting slides in a meeting",
    "disagreeing politely with a colleague",
    "requesting a day off",
    "asking help with a paper jam",
    "introducing a new colleague",
    "talking about a salary raise",
  ],
  education: [
    "asking about the homework",
    "registering for a new course",
    "borrowing a book from the library",
    "asking the exam date",
    "asking the teacher to repeat",
    "splitting tasks in a group project",
    "reporting a dorm room problem",
    "filling in a scholarship form",
  ],
  health: [
    "describing flu symptoms to a doctor",
    "booking a doctor appointment",
    "asking the pharmacist about dosage",
    "a toothache at the dentist",
    "waiting in the emergency room",
    "asking about side effects",
    "asking for blood test results",
    "calling an ambulance",
  ],
  daily: [
    "talking about the morning routine",
    "deciding what to cook for dinner",
    "dividing house cleaning chores",
    "writing a grocery list",
    "putting the kids to bed",
    "doing the laundry",
    "paying the monthly bills",
    "making weekend plans",
  ],
  social: [
    "meeting a new neighbor",
    "inviting a friend to a birthday party",
    "complimenting a friend's haircut",
    "planning Saturday with friends",
    "small talk at a cafe",
    "congratulating a friend on an exam",
    "apologizing for a late reply",
    "saying goodbye at the door",
  ],
  transport: [
    "buying a bus ticket",
    "asking which stop to get off",
    "negotiating the taxi fare",
    "missing the last train",
    "excusing lateness because of traffic",
    "renting a city bike",
    "asking where to change metro lines",
    "calling for help after a car breakdown",
  ],
  money: [
    "ATM swallowed the card",
    "splitting the dinner bill",
    "asking for a salary advance",
    "asking the exchange rate",
    "reporting a lost wallet",
    "paying the monthly rent",
    "a bank transfer that never arrived",
    "asking about a small loan",
  ],
  weather: [
    "planning a weekend picnic",
    "caught in rain without an umbrella",
    "flight delayed because of snow",
    "complaining about the heatwave",
    "asking tomorrow's forecast",
    "a storm warning on the news",
    "planning a beach day",
    "shopping for winter clothes",
  ],
  phone: [
    "rescheduling an appointment by phone",
    "calling back after a bad signal",
    "leaving a voicemail message",
    "apologizing for a wrong number",
    "waiting on hold with customer service",
    "ordering a pizza by phone",
    "oversleeping and calling work late",
    "setting up a video call",
  ],
  food: [
    "following a new recipe",
    "substituting a missing ingredient",
    "fixing an oversalted soup",
    "measuring flour for a cake",
    "asking how spicy a dish is",
    "inventing dinner from fridge leftovers",
    "cooking for unexpected guests",
    "picking fresh fish at the market",
  ],
  music: [
    "recommending a song to a friend",
    "buying concert tickets",
    "learning guitar chords",
    "debating who the best singer is",
    "planning a festival weekend",
    "asking the name of a band",
    "organizing a karaoke night",
    "choosing headphones as a gift",
  ],
  sport: [
    "buying a gym membership",
    "debating last night's match score",
    "inviting a friend to a morning run",
    "muscle pain after a workout",
    "choosing new running shoes",
    "asking swimming pool hours",
    "trying a yoga class",
    "buying derby tickets",
  ],
  hobbies: [
    "describing a painting hobby",
    "a weekend photography walk",
    "asking for gardening tips",
    "picking the book club's next book",
    "challenging a friend to chess",
    "knitting a scarf as a gift",
    "organizing a gaming night",
    "trying a pottery course",
  ],
};

const GENERIC_ANGLES = [
  "asking for help from a stranger",
  "planning something with a friend",
  "complaining politely about a problem",
  "thanking someone warmly",
  "apologizing for a small mistake",
  "making a quick phone call",
  "asking for information at a desk",
  "inviting someone to join",
];

/** Bu dersin konuşma karakteri — her seferinde farklı rol, farklı üslup */
export const NPC_ROLES = [
  "caring mother",
  "close friend",
  "busy shopkeeper",
  "friendly waiter",
  "chatty taxi driver",
  "hotel receptionist",
  "strict teacher",
  "serious boss",
  "kind neighbor",
  "helpful nurse",
  "young tourist",
  "street vendor",
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Konuya özgü rastgele senaryo + NPC seç.
 * salt (örn. görülen cevap sayısı) aynı açının üst üste gelmesini zorlaştırır.
 */
export function pickLessonVariety(
  topicKey: string,
  salt: number = 0,
): { angle: string; npcRole: string; seedWord: string } {
  const angles = TOPIC_ANGLES[topicKey] || GENERIC_ANGLES;
  const startIdx = (salt + Math.floor(Math.random() * angles.length)) % angles.length;
  // Ardışık iki çağrı aynı açıya düşmesin diye bir kaydırma dene
  let angle = angles[startIdx];
  if (angles.length > 1 && salt % 3 === 0) {
    angle = angles[(startIdx + 1) % angles.length];
  }
  const seedWords = ["river", "lantern", "harbor", "meadow", "compass", "window", "garden", "bridge"];
  return { angle, npcRole: rand(NPC_ROLES), seedWord: rand(seedWords) };
}
