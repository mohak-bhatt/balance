import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { loadState, saveState, type BalancesByMethod, type PaymentMethod, type Transaction } from "@/lib/ledger";
import { initials, loadAvatar, saveAvatar } from "@/lib/avatar";
import { YellowArrowButton, YellowPillButton } from "@/components/YellowArrow";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";


export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — Balance" }] }),
  component: Onboarding,
});

const SPRING = { type: "spring" as const, stiffness: 150, damping: 15 };
const FADE_SPRING = { type: "spring" as const, stiffness: 200, damping: 22 };

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...FADE_SPRING, delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const nameRef = useRef<HTMLInputElement>(null);
  const balanceRefs = useRef<Record<PaymentMethod, HTMLInputElement | null>>({
    cash: null, upi: null, card: null, netbanking: null, other: null,
  });
  const capturedBalancesRef = useRef<BalancesByMethod>({
    cash: 0, upi: 0, card: 0, netbanking: 0, other: 0,
  });
  const [committedName, setCommittedName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const next = () => { setDir(1); setStep((s) => s + 1); };
  const prev = () => { setDir(-1); setStep((s) => Math.max(0, s - 1)); };

  const finish = async () => {
    const s = loadState();
    saveState({
      ...s,
      userName: committedName,
      onboardingComplete: true,
    });
    localStorage.setItem("balance:startTutorial", "1");
    navigate({ to: "/" });
  };

  const persistBalances = (): boolean => {
    const captured: BalancesByMethod = { cash: 0, upi: 0, card: 0, netbanking: 0, other: 0 };
    let sum = 0;
    for (const k of Object.keys(balanceRefs.current) as PaymentMethod[]) {
      const v = balanceRefs.current[k]?.value ?? "";
      const amt = parseFloat(v);
      const safe = Number.isFinite(amt) ? Math.max(0, amt) : 0;
      captured[k] = safe;
      sum += safe;
    }
    if (sum <= 0) {
      setBalanceError("Enter at least one balance to continue");
      return false;
    }
    capturedBalancesRef.current = captured;

    const s = loadState();
    const nonOpening = s.transactions.filter((t) => t.category !== "opening_balance");
    const now = new Date().toISOString();
    const openingTx: Transaction[] = [];
    for (const k of Object.keys(captured) as PaymentMethod[]) {
      if (captured[k] > 0) {
        openingTx.push({
          id: crypto.randomUUID(),
          title: "Opening balance",
          note: null,
          amount: captured[k],
          category: "opening_balance",
          icon: "Wallet",
          direction: "in",
          paymentMethod: k,
          timestamp: now,
        });
      }
    }
    saveState({
      ...s,
      balancesByMethod: captured,
      transactions: [...openingTx, ...nonOpening],
    });

    setBalanceError(null);
    return true;
  };

  const onPickFile = async (f: File) => {
    setError(null);
    if (f.size > 20 * 1024 * 1024) { setError("Image must be under 20MB"); return; }
    await saveAvatar(f);
    setAvatar(await loadAvatar());
  };

  const Step = ({ children }: { children: React.ReactNode }) => (
    <motion.div
      key={step}
      initial={{ x: dir * 80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -dir * 80, opacity: 0 }}
      transition={SPRING}
      className="absolute inset-0 flex flex-col px-6 pb-10"
      style={{ paddingTop: 28 + 48 }}
    >
      {children}
    </motion.div>
  );

  const ArrowFooter = ({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) => {
    const kb = useKeyboardOffset();
    return (
      <div
        className="mt-auto flex justify-center pt-6 transition-[padding] duration-150"
        style={{ paddingBottom: kb ? kb + 12 : 0 }}
      >
        <YellowArrowButton onClick={onClick} disabled={disabled} />
      </div>
    );
  };

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md overflow-hidden bg-black">
      <AnimatePresence mode="wait" custom={dir}>

        {step === 0 && (
          <Step>
            <div className="m-auto flex flex-col items-center text-center">
              <FadeUp delay={0}>
                <p className="text-sm tracking-wide text-muted-foreground">Welcome to</p>
              </FadeUp>
              <FadeUp delay={100}>
                <p className="mt-3 font-mono-display text-6xl font-bold leading-none text-white">
                  BALANCE
                </p>
              </FadeUp>
            </div>
            <FadeUp delay={200}>
              <ArrowFooter onClick={next} />
            </FadeUp>
          </Step>
        )}

        {step === 1 && (
          <Step>
            <h1 className="font-mono-display text-3xl">What should we call you?</h1>
            <input
              ref={nameRef}
              autoFocus
              defaultValue={committedName}
              placeholder="Your name"
              className="mt-10 w-full border-b border-white/15 bg-transparent pb-3 font-mono-display text-2xl outline-none focus:border-white/50"
            />
            <ArrowFooter
              onClick={() => {
                const v = (nameRef.current?.value ?? "").trim();
                if (!v) return;
                setCommittedName(v);
                next();
              }}
            />
          </Step>
        )}

        {step === 2 && (
          <Step>
            <h1 className="font-mono-display text-3xl">Add a profile photo</h1>
            <FadeUp delay={0}>
              <div className="mt-10 flex justify-center">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="relative grid h-32 w-32 place-items-center overflow-hidden rounded-full border border-white/15"
                >
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Camera size={28} strokeWidth={1.2} />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.target.value = ""; }}
                />
              </div>
            </FadeUp>
            {error && <p className="mt-3 text-center text-xs text-red-400">{error}</p>}
            <button onClick={next} className="mt-6 self-center text-sm text-muted-foreground underline">Skip</button>
            <ArrowFooter onClick={next} />
          </Step>
        )}

        {step === 3 && (
          <Step>
            <h1 className="font-mono-display text-2xl">How much money do you have right now?</h1>
            <p className="mt-2 text-sm text-muted-foreground">Enter what you have in each — skip any that don't apply.</p>
            <div className="mt-6 space-y-3">
              {(["cash", "upi", "card", "netbanking", "other"] as PaymentMethod[]).map((k) => (
                <div key={k} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                  <span className="text-sm capitalize">{k === "netbanking" ? "Net Banking" : k.toUpperCase()}</span>
                  <input
                    ref={(el) => { balanceRefs.current[k] = el; }}
                    inputMode="decimal"
                    defaultValue=""
                    placeholder="0"
                    className="w-28 bg-transparent text-right font-mono-display text-base outline-none"
                  />
                </div>
              ))}
            </div>
            {balanceError && (
              <p className="mt-3 text-center text-[11px] text-red-400">{balanceError}</p>
            )}
            <ArrowFooter
              onClick={() => {
                if (persistBalances()) next();
              }}
            />
          </Step>
        )}

        {step === 4 && (
          <Step>
            <h1 className="font-mono-display text-2xl">Stay on top of your spending</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Balance can notify you when your weekly and monthly analytics are ready.
            </p>
            <div className="mt-auto space-y-3">
              <button
                onClick={async () => {
                  let allowed = false;
                  if (typeof Notification !== "undefined") {
                    try { allowed = (await Notification.requestPermission()) === "granted"; } catch { /* */ }
                  }
                  const s = loadState(); saveState({ ...s, notificationsEnabled: allowed });
                  next();
                }}
                className="w-full rounded-2xl bg-white py-4 text-base font-medium text-black"
              >
                Allow notifications
              </button>
              <button
                onClick={() => { const s = loadState(); saveState({ ...s, notificationsEnabled: false }); next(); }}
                className="w-full rounded-2xl border border-white/15 py-4 text-base"
              >
                Not now
              </button>
            </div>
          </Step>
        )}

        {step === 5 && (
          <Step>
            <div className="m-auto flex flex-col items-center text-center">
              <FadeUp delay={0}>
                <p className="text-sm tracking-wide text-muted-foreground">All set,</p>
              </FadeUp>
              <FadeUp delay={100}>
                <p className="mt-3 font-mono-display text-5xl font-bold leading-none text-white">
                  {committedName || "friend"}!
                </p>
              </FadeUp>
              {avatar && (
                <FadeUp delay={150}>
                  <div className="mt-10 grid h-20 w-20 place-items-center overflow-hidden rounded-full border border-white/15">
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  </div>
                </FadeUp>
              )}
              {!avatar && committedName && (
                <FadeUp delay={150}>
                  <div className="mt-10 grid h-20 w-20 place-items-center overflow-hidden rounded-full border border-white/15">
                    <span className="font-mono-display text-2xl">{initials(committedName)}</span>
                  </div>
                </FadeUp>
              )}
            </div>
            <FadeUp delay={200}>
              <div className="mt-auto pt-6">
                <YellowPillButton onClick={finish}>Hop In</YellowPillButton>
              </div>
            </FadeUp>
          </Step>
        )}
      </AnimatePresence>

      <div className="h-screen" />
      {step > 0 && step < 5 && (
        <button onClick={prev} className="absolute left-6 z-10 text-xs uppercase tracking-[0.18em] text-muted-foreground" style={{ top: 28 + 4 }}>
          Back
        </button>
      )}
    </div>
  );
}



