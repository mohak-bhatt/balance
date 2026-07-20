// Core data layer for Balance (formerly "Liquid Ledger").
// File name kept as ledger.ts to avoid an import churn across the codebase,
// but every user-facing string is "Balance" and storage keys are `balance:*`.

export type Direction = "in" | "out";
export type PaymentMethod = "cash" | "upi" | "card" | "netbanking" | "other";

export interface LineItem {
  name: string;
  category: string;
  amount: number;
}

export interface Transaction {
  id: string;
  title: string;
  note?: string | null;
  amount: number;
  category: string;
  icon: string;
  direction: Direction;
  paymentMethod: PaymentMethod;
  timestamp: string;
  lentTo?: string | null;
  repaid?: boolean | null;
  repaymentOfId?: string | null;
  items?: LineItem[] | null;
  sourceLoopId?: string | null;
}

export interface Favorite {
  id: string;
  label: string;
  category: string;
  icon: string;
  presetAmount?: number | null;
  direction?: Direction; // defaults to "out"
  paymentMethod?: PaymentMethod;
}

export interface Loop {
  id: string;
  label: string;
  icon: string;
  category: string;
  amount: number;
  direction: Direction;
  paymentMethod: PaymentMethod;
  recurrenceDayOfMonth: number;
  lastAppliedDate: string | null;
}

export type BalancesByMethod = Record<PaymentMethod, number>;

export interface BalanceState {
  // legacy "allowance" kept only for one-shot migration; not used at runtime
  balancesByMethod: BalancesByMethod;
  lowBalanceAlertThreshold: number;
  transactions: Transaction[];
  favorites: Favorite[];
  loops: Loop[];
  categorizationOverrides: Record<string, string>; // normalizedDescription -> categoryKey
  notificationsEnabled: boolean;
  lastWeeklyAnalyticsViewed: string | null;
  lastMonthlyAnalyticsViewed: string | null;
  userName: string;
  onboardingComplete: boolean;
}

const STORAGE_KEY = "balance:v4";
const LEGACY_KEY_V2 = "liquid-ledger:v2";

export const PAYMENT_METHODS: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: "cash", label: "Cash", icon: "Banknote" },
  { key: "upi", label: "UPI", icon: "Smartphone" },
  { key: "card", label: "Card", icon: "CreditCard" },
  { key: "netbanking", label: "Net Banking", icon: "Globe" },
  { key: "other", label: "Other", icon: "Wallet" },
];

export const DEFAULT_STATE: BalanceState = {
  balancesByMethod: { cash: 0, upi: 0, card: 0, netbanking: 0, other: 0 },
  lowBalanceAlertThreshold: 0,
  transactions: [],
  favorites: [
    { id: "fav-2", label: "Coffee", category: "coffee_snacks", icon: "Coffee", presetAmount: 80, direction: "out" },
    { id: "fav-3", label: "Auto", category: "transport", icon: "Car", presetAmount: 60, direction: "out" },
    { id: "fav-4", label: "Groceries", category: "groceries", icon: "ShoppingCart", presetAmount: null, direction: "out" },
  ],
  loops: [],
  categorizationOverrides: {},
  notificationsEnabled: false,
  lastWeeklyAnalyticsViewed: null,
  lastMonthlyAnalyticsViewed: null,
  userName: "",
  onboardingComplete: false,
};

export function loadState(): BalanceState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    // One-time migration from v2 ("liquid-ledger:v2")
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEY_V2);
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy) as {
            allowance?: number;
            transactions?: Array<Partial<Transaction>>;
            favorites?: Favorite[];
          };
          const migratedTx: Transaction[] = (parsed.transactions ?? []).map((t) => ({
            id: t.id ?? crypto.randomUUID(),
            title: t.title ?? "",
            amount: Number(t.amount ?? 0),
            category: t.category ?? "misc",
            icon: t.icon ?? "Sparkles",
            direction: "out",
            paymentMethod: "cash",
            timestamp: t.timestamp ?? new Date().toISOString(),
            note: null,
            items: null,
          }));
          const migrated: BalanceState = {
            ...DEFAULT_STATE,
            // treat any leftover "allowance" as cash balance to preserve a starting number
            balancesByMethod: {
              ...DEFAULT_STATE.balancesByMethod,
              cash: Math.max(0, Number(parsed.allowance ?? 0) - migratedTx.reduce((s, t) => s + t.amount, 0)),
            },
            transactions: migratedTx,
            favorites: (parsed.favorites ?? DEFAULT_STATE.favorites).map((f) => ({
              direction: "out", paymentMethod: "cash", ...f,
            })),
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          raw = JSON.stringify(migrated);
        } catch { /* ignore */ }
      }
    }
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<BalanceState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      balancesByMethod: { ...DEFAULT_STATE.balancesByMethod, ...(parsed.balancesByMethod ?? {}) },
      categorizationOverrides: parsed.categorizationOverrides ?? {},
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: BalanceState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function currentBalance(s: BalanceState): number {
  const b = s.balancesByMethod;
  return b.cash + b.upi + b.card + b.netbanking + b.other;
}

// ---------- Categories ----------

export interface CategoryDef {
  key: string;
  label: string;
  icon: string;
  color: string;
  keywords: string[];
  direction?: Direction; // optional hint — "in" for income-only categories
}

// Reserved category, never selectable in pickers — auto-applied to lend entries
export const LENT_OUT_KEY = "lent_out";

export const CATEGORIES: CategoryDef[] = [
  { key: "food", label: "Food & Dining", icon: "UtensilsCrossed", color: "#F59E0B",
    keywords: ["lunch","dinner","breakfast","restaurant","food","meal","pizza","burger","biryani","swiggy","zomato","dominos","mcdonald","kfc","subway","thali","dosa","idli","paratha"] },
  { key: "groceries", label: "Groceries", icon: "ShoppingCart", color: "#84CC16",
    keywords: ["grocery","groceries","vegetables","fruits","dmart","bigbasket","blinkit","zepto","instamart","market","supermarket","kirana"] },
  { key: "coffee_snacks", label: "Coffee & Snacks", icon: "Coffee", color: "#D97706",
    keywords: ["coffee","tea","chai","snack","samosa","cafe","starbucks","cookie","bakery","cake","ice cream","icecream","chaayos","blue tokai","third wave"] },
  { key: "transport", label: "Transport", icon: "Bus", color: "#06B6D4",
    keywords: ["bus","metro","train","uber","ola","rapido","taxi","auto","ride","cab","fare","redbus","irctc","local train"] },
  { key: "fuel", label: "Fuel", icon: "Fuel", color: "#EF4444",
    keywords: ["petrol","fuel","diesel","gas station","hp petrol","indian oil","shell"] },
  { key: "shopping", label: "Shopping", icon: "ShoppingBag", color: "#A855F7",
    keywords: ["amazon","flipkart","ajio","meesho","buy","shopping","mall","nykaa","tata cliq"] },
  { key: "clothing", label: "Clothing", icon: "Shirt", color: "#EC4899",
    keywords: ["clothes","shirt","tshirt","jeans","shoes","dress","myntra","zara","h&m","uniqlo","kurta"] },
  { key: "electronics", label: "Electronics", icon: "Laptop", color: "#3B82F6",
    keywords: ["laptop","phone","keyboard","mouse","gadget","headphone","headphones","charger","earbuds","airpods","monitor","ssd"] },
  { key: "stationery", label: "Stationery", icon: "Pencil", color: "#64748B",
    keywords: ["pen","pencil","notebook","stationery","print","paper","xerox","photocopy"] },
  { key: "bills", label: "Bills & Utilities", icon: "Receipt", color: "#F97316",
    keywords: ["electricity","water","wifi","internet","bill","gas bill","jio","airtel","vi recharge","bsnl","broadband","recharge","postpaid"] },
  { key: "rent", label: "Rent & Housing", icon: "Home", color: "#DC2626",
    keywords: ["rent","housing","maintenance","apartment","pg fees","hostel"] },
  { key: "subscriptions", label: "Subscriptions", icon: "Repeat", color: "#8B5CF6",
    keywords: ["netflix","spotify","amazon prime","prime video","subscription","youtube premium","icloud","apple music","disney","hotstar","sonyliv"] },
  { key: "entertainment", label: "Entertainment", icon: "Clapperboard", color: "#F472B6",
    keywords: ["movie","bookmyshow","pvr","inox","concert","party","drinks","bar","game","steam","playstation","xbox"] },
  { key: "fitness", label: "Health & Fitness", icon: "Dumbbell", color: "#10B981",
    keywords: ["gym","fitness","yoga","protein","workout","cult","cure fit"] },
  { key: "medical", label: "Medical & Pharmacy", icon: "Pill", color: "#22D3EE",
    keywords: ["doctor","medicine","pharmacy","hospital","clinic","apollo","1mg","pharmeasy","netmeds"] },
  { key: "education", label: "Education", icon: "GraduationCap", color: "#6366F1",
    keywords: ["course","book","tuition","udemy","coursera","class","education","fees","tuition fees","library"] },
  { key: "travel", label: "Travel", icon: "Plane", color: "#0EA5E9",
    keywords: ["flight","hotel","airbnb","trip","travel","vacation","makemytrip","goibibo","oyo","cleartrip"] },
  { key: "gifts", label: "Gifts & Donations", icon: "Gift", color: "#F43F5E",
    keywords: ["gift","donation","charity","present"] },
  { key: "investments", label: "Investments", icon: "TrendingUp", color: "#16A34A",
    keywords: ["stock","mutual fund","sip","investment","crypto","zerodha","groww","upstox"] },
  { key: "insurance", label: "Insurance", icon: "ShieldCheck", color: "#0891B2",
    keywords: ["insurance","premium","policy","lic"] },
  { key: "personal_care", label: "Personal Care", icon: "Scissors", color: "#E11D48",
    keywords: ["salon","haircut","grooming","skincare","spa","barber"] },
  { key: "pets", label: "Pets", icon: "PawPrint", color: "#CA8A04",
    keywords: ["pet","dog","cat","vet","pet food"] },
  { key: "home_repair", label: "Home Maintenance", icon: "Wrench", color: "#7C3AED",
    keywords: ["repair","plumber","electrician","maintenance","urbanclap","urban company"] },
  { key: "childcare", label: "Childcare", icon: "Baby", color: "#FB7185",
    keywords: ["baby","daycare","school fees","child","diapers"] },

  // Income-side categories
  { key: "pocket_money", label: "Pocket Money", icon: "Wallet", color: "#22C55E",
    keywords: ["pocket money","allowance from","from mom","from dad","from parents"], direction: "in" },
  { key: "salary", label: "Salary / Stipend", icon: "Briefcase", color: "#10B981",
    keywords: ["salary","stipend","paycheck","wage"], direction: "in" },
  { key: "gift_in", label: "Gift Received", icon: "Gift", color: "#34D399",
    keywords: ["gift received","birthday money","cash gift"], direction: "in" },
  { key: "refund", label: "Refund", icon: "Undo2", color: "#4ADE80",
    keywords: ["refund","refunded","returned","cashback"], direction: "in" },
  { key: "loan_repaid", label: "Loan Repayment Received", icon: "Handshake", color: "#86EFAC",
    keywords: ["repayment","paid back","returned the money"], direction: "in" },
  { key: "other_income", label: "Other Income", icon: "PiggyBank", color: "#A7F3D0",
    keywords: ["income","received","credit"], direction: "in" },

  { key: "opening_balance", label: "Opening Balance", icon: "Wallet", color: "#A7F3D0",
    keywords: [], direction: "in" },

  { key: "misc", label: "Miscellaneous", icon: "Sparkles", color: "#94A3B8", keywords: [] },

  // Reserved — auto-applied to lend transactions, hidden from pickers
  { key: LENT_OUT_KEY, label: "Lent Out", icon: "Handshake", color: "#FBBF24", keywords: [] },
];

export const PICKABLE_EXPENSE_CATEGORIES = CATEGORIES.filter(
  (c) => c.key !== LENT_OUT_KEY && c.direction !== "in",
);
export const PICKABLE_INCOME_CATEGORIES = CATEGORIES.filter(
  (c) => c.direction === "in" && c.key !== "opening_balance",
);

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Smart category matcher.
 * 1) Exact match against learned overrides
 * 2) Substring match against learned overrides
 * 3) Longest-keyword-wins across the keyword dictionary
 * 4) Falls back to "misc"
 */
export function matchCategory(
  text: string,
  opts: { overrides?: Record<string, string>; direction?: Direction } = {},
): CategoryDef {
  const t = normalize(text);
  if (!t) return getCategory("misc");
  const { overrides = {}, direction = "out" } = opts;

  if (overrides[t]) return getCategory(overrides[t]);
  for (const desc in overrides) {
    if (t.includes(desc) || desc.includes(t)) return getCategory(overrides[desc]);
  }

  const pool = direction === "in" ? PICKABLE_INCOME_CATEGORIES : PICKABLE_EXPENSE_CATEGORIES;
  let best: { cat: CategoryDef; len: number } | null = null;
  for (const c of pool) {
    for (const k of c.keywords) {
      if (t.includes(k) && (!best || k.length > best.len)) {
        best = { cat: c, len: k.length };
      }
    }
  }
  if (best) return best.cat;
  return direction === "in" ? getCategory("other_income") : getCategory("misc");
}

export function rememberCategoryChoice(
  overrides: Record<string, string>,
  text: string,
  categoryKey: string,
): Record<string, string> {
  const t = normalize(text);
  if (!t) return overrides;
  return { ...overrides, [t]: categoryKey };
}

export function getCategory(key: string): CategoryDef {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES.find((c) => c.key === "misc")!;
}

export function formatCurrency(n: number) {
  const v = Math.round(Math.abs(n)).toLocaleString("en-IN");
  return (n < 0 ? "-₹" : "₹") + v;
}

// ---------- Grouping ----------

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function dayLabel(d: Date): string {
  const today = dayStart(new Date());
  const yest = today - 86400000;
  const ds = dayStart(d);
  if (ds === today) return "Today";
  if (ds === yest) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function groupByDay(txs: Transaction[]): [string, Transaction[]][] {
  const groups = new Map<string, Transaction[]>();
  for (const t of txs) {
    const d = new Date(t.timestamp);
    const label = dayLabel(d);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(t);
  }
  return Array.from(groups.entries());
}

export interface MonthGroup {
  key: string;       // "2026-06"
  label: string;     // "June 2026"
  inTotal: number;
  outTotal: number;
  net: number;
  days: [string, Transaction[]][];
}

export function groupByMonth(txs: Transaction[]): MonthGroup[] {
  const buckets = new Map<string, Transaction[]>();
  for (const t of txs) {
    const d = new Date(t.timestamp);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(t);
  }
  return Array.from(buckets.entries()).map(([key, items]) => {
    const [y, m] = key.split("-").map(Number);
    const inTotal = items.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
    const outTotal = items.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
    return {
      key,
      label: new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      inTotal, outTotal, net: inTotal - outTotal,
      days: groupByDay(items),
    };
  });
}

export function totalSpentThisMonth(txs: Transaction[]): number {
  const now = new Date();
  const y = now.getFullYear(); const m = now.getMonth();
  return txs
    .filter((t) => t.direction === "out")
    .filter((t) => {
      const d = new Date(t.timestamp);
      return d.getFullYear() === y && d.getMonth() === m;
    })
    .reduce((s, t) => s + t.amount, 0);
}

// ---------- Loops ----------

/**
 * Walk forward from `lastAppliedDate` (or one cycle before today if null), emitting a
 * dated execution for every monthly cycle that's strictly in the past.
 */
export function dueLoopExecutions(loop: Loop, now: Date = new Date()): string[] {
  const out: string[] = [];
  const day = Math.min(Math.max(1, loop.recurrenceDayOfMonth), 28);
  let cursor: Date;
  if (loop.lastAppliedDate) {
    cursor = new Date(loop.lastAppliedDate);
    cursor.setMonth(cursor.getMonth() + 1);
  } else {
    // First eligible occurrence: this month's `day` if it's already past, else last month's `day`.
    cursor = new Date(now.getFullYear(), now.getMonth(), day, 12, 0, 0);
    if (cursor.getTime() > now.getTime()) cursor.setMonth(cursor.getMonth() - 1);
  }
  while (cursor.getTime() <= now.getTime()) {
    const dated = new Date(cursor.getFullYear(), cursor.getMonth(), day, 12, 0, 0);
    if (dated.getTime() <= now.getTime()) out.push(dated.toISOString());
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

// ---------- Icon library (curated) ----------
export const ICON_LIBRARY: string[] = [
  "Coffee","Cookie","UtensilsCrossed","Pizza","IceCream","Beer","Wine","CakeSlice","Apple","Sandwich",
  "ShoppingCart","ShoppingBag","Shirt","Watch","Gem","Gift","Backpack",
  "Bus","Car","Bike","Train","Plane","Ship","Fuel","ParkingCircle",
  "Home","BedDouble","Sofa","Lamp","Wrench","Hammer","Paintbrush",
  "Laptop","Smartphone","Headphones","Keyboard","Mouse","Gamepad2","Camera","Tv","HardDrive","Cpu",
  "Book","BookOpen","GraduationCap","Pencil","NotebookPen",
  "Heart","Activity","Dumbbell","Pill","Stethoscope","Cross","Bandage",
  "Dog","Cat","PawPrint","Bird","Fish",
  "Baby","Users","User","UserPlus","Handshake",
  "Music","Clapperboard","Film","Mic","Ticket","PartyPopper",
  "Receipt","CreditCard","Wallet","Banknote","Coins","PiggyBank","TrendingUp","ShieldCheck",
  "Scissors","Sparkles","Star","Flame","Sun","Moon","Cloud","Droplet","Leaf","TreePine",
  "Briefcase","Building","Plug","Lightbulb","Phone","Mail","Globe","MapPin","Compass","Calendar","Clock",
  "Repeat","Undo2",
];
