import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveSeedPasswords } from "../src/lib/seed-credentials";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type CategorySeed = {
  name: string;
  nameBn: string;
  slug: string;
  description: string;
  image: string;
  sortOrder: number;
};

type ProductSeed = {
  brand?: string | null;
  subcategory?: string | null;
  variants?: { size?: string[]; color?: string[]; model?: string[] };
  specifications?: { label: string; labelBn?: string | null; value: string; valueBn?: string | null }[];
  name: string;
  nameBn: string;
  slug: string;
  description: string;
  descriptionBn: string;
  sku: string;
  categorySlug: string;
  pricePaisa: bigint;
  compareAtPaisa: bigint | null;
  stock: number;
  isFeatured: boolean;

  image: string;
  imageAlt: string;
};

const categories: CategorySeed[] = [
  {
    name: "Health & Wellness",
    nameBn: "স্বাস্থ্য ও সুস্থতা",
    slug: "health-wellness",
    description: "Everyday immunity, rest and wellbeing essentials for the whole household.",
    image: "/images/products/wellness.svg",
    sortOrder: 1,
  },
  {
    name: "Daily Essentials",
    nameBn: "দৈনন্দিন প্রয়োজন",
    slug: "daily-essentials",
    description: "Practical household staples you reach for again and again.",
    image: "/images/products/essentials.svg",
    sortOrder: 2,
  },
  {
    name: "Home & Living",
    nameBn: "বাড়ি ও জীবনযাত্রা",
    slug: "home-living",
    description: "Fresh scents and simple touches that make a house feel like home.",
    image: "/images/products/home.svg",
    sortOrder: 3,
  },
  {
    name: "Personal Care",
    nameBn: "ব্যক্তিগত যত্ন",
    slug: "personal-care",
    description: "Gentle daily hygiene made for busy Bangladeshi routines.",
    image: "/images/products/personal-care.svg",
    sortOrder: 4,
  },
  {
    name: "Nutrition",
    nameBn: "পুষ্টি ও পানীয়",
    slug: "nutrition",
    description: "Honest fuel for work, study and everything in between.",
    image: "/images/products/nutrition.svg",
    sortOrder: 5,
  },
  {
    name: "Baby & Family",
    nameBn: "শিশু ও পরিবার",
    slug: "baby-family",
    description: "Soft, dependable care for the little ones and the people who love them.",
    image: "/images/products/baby.svg",
    sortOrder: 6,
  },
  {
    name: "Beauty & Skincare",
    nameBn: "সৌন্দর্য ও ত্বকযত্ন",
    slug: "beauty-skincare",
    description: "A straightforward routine for healthy-looking skin.",
    image: "/images/products/beauty.svg",
    sortOrder: 7,
  },
  {
    name: "Fitness & Active",
    nameBn: "ফিটনেস ও কর্মক্ষমতা",
    slug: "fitness-active",
    description: "Hydration and recovery support for an active lifestyle.",
    image: "/images/products/fitness.svg",
    sortOrder: 8,
  },
];

const products: ProductSeed[] = [
  {
    name: "Immunity Boost Tonic",
    nameBn: "ইমিউনিটি বুস্ট টনিক",
    slug: "immunity-boost-tonic",
    description: "A gentle daily tonic with vitamin C, zinc and tulsi to support natural immunity.",
    descriptionBn: "ভিটামিন সি, জিংক ও তুলসীযুক্ত হালকা দৈনিক টনিক, যা প্রাকৃতিক রোগ প্রতিরোধ ক্ষমতা বাড়াতে সাহায্য করে।",
    sku: "SL-HW-001",
    categorySlug: "health-wellness",
    brand: "Savelife",
    subcategory: "Immunity",
    variants: { size: ["100 ml", "250 ml"] },
    specifications: [
      { label: "Volume", labelBn: "পরিমাণ", value: "100 ml", valueBn: "১০০ মি.লি." },
      {
        label: "Key ingredients",
        labelBn: "মূল উপাদান",
        value: "Vitamin C, zinc and tulsi",
        valueBn: "ভিটামিন সি, জিংক ও তুলসী",
      },
    ],
    pricePaisa: 42000n,
    compareAtPaisa: 52000n,
    stock: 120,
    isFeatured: true,
    image: "/images/products/wellness.svg",
    imageAlt: "Immunity Boost Tonic bottle",
  },
  {
    name: "Wellness Starter Pack",
    nameBn: "ওয়েলনেস স্টার্টার প্যাক",
    slug: "wellness-starter-pack",
    description: "Our best-selling introductories bundled together: tonic, multivitamin and a weekly planner.",
    descriptionBn: "জনপ্রিয় প্রথম পছন্দের একই সাথে সংগ্রহ: টনিক, মাল্টিভিটামিন ও সাপ্তাহিক পরিকল্পনা কার্ড।",
    sku: "SL-HW-002",
    categorySlug: "health-wellness",
    brand: "Savelife",
    subcategory: "Wellness kits",
    variants: { model: ["Starter", "Family"] },
    specifications: [
      {
        label: "Contents",
        labelBn: "প্যাকের বিষয়বস্তু",
        value: "Tonic, multivitamin and weekly planner",
        valueBn: "টনিক, মাল্টিভিটামিন ও সাপ্তাহিক পরিকল্পনা কার্ড",
      },
    ],
    pricePaisa: 245000n,
    compareAtPaisa: 290000n,
    stock: 64,
    isFeatured: true,
    image: "/images/products/wellness.svg",
    imageAlt: "Wellness Starter Pack",
  },
  {
    name: "Daily Care Bundle",
    nameBn: "ডেইলি কেয়ার বান্ডল",
    slug: "daily-care-bundle",
    description: "A value pack of soap, tissues and hand wash for everyday family use.",
    descriptionBn: "পরিবারের দৈনন্দিন ব্যবহারের জন্য সাবান, টিস্যু ও হ্যান্ডওয়াশের সাশ্রয়ী প্যাক।",
    sku: "SL-DE-001",
    categorySlug: "daily-essentials",
    brand: "Savelife",
    subcategory: "Care packs",
    variants: { size: ["Single", "Family"] },
    specifications: [
      {
        label: "Includes",
        labelBn: "অন্তর্ভুক্ত",
        value: "Soap, tissues and hand wash",
        valueBn: "সাবান, টিস্যু ও হ্যান্ডওয়াশ",
      },
    ],
    pricePaisa: 128000n,
    compareAtPaisa: 155000n,
    stock: 210,
    isFeatured: true,
    image: "/images/products/essentials.svg",
    imageAlt: "Daily Care Bundle",
  },
  {
    name: "Pure Cotton Facial Tissues",
    nameBn: "বিশুদ্ধ কটন ফেসিয়াল টিস্যু",
    slug: "pure-cotton-tissues",
    description: "Soft, lint-free 3-ply tissues in a compact pack for bags and desks.",
    descriptionBn: "নরম, লিন্টমুক্ত ৩-স্তরের টিস্যু — ব্যাগ ও ডেস্কের জন্য ছোট প্যাক।",
    sku: "SL-DE-002",
    categorySlug: "daily-essentials",
    brand: "Savelife",
    subcategory: "Tissues",
    variants: { size: ["80 sheets", "160 sheets"] },
    specifications: [
      { label: "Layers", labelBn: "স্তর", value: "3-ply", valueBn: "৩-স্তর" },
      { label: "Material", labelBn: "উপাদান", value: "Pure cotton", valueBn: "বিশুদ্ধ কটন" },
    ],
    pricePaisa: 18000n,
    compareAtPaisa: null,
    stock: 480,
    isFeatured: false,
    image: "/images/products/essentials.svg",
    imageAlt: "Pure Cotton Facial Tissues pack",
  },
  {
    name: "Calm Home Diffuser",
    nameBn: "শান্ত ঘর ডিফিউজার",
    slug: "calm-home-diffuser",
    description: "A reed diffuser with a soft lemongrass and cedar scent that lasts for weeks.",
    descriptionBn: "লেমনগ্রাস ও সিডারের হালকা সুগন্ধি রিড ডিফিউজার, কয়েক সপ্তাহ ধরে ঘর সতেজ রাখে।",
    sku: "SL-HL-001",
    categorySlug: "home-living",
    brand: "Savelife Home",
    subcategory: "Fragrance",
    variants: { model: ["Reed diffuser"], color: ["Natural", "Charcoal"] },
    specifications: [
      {
        label: "Scent",
        labelBn: "সুগন্ধ",
        value: "Lemongrass and cedar",
        valueBn: "লেমনগ্রাস ও সিডার",
      },
      {
        label: "Lasts",
        labelBn: "স্থায়িত্ব",
        value: "Up to 4 weeks",
        valueBn: "প্রায় ৪ সপ্তাহ",
      },
    ],
    pricePaisa: 189000n,
    compareAtPaisa: 229000n,
    stock: 45,
    isFeatured: true,
    image: "/images/products/home.svg",
    imageAlt: "Calm Home Diffuser",
  },
  {
    name: "Linen & Room Fresh Spray",
    nameBn: "লিনেন ও রুম ফ্রেশ স্প্রে",
    slug: "linen-fresh-spray",
    description: "A light fabric mist that freshens bedding and curtains without harsh fumes.",
    descriptionBn: "হালকা ফ্যাব্রিক মিস্ট, যা কড়া গন্ধ ছাড়াই বিছানা ও পর্দাকে সতেজ করে।",
    sku: "SL-HL-002",
    categorySlug: "home-living",
    brand: "Savelife Home",
    subcategory: "Air fresheners",
    variants: { size: ["250 ml"] },
    specifications: [
      { label: "Volume", labelBn: "পরিমাণ", value: "250 ml", valueBn: "২৫০ মি.লি." },
      { label: "Use", labelBn: "ব্যবহার", value: "Fabric and room", valueBn: "কাপড় ও ঘর" },
    ],
    pricePaisa: 52000n,
    compareAtPaisa: 62000n,
    stock: 130,
    isFeatured: false,
    image: "/images/products/home.svg",
    imageAlt: "Linen & Room Fresh Spray bottle",
  },
  {
    name: "Herbal Body Wash",
    nameBn: "হার্বাল বডি ওয়াশ",
    slug: "herbal-body-wash",
    description: "A sulphate-free body wash with neem and aloe for a calm, clean finish.",
    descriptionBn: "নিম ও অ্যালোভেরাযুক্ত সালফেট-মুক্ত বডি ওয়াশ, ত্বকে শান্ত ও পরিচ্ছন্ন অনুভূতি দেয়।",
    sku: "SL-PC-001",
    categorySlug: "personal-care",
    brand: "Savelife",
    subcategory: "Body care",
    variants: { size: ["250 ml", "500 ml"] },
    specifications: [
      { label: "Formula", labelBn: "ফর্মুলা", value: "Sulphate-free", valueBn: "সালফেট-মুক্ত" },
      {
        label: "Key ingredients",
        labelBn: "মূল উপাদান",
        value: "Neem and aloe",
        valueBn: "নিম ও অ্যালোভেরা",
      },
    ],
    pricePaisa: 39000n,
    compareAtPaisa: 47000n,
    stock: 260,
    isFeatured: true,
    image: "/images/products/personal-care.svg",
    imageAlt: "Herbal Body Wash bottle",
  },
  {
    name: "Fresh Breath Toothpaste",
    nameBn: "ফ্রেশ ব্রেথ টুথপেস্ট",
    slug: "fresh-breath-toothpaste",
    description: "Mild mint toothpaste with fluoride for everyday cavity protection.",
    descriptionBn: "দৈনিক ক্যাভিটি প্রতিরোধের ফ্লোরাইডযুক্ত মৃদু মিন্ট টুথপেস্ট।",
    sku: "SL-PC-002",
    categorySlug: "personal-care",
    brand: "Savelife",
    subcategory: "Oral care",
    variants: { size: ["100 g"] },
    specifications: [
      { label: "Flavour", labelBn: "স্বাদ", value: "Mild mint", valueBn: "মৃদু মিন্ট" },
      {
        label: "Protection",
        labelBn: "সুরক্ষা",
        value: "Fluoride cavity care",
        valueBn: "ফ্লোরাইড ক্যাভিটি প্রতিরোধ",
      },
    ],
    pricePaisa: 22000n,
    compareAtPaisa: null,
    stock: 340,
    isFeatured: false,
    image: "/images/products/personal-care.svg",
    imageAlt: "Fresh Breath Toothpaste tube",
  },
  {
    name: "Daily Protein Blend",
    nameBn: "ডেইলি প্রোটিন ব্লেন্ড",
    slug: "daily-protein-blend",
    description: "Whey and plant protein with digestive enzymes — 20g protein per serving.",
    descriptionBn: "হোয়ে ও উদ্ভিদ প্রোটিন এবং হজম এনজাইম — প্রতি সার্ভিংয়ে ২০ গ্রাম প্রোটিন।",
    sku: "SL-NU-001",
    categorySlug: "nutrition",
    brand: "Savelife Nutrition",
    subcategory: "Protein",
    variants: { size: ["500 g", "1 kg"], color: ["Chocolate", "Vanilla"] },
    specifications: [
      {
        label: "Protein per serving",
        labelBn: "প্রতি সার্ভিংয়ে প্রোটিন",
        value: "20 g",
        valueBn: "২০ গ্রাম",
      },
      {
        label: "Blend",
        labelBn: "মিশ্রণ",
        value: "Whey and plant protein",
        valueBn: "হোয়ে ও উদ্ভিদ প্রোটিন",
      },
    ],
    pricePaisa: 165000n,
    compareAtPaisa: 199000n,
    stock: 88,
    isFeatured: true,
    image: "/images/products/nutrition.svg",
    imageAlt: "Daily Protein Blend jar",
  },
  {
    name: "Golden Honey Sticks",
    nameBn: "গোল্ডেন হানি স্টিক",
    slug: "golden-honey-sticks",
    description: "Ten single-serve sticks of raw honey — tidy in a lunch bag or office drawer.",
    descriptionBn: "দশটি এক-বার ব্যবহারের খাঁটি মধুর স্টিক — লাঞ্চ ব্যাগ বা অফিস ড্রয়ারের জন্য পরিপাটি।",
    sku: "SL-NU-002",
    categorySlug: "nutrition",
    brand: "Savelife Nutrition",
    subcategory: "Honey",
    variants: { size: ["10 sticks", "30 sticks"] },
    specifications: [
      {
        label: "Pack",
        labelBn: "প্যাক",
        value: "10 single-serve sticks",
        valueBn: "১০টি এক-বার ব্যবহারের স্টিক",
      },
      { label: "Source", labelBn: "উৎস", value: "Raw honey", valueBn: "খাঁটি মধু" },
    ],
    pricePaisa: 45000n,
    compareAtPaisa: 55000n,
    stock: 175,
    isFeatured: false,
    image: "/images/products/nutrition.svg",
    imageAlt: "Golden Honey Sticks",
  },
  {
    name: "Gentle Baby Lotion",
    nameBn: "কোমল বেবি লোশন",
    slug: "gentle-baby-lotion",
    description: "Fragrance-free shea lotion that keeps delicate skin soft through dry weather.",
    descriptionBn: "সুগন্ধমুক্ত শিয়া লোশন, শুষ্ক আবহাওয়াতেও ছোট্ট ত্বক নরম রাখে।",
    sku: "SL-BF-001",
    categorySlug: "baby-family",
    brand: "Savelife Baby",
    subcategory: "Baby skincare",
    variants: { size: ["200 ml"] },
    specifications: [
      {
        label: "Fragrance",
        labelBn: "সুগন্ধ",
        value: "Fragrance-free",
        valueBn: "সুগন্ধমুক্ত",
      },
      {
        label: "Key ingredient",
        labelBn: "মূল উপাদান",
        value: "Shea butter",
        valueBn: "শিয়া বাটার",
      },
    ],
    pricePaisa: 48000n,
    compareAtPaisa: 58000n,
    stock: 150,
    isFeatured: true,
    image: "/images/products/baby.svg",
    imageAlt: "Gentle Baby Lotion bottle",
  },
  {
    name: "Family Care Kit",
    nameBn: "ফ্যামিলি কেয়ার কিট",
    slug: "family-care-kit",
    description: "A compact first-aid and hygiene kit with bandages, wipes and thermometer strips.",
    descriptionBn: "ব্যান্ডেজ, ওয়াইপ ও থার্মোমিটার স্ট্রিপসহ ছোট প্রথম সাহায্য ও স্বাস্থ্যবিধি কিট।",
    sku: "SL-BF-002",
    categorySlug: "baby-family",
    brand: "Savelife",
    subcategory: "First aid",
    variants: { model: ["Compact", "Extended"] },
    specifications: [
      {
        label: "Includes",
        labelBn: "অন্তর্ভুক্ত",
        value: "Bandages, wipes and thermometer strips",
        valueBn: "ব্যান্ডেজ, ওয়াইপ ও থার্মোমিটার স্ট্রিপস",
      },
    ],
    pricePaisa: 115000n,
    compareAtPaisa: 139000n,
    stock: 72,
    isFeatured: false,
    image: "/images/products/baby.svg",
    imageAlt: "Family Care Kit",
  },
  {
    name: "Vitamin C Face Wash",
    nameBn: "ভিটামিন সি ফেস ওয়াশ",
    slug: "vitamin-c-face-wash",
    description: "A low-foam gel cleanser that brightens without stripping the skin barrier.",
    descriptionBn: "কম ফেনাযুক্ত জেল ক্লিনজার, ত্বকের বাধা নষ্ট না করে উজ্জ্বলতা আনে।",
    sku: "SL-BS-001",
    categorySlug: "beauty-skincare",
    brand: "Savelife Beauty",
    subcategory: "Cleansers",
    variants: { size: ["150 ml"] },
    specifications: [
      {
        label: "Skin type",
        labelBn: "ত্বকের ধরন",
        value: "All skin types",
        valueBn: "সব ধরনের ত্বক",
      },
      {
        label: "Key ingredient",
        labelBn: "মূল উপাদান",
        value: "Vitamin C",
        valueBn: "ভিটামিন সি",
      },
    ],
    pricePaisa: 36000n,
    compareAtPaisa: 44000n,
    stock: 195,
    isFeatured: true,
    image: "/images/products/beauty.svg",
    imageAlt: "Vitamin C Face Wash tube",
  },
  {
    name: "Hydrating Day Serum",
    nameBn: "হাইড্রেটিং ডে সিরাম",
    slug: "hydrating-day-serum",
    description: "Hyaluronic acid and niacinamide serum for a dewy, comfortable daytime finish.",
    descriptionBn: "হায়ালুরোনিক অ্যাসিড ও নিয়াসিনামাইড সিরাম, দিনে ত্বক সতেজ ও আরামদায়ক রাখে।",
    sku: "SL-BS-002",
    categorySlug: "beauty-skincare",
    brand: "Savelife Beauty",
    subcategory: "Serums",
    variants: { size: ["30 ml"] },
    specifications: [
      {
        label: "Key ingredients",
        labelBn: "মূল উপাদান",
        value: "Hyaluronic acid and niacinamide",
        valueBn: "হায়ালুরোনিক অ্যাসিড ও নিয়াসিনামাইড",
      },
      {
        label: "Finish",
        labelBn: "ফিনিশ",
        value: "Dewy daytime",
        valueBn: "দিনে সতেজ ত্বক",
      },
    ],
    pricePaisa: 89000n,
    compareAtPaisa: 109000n,
    stock: 96,
    isFeatured: false,
    image: "/images/products/beauty.svg",
    imageAlt: "Hydrating Day Serum dropper bottle",
  },
  {
    name: "Electrolyte Hydration Mix",
    nameBn: "ইলেক্ট্রোলাইট হাইড্রেশন মিক্স",
    slug: "electrolyte-hydration-mix",
    description: "Orange-flavour sachets with sodium, potassium and magnesium for hot days and workouts.",
    descriptionBn: "গরম দিন ও ব্যায়ামের জন্য সোডিয়াম, পটাসিয়াম ও ম্যাগনেসিয়ামযুক্ত কমলা স্বাদের স্যাশে।",
    sku: "SL-FA-001",
    categorySlug: "fitness-active",
    brand: "Savelife Active",
    subcategory: "Hydration",
    variants: { size: ["10 sachets", "30 sachets"] },
    specifications: [
      { label: "Flavour", labelBn: "স্বাদ", value: "Orange", valueBn: "কমলা" },
      {
        label: "Electrolytes",
        labelBn: "ইলেক্ট্রোলাইট",
        value: "Sodium, potassium and magnesium",
        valueBn: "সোডিয়াম, পটাসিয়াম ও ম্যাগনেসিয়াম",
      },
    ],
    pricePaisa: 62000n,
    compareAtPaisa: 74000n,
    stock: 140,
    isFeatured: true,
    image: "/images/products/fitness.svg",
    imageAlt: "Electrolyte Hydration Mix sachets",
  },
  {
    name: "Flex Recovery Balm",
    nameBn: "ফ্লেক্স রিকভারি বালম",
    slug: "flex-recovery-balm",
    description: "A cooling menthol balm for tired muscles after training or a long commute.",
    descriptionBn: "ব্যায়াম বা দীর্ঘ যাত্রার পর ক্লান্ত পেশীর জন্য ঠান্ডা মেন্থল বালম।",
    sku: "SL-FA-002",
    categorySlug: "fitness-active",
    brand: "Savelife Active",
    subcategory: "Recovery",
    variants: { size: ["75 g"] },
    specifications: [
      {
        label: "Effect",
        labelBn: "প্রভাব",
        value: "Cooling menthol",
        valueBn: "ঠান্ডা মেন্থল",
      },
      {
        label: "Use",
        labelBn: "ব্যবহার",
        value: "Post-workout muscles",
        valueBn: "ব্যায়ামের পর পেশী",
      },
    ],
    pricePaisa: 54000n,
    compareAtPaisa: null,
    stock: 110,
    isFeatured: false,
    image: "/images/products/fitness.svg",
    imageAlt: "Flex Recovery Balm",
  },
];

async function ensureSelfOwnership(accountId: string) {
  await prisma.accountOwnership.upsert({
    where: { accountId },
    update: {},
    create: { id: `self_${accountId}`, ownerId: accountId, accountId },
  });
}

async function main() {
  const sequence = await prisma.memberSequence.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, lastValue: 0 },
  });
  // The founder owns SL000001; registrations must start at SL000002.
  if (sequence.lastValue < 1) {
    await prisma.memberSequence.update({ where: { id: 1 }, data: { lastValue: 1 } });
  }

  const { adminPassword, founderPassword } = resolveSeedPasswords();
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Keep the legacy SL000000 super admin untouched when reseeding an existing
  // database. A freshly seeded admin is an identity only, with no member ID.
  const adminEmail = "admin@savelife.test";
  const existingAdmin = await prisma.member.findFirst({
    where: {
      OR: [
        { memberId: "SL000000" },
        { email: { equals: adminEmail, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  const admin =
    existingAdmin ??
    (await prisma.member.create({
      data: {
        memberId: null,
        fullName: "Savelife Administrator",
        email: adminEmail,
        phone: "+8801000000000",
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        activationDate: new Date(),
      },
    }));

  await prisma.wallet.upsert({
    where: { memberId: admin.id },
    update: {},
    create: { memberId: admin.id },
  });
  await ensureSelfOwnership(admin.id);

  // Root of the sponsor tree. Not a sponsor/downline of anyone, so it has no
  // upline rows; new registrations use SL000001 as their sponsorMemberId.
  const founderPasswordHash = await bcrypt.hash(founderPassword, 12);
  const founder = await prisma.member.upsert({
    where: { memberId: "SL000001" },
    update: {},
    create: {
      memberId: "SL000001",
      fullName: "Savelife Founder",
      email: "founder@savelife.test",
      phone: "+8801000000001",
      passwordHash: founderPasswordHash,
      role: "MEMBER",
      status: "ACTIVE",
      activationDate: new Date(),
    },
  });

  await prisma.wallet.upsert({
    where: { memberId: founder.id },
    update: {},
    create: { memberId: founder.id },
  });
  await ensureSelfOwnership(founder.id);

  await prisma.activationHistory.upsert({
    where: { memberId: founder.id },
    update: {},
    create: {
      memberId: founder.id,
      activatedBy: admin.id,
      note: "Seeded founder account",
    },
  });

  await prisma.investmentSettings.upsert({
    where: { version: 1 },
    update: {},
    create: {
      version: 1,
      installmentDurationMonths: 14,
      profitOnlyLockInMonths: 12,
      withdrawalFeeBps: 1000,
      minWithdrawalPaisa: 50000n,
      isActive: true,
    },
  });

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        nameBn: category.nameBn,
        description: category.description,
        image: category.image,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      create: { ...category, isActive: true },
    });
  }

  const categoryIds = new Map<string, string>();
  for (const category of categories) {
    const record = await prisma.category.findUniqueOrThrow({ where: { slug: category.slug } });
    categoryIds.set(category.slug, record.id);
  }

  for (const product of products) {
    const { categorySlug, image, imageAlt, ...productData } = product;
    const categoryId = categoryIds.get(categorySlug);
    if (!categoryId) {
      throw new Error(`No seeded category for slug "${categorySlug}".`);
    }

    const record = await prisma.product.upsert({
      where: { slug: product.slug },
      update: { ...productData, categoryId, isActive: true },
      create: { ...productData, categoryId, isActive: true },
    });

    const existingImages = await prisma.productImage.findMany({
      where: { productId: record.id },
      select: { id: true, url: true },
    });
    const primary = existingImages.find((item) => item.url === image);

    if (!primary) {
      await prisma.productImage.deleteMany({ where: { productId: record.id } });
      await prisma.productImage.create({
        data: {
          productId: record.id,
          url: image,
          alt: imageAlt,
          isPrimary: true,
          sortOrder: 0,
        },
      });
      continue;
    }

    await prisma.productImage.update({
      where: { id: primary.id },
      data: { alt: imageAlt, isPrimary: true, sortOrder: 0 },
    });

    const staleIds = existingImages.filter((item) => item.id !== primary.id).map((item) => item.id);
    if (staleIds.length > 0) {
      await prisma.productImage.deleteMany({ where: { id: { in: staleIds } } });
    }
  }

  console.log(`Seed complete: ${categories.length} categories, ${products.length} products ready.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
