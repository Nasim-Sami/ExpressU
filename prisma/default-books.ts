/**
 * The books the reading room opens with.
 *
 * ── Why these are written rather than collected ──────────────────────────────────
 *
 * The obvious thing to seed a Bengali children's shelf with is the canon — Sukumar Ray,
 * Upendrakishore, Tagore's Sahaj Path. Those texts are old enough to be out of copyright,
 * but reproducing them means reproducing them *accurately*, and a half-remembered
 * Abol Tabol published under Sukumar Ray's name is worse than no Abol Tabol at all: it
 * puts words a real author never wrote next to his name.
 *
 * So these are original stories written for this shelf, in the register those books use —
 * short sentences, ordinary things, a small turn at the end. Where one leans on a folk
 * tale that belongs to everybody, it says so. Nothing here is attributed to a real author
 * who didn't write it.
 *
 * They exist so the room isn't empty on day one. Replacing them with the real canon —
 * properly sourced, properly typeset — is a good thing for someone to do later.
 */

export interface DefaultBook {
  title: string;
  author: string;
  blurb: string;
  language: "bn" | "en";
  minAge: number;
  maxAge: number;
  pages: string[];
}

export const DEFAULT_BOOKS: DefaultBook[] = [
  {
    title: "লাল বলটা কোথায়",
    author: "ExpressU-এর জন্য লেখা",
    blurb: "একটা বল হারিয়ে গেছে। খুঁজতে খুঁজতে অনেক কিছু পাওয়া গেল।",
    language: "bn",
    minAge: 3,
    maxAge: 5,
    pages: [
      "মিতুর একটা লাল বল ছিল।\n\nবলটা গোল। বলটা লাল। বলটা লাফায়।",
      "এক দিন সকালে বলটা নেই।\n\nমিতু খাটের নিচে দেখল। বল নেই। একটা মোজা আছে।",
      "মিতু দরজার পিছনে দেখল। বল নেই। একটা পুরোনো ছবি আছে।",
      "মিতু বারান্দায় গেল। বল নেই। একটা প্রজাপতি আছে।\n\nপ্রজাপতিটা হলুদ।",
      "মিতু উঠোনে গেল।\n\nগাছের নিচে কিছু একটা লাল।",
      "সেটা বল না।\n\nসেটা একটা ফুল।",
      "মিতু ফুলটা তুলল।\n\nতারপর পিছনে তাকাল।",
      "বলটা ছিল মিতুর হাতেই।\n\nসারাক্ষণ।",
    ],
  },
  {
    title: "চড়ুই পাখির ছোট্ট ঘর",
    author: "ExpressU-এর জন্য লেখা",
    blurb: "একটা চড়ুই ঘর বানাচ্ছে। সবাই বলছে ঘরটা ছোট।",
    language: "bn",
    minAge: 4,
    maxAge: 7,
    pages: [
      "জানালার কোণে একটা চড়ুই ঘর বানাচ্ছিল।\n\nএকটা খড়। আরেকটা খড়। তারপর আরেকটা।",
      "কাক এসে বলল, “এত ছোট ঘর? আমার ঘর অনেক বড়।”\n\nচড়ুই কিছু বলল না। আরেকটা খড় আনল।",
      "কবুতর এসে বলল, “এত নিচু ঘর? আমার ঘর অনেক উঁচুতে।”\n\nচড়ুই কিছু বলল না। একটা পালক এনে বিছিয়ে দিল।",
      "বক এসে বলল, “এত সাধারণ ঘর? দেখার মতো কিছু নেই।”\n\nচড়ুই এবারও কিছু বলল না। শুধু কাজ করে গেল।",
      "সন্ধ্যায় বৃষ্টি নামল।\n\nখুব জোরে বৃষ্টি।",
      "কাক ভিজল। কবুতর ভিজল। বক ভিজল।",
      "চড়ুই তার ছোট্ট ঘরে বসে বৃষ্টি দেখল।\n\nভিতরটা শুকনো ছিল।",
      "ঘরটা ছোট ছিল, সত্যি।\n\nকিন্তু ঘরটা তার নিজের হাতে বানানো।",
    ],
  },
  {
    title: "টুনটুনি আর বেড়াল",
    author: "লোককথা অবলম্বনে",
    blurb:
      "বাংলার পুরোনো টুনটুনির গল্পের ধাঁচে লেখা — ছোট পাখি, বড় বেড়াল, আর একটুখানি বুদ্ধি।",
    language: "bn",
    minAge: 5,
    maxAge: 9,
    pages: [
      "বেগুন গাছের ডালে টুনটুনির বাসা।\n\nবাসায় তিনটে ডিম। টুনটুনি সারাদিন বসে থাকে, আর গান গায়।",
      "একদিন এক বেড়াল এসে গাছের নিচে দাঁড়াল।\n\nবেড়ালটা বড়, মোটা, আর গলার আওয়াজ ভারী।",
      "বেড়াল বলল, “টুনটুনি, নেমে আয়। কথা আছে।”\n\nটুনটুনি বলল, “কী কথা, বেড়াল মশাই?”",
      "“তোর বাসাটা দেখব।”\n\nটুনটুনি বুঝল, বাসা দেখা নয় — ডিম খাওয়াই আসল কথা।",
      "টুনটুনি বলল, “বেশ তো। কিন্তু আমার বাসায় ঢুকতে হলে একটা নিয়ম আছে।”\n\nবেড়াল কান খাড়া করল।",
      "“যে ঢুকবে, তাকে আমার সমান ছোট হতে হবে। আপনি পারবেন?”\n\nবেড়াল গা ফুলিয়ে বলল, “আমি সব পারি।”",
      "“তাহলে আগে ওই ফুটোটা দিয়ে ঢুকে দেখান।” টুনটুনি দেয়ালের একটা ছোট ফাটা দেখাল।\n\nবেড়াল মাথা ঢোকাল। কাঁধ আটকে গেল।",
      "টানাটানি করতে করতে বেড়ালের গোঁফ ছিঁড়ল, আর মেজাজ গেল বিগড়ে।\n\nশেষে বেড়াল বলল, “থাক, আজ আর দেখব না।”",
      "বেড়াল চলে গেল।\n\nটুনটুনি বাসায় ফিরে গান ধরল।",
      "ছোট হওয়া আর দুর্বল হওয়া এক কথা নয়।\n\nএই গল্পটা বাংলার পুরোনো লোককথা থেকে নেওয়া — গল্পটা সবার।",
    ],
  },
  {
    title: "যে ঘুড়িটা ফিরে এল না",
    author: "ExpressU-এর জন্য লেখা",
    blurb: "সুতো ছিঁড়ে গেলে ঘুড়ি কোথায় যায়? রফিক জানতে চেয়েছিল।",
    language: "bn",
    minAge: 7,
    maxAge: 11,
    pages: [
      "রফিকের ঘুড়িটা ছিল সবুজ, আর তার লেজে একটা লাল কাপড়ের টুকরো বাঁধা।\n\nকাপড়টা ছিল তার বোনের পুরোনো জামার। বোন রাগ করেছিল, তারপর হেসেছিল।",
      "চৈত্র মাসের বিকেল। ছাদে হাওয়া ছিল খুব।\n\nঘুড়ি উঠল, উঠতেই থাকল। রফিক সুতো ছাড়তে ছাড়তে ঘাড় ব্যথা করে ফেলল।",
      "তারপর হঠাৎ হাতটা হালকা হয়ে গেল।\n\nসুতো ছিঁড়েছে।",
      "ঘুড়িটা এক মুহূর্ত থেমে রইল আকাশে। যেন ভাবছে কোন দিকে যাবে।\n\nতারপর উত্তরের দিকে ভেসে গেল।",
      "রফিক ছাদ থেকে নেমে দৌড় দিল। গলি, তারপর বড় রাস্তা, তারপর মাঠ।\n\nঘুড়িটা তখনও দেখা যাচ্ছিল — ছোট, সবুজ, একটা লাল বিন্দু ঝুলছে পিছনে।",
      "মাঠের শেষে নদী। নদীর ওপারে গাছ, তারপর আর কিছু দেখা যায় না।\n\nরফিক দাঁড়িয়ে রইল। ঘুড়িটা গাছের আড়ালে চলে গেল।",
      "বাড়ি ফিরে রফিক কাঁদেনি। শুধু চুপ করে ছিল।\n\nবোন জিজ্ঞেস করল, “ঘুড়ি কই?”\n\nরফিক বলল, “চলে গেছে।”",
      "“কোথায়?”\n\nরফিক জানত না। আর সেটাই ছিল সবচেয়ে অদ্ভুত ব্যাপারটা।",
      "রাতে বিছানায় শুয়ে সে ভাবল — এখন ঘুড়িটা কোথাও আছে। কোনো এক গাছে, বা কোনো এক মাঠে, বা কারো ছাদে।\n\nকোনো একটা ছেলে হয়তো ওটা কুড়িয়ে পেয়েছে। লাল কাপড়টা দেখে ভাবছে, এটা কে বেঁধেছিল।",
      "পরের দিন রফিক নতুন ঘুড়ি বানাল।\n\nএবারও লেজে একটা লাল কাপড় বাঁধল। বোন এবার আর রাগ করল না।",
      "সে জানত সুতো আবার ছিঁড়তে পারে।\n\nতবু বানাল।",
    ],
  },
  {
    title: "নদীটার কোনো নাম ছিল না",
    author: "ExpressU-এর জন্য লেখা",
    blurb:
      "মানচিত্রে নদীটা নেই। তবু গ্রামের সবাই ওটার পাশ দিয়ে হাঁটে। শেফালি ঠিক করল, খোঁজ নেবে।",
    language: "bn",
    minAge: 9,
    maxAge: 13,
    pages: [
      "স্কুলের দেয়ালে একটা মানচিত্র টাঙানো ছিল। পুরোনো, কোণাগুলো ছেঁড়া।\n\nশেফালি প্রায়ই সেটার সামনে দাঁড়িয়ে থাকত। নিজের গ্রামটা খুঁজত।",
      "গ্রামটা ছিল। ছোট একটা বিন্দু, নাম লেখা নেই।\n\nকিন্তু নদীটা ছিল না।",
      "অথচ নদীটা রোজ সেখানে থাকে। শেফালি রোজ সেটার পাশ দিয়ে স্কুলে আসে।\n\nবর্ষায় সেটা ফুলে ওঠে। শীতে সরু হয়ে যায়। কিন্তু থাকে।",
      "সে স্যারকে জিজ্ঞেস করল, “নদীটা মানচিত্রে নেই কেন?”\n\nস্যার বললেন, “ছোট নদী। মানচিত্রে সব ধরে না।”",
      "“তাহলে ওটার নাম কী?”\n\nস্যার একটু থামলেন। তারপর বললেন, “জানি না।”",
      "শেফালি বাড়ি এসে দাদিকে জিজ্ঞেস করল।\n\nদাদি বললেন, “আমরা তো বলি ‘নদী’। আর কী বলব?”",
      "সে মুদি দোকানের কালাম চাচাকে জিজ্ঞেস করল। চাচা বললেন, “আমার বাপও ওটাকে নদীই বলত।”\n\nসে জেলেদের জিজ্ঞেস করল। তারা হেসে বলল, “নাম দিয়ে কী হবে? মাছ তো নাম দেখে আসে না।”",
      "শেফালি একটা খাতা নিল।\n\nপ্রথম পাতায় লিখল: “এই নদীর কথা।”",
      "সে লিখল নদীটা কোথা থেকে আসে — উত্তরের বিল থেকে। কোথায় যায় — দক্ষিণে, বড় নদীতে মেশে।\n\nকতটা চওড়া, বর্ষায় কত ওঠে, কোন জায়গায় বাঁক নেয়। কে কে ওটার পাশে থাকে।",
      "সে ছবি আঁকল। ঠিকঠাক আঁকা হল না, তবু আঁকল।\n\nবাঁকগুলো ভুল জায়গায় বসল। সে মুছল না — পাশে লিখে রাখল, “এখানে ভুল হয়েছে, পরে ঠিক করব।”",
      "তিন মাস পরে খাতাটা ভরে গেল।\n\nশেষ পাতায় সে লিখল: “এই নদীর নাম নেই। কিন্তু এখন এর একটা লেখা আছে।”",
      "খাতাটা সে স্যারকে দেখাল।\n\nস্যার অনেকক্ষণ পাতা ওল্টালেন। তারপর বললেন, “এটা রেখে দিও।”",
      "মানচিত্র বদলায়নি।\n\nনদীটা এখনও নেই সেখানে।",
      "কিন্তু শেফালির গ্রামে এখন সবাই জানে নদীটা উত্তরের বিল থেকে আসে।\n\nকারণ একজন জিজ্ঞেস করেছিল, আর উত্তরটা না পেয়ে নিজে খুঁজে বের করেছিল।",
    ],
  },
  {
    title: "প্রশ্নওয়ালা ছেলেটা",
    author: "ExpressU-এর জন্য লেখা",
    blurb:
      "সবাই বলত ও বেশি প্রশ্ন করে। একদিন একটা প্রশ্ন কাজে লেগে গেল।",
    language: "bn",
    minAge: 11,
    maxAge: 15,
    pages: [
      "আরিফের একটা অভ্যাস ছিল, আর সেটা কারো পছন্দ হত না।\n\nসে প্রশ্ন করত।",
      "ক্লাসে স্যার বলতেন, “এটা এভাবেই হয়।”\nআরিফ বলত, “কেন?”\n\nস্যার বলতেন, “পরীক্ষায় এভাবেই লিখতে হবে।”\nআরিফ বলত, “সেটা তো উত্তর হল না।”",
      "বন্ধুরা হাসত। কেউ কেউ বিরক্ত হত।\n\nএকজন বলেছিল, “তুই জানিস না বলেই এত জিজ্ঞেস করিস।”\n\nকথাটা আরিফের গায়ে লেগেছিল। কয়েক মাস সে চুপ করে ছিল।",
      "চুপ করে থাকার মাসগুলো খারাপ ছিল।\n\nক্লাসে সে বসে থাকত, খাতায় লিখত, আর মাথার ভিতরে প্রশ্নগুলো জমত। কাউকে বলা হত না বলে সেগুলো উত্তরও পেত না।",
      "সেই বছর গ্রামের নলকূপগুলোতে সমস্যা হল।\n\nপানি উঠছিল, কিন্তু কেমন যেন গন্ধ। কেউ বলল ঠিক আছে, কেউ বলল ঠিক নেই।",
      "একজন কর্মকর্তা এলেন। মেপে দেখে বললেন, “পানি ঠিক আছে। চিন্তার কিছু নেই।”\n\nসবাই মাথা নাড়ল। ব্যাপারটা মিটে গেল।",
      "আরিফ হাত তুলল।\n\nতারপর নামিয়ে নিল। তারপর আবার তুলল।",
      "সে জিজ্ঞেস করল, “কোন কূপটা মাপলেন?”\n\nকর্মকর্তা বললেন, “স্কুলেরটা।”",
      "“স্কুলেরটা তো নতুন। গন্ধ আসছে পুরোনোগুলো থেকে — উত্তরপাড়ার তিনটে।”\n\nঘরটা চুপ হয়ে গেল।",
      "কর্মকর্তা কিছুক্ষণ তাকিয়ে রইলেন। তারপর বললেন, “দেখাও কোনগুলো।”",
      "তিনটে কূপের একটাতে সমস্যা ছিল। পরে সেটা বন্ধ করে দেওয়া হয়।\n\nকেউ আরিফকে ধন্যবাদ দেয়নি। ব্যাপারটা এমনভাবে মিটল, যেন কিছু হয়নি।",
      "বাড়ি ফেরার পথে তার এক বন্ধু বলল, “তুই কী করে জানলি?”\n\nআরিফ বলল, “জানতাম না। জিজ্ঞেস করেছিলাম।”",
      "প্রশ্ন করা আর না-জানা এক জিনিস নয়।\n\nপ্রশ্ন করা হল, না-জানাটা স্বীকার করে নেওয়া — সবার সামনে, জোরে।",
      "সবাই যখন মাথা নাড়ছে, তখন হাত তোলা সহজ নয়।\n\nকিন্তু ঘরে যদি একজনও হাত না তোলে, ভুলটা ভুল থেকেই যায়।",
    ],
  },
  {
    title: "The Boy Who Kept the Broken Ones",
    author: "Written for ExpressU",
    blurb: "Everyone threw things away when they stopped working. Tomas didn't.",
    language: "en",
    minAge: 8,
    maxAge: 12,
    pages: [
      "Tomas had a box under his bed, and in the box were things that did not work.\n\nA torch with no bulb. A clock that ran backwards. A radio that only played the sound of rain.",
      "His mother said the box was full of rubbish. She was not being unkind. She was being accurate.\n\nTomas said, “Not yet.”",
      "The clock had come from a skip. It ran perfectly well, only the wrong way round, so that four o'clock arrived before five.\n\nTomas liked it. He said it was the only honest clock he had ever owned, because it never pretended the day was going anywhere good.",
      "The radio was harder to explain. It had one station and that station was rain.\n\nWhen he could not sleep he turned it on, and the rain came, and he slept.",
      "One winter the electricity went out on his whole street, and it stayed out for two days.\n\nPeople stood in their doorways not knowing what to do with their hands.",
      "Tomas went under his bed.\n\nThe torch had no bulb — but the bulb from the broken lamp fitted it. The clock did not need electricity at all, and neither did the radio, which ran on a battery he had never taken out.",
      "For two nights, number 14 was the house with a light in the window and the sound of rain coming from somewhere inside it.\n\nPeople came and sat. Somebody brought bread.",
      "When the power came back nobody talked about it much.\n\nBut his mother did not mention the box again.",
      "Here is the thing Tomas knew, and it is not really about torches.\n\nBroken is a word people use when they have stopped looking. It describes the looker, not the thing.",
    ],
  },
];
