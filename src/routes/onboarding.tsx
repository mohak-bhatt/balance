import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { loadState, saveState, type BalancesByMethod, type PaymentMethod, type Transaction } from "@/lib/ledger";
import { initials, loadAvatar, saveAvatar } from "@/lib/avatar";
import { YellowArrowButton, YellowPillButton } from "@/components/YellowArrow";
import { TextGenerateEffect } from "@/components/TextGenerateEffect";
import { CropImageSheet } from "@/components/CropImageSheet";
import { GreyscaleGradientBackground } from "@/components/GreyscaleGradientBackground";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import { supabase } from "@/lib/supabase";
import { syncOnLogin } from "@/lib/sync";
import { requestNotificationPermission, scheduleWeeklyNotification, scheduleMonthlyNotification } from "@/lib/notifications";


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
      transition={{ ...FADE_SPRING, duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const kb = useKeyboardOffset();
  const [step, setStep] = useState(1);
  const [showLoginOptions, setShowLoginOptions] = useState(false);
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
    const [cropFile, setCropFile] = useState<File | null>(null);
  const hasHandledSignIn = useRef(false);
  const [loginEmail, setLoginEmail] = useState<string | null>(null);
  const [loginChecking, setLoginChecking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const onPickFile = (file: File) => {
    setError(null);
    if (file.size > 20 * 1024 * 1024) { setError("Image must be under 20MB"); return; }
    setCropFile(file);
  };

  useEffect(() => {
    if (step === 1 && !loginEmail) {
      setShowLoginOptions(true);
    }
  }, [step, loginEmail]);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user && !hasHandledSignIn.current) {
        hasHandledSignIn.current = true;
        setLoginChecking(true);
        setLoginEmail(session.user.email ?? null);
        const local = loadState();
        const synced = await syncOnLogin(session.user.id, local);
        saveState(synced);
        if (synced.userName) setCommittedName(synced.userName);
        setLoginChecking(false);
        setTimeout(() => next(), 1400);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user && step === 1 && !hasHandledSignIn.current) {
        hasHandledSignIn.current = true;
        setLoginEmail(data.session.user.email ?? null);
        setStep(1);
        syncOnLogin(data.session.user.id, loadState()).then((synced) => {
          saveState(synced);
          if (synced.userName) setCommittedName(synced.userName);
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = () => { setDir(1); setStep((s) => s + 1); };
  const prev = () => { setDir(-1); setStep((s) => Math.max(0, s - 1)); };

  const [finishing, setFinishing] = useState(false);

  const finish = async () => {
    const s = loadState();
    saveState({
      ...s,
      userName: committedName,
      onboardingComplete: true,
    });
    localStorage.setItem("balance:startTutorial", "1");
    setFinishing(true);
    setTimeout(() => navigate({ to: "/" }), 500);
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
        <motion.div
          initial={{ opacity: 0, scale: 0.7, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.5 }}
          className="w-full"
        >
          <YellowArrowButton onClick={onClick} disabled={disabled} />
        </motion.div>
      </div>
    );
  };

  const prefillName = committedName || loginEmail?.split("@")[0] || "";

  return (
    <motion.div
      animate={{ opacity: finishing ? 0 : 1, filter: finishing ? "blur(12px)" : "blur(0px)" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto min-h-screen w-full max-w-md overflow-hidden bg-black"
    >
      <GreyscaleGradientBackground speedKey={step} />
      <AnimatePresence mode="wait" custom={dir}>

        {step === 1 && (
          <Step>
            {loginEmail ? (
              <div
                className="flex flex-1 flex-col items-center justify-center text-center gap-4"
                style={{ transform: kb ? `translateY(-${Math.round(kb * 0.5)}px)` : undefined, transition: "transform 0.2s ease" }}
              >
                <div className="grid h-16 w-16 place-items-center rounded-full" style={{ background: "rgba(52,211,153,0.15)" }}>
                  <Check size={28} strokeWidth={2} className="text-emerald-400" />
                </div>
                <TextGenerateEffect text="You're now logged in" className="mt-3 font-mono-display text-xl text-center" wordDelay={0.12} />
                <p className="text-sm text-muted-foreground">{loginEmail}</p>
              </div>
            ) : (
              <div
                className="flex flex-1 flex-col items-center justify-center text-center w-full"
                style={{ transform: kb ? `translateY(-${Math.round(kb * 0.5)}px)` : undefined, transition: "transform 0.2s ease" }}
              >
                <AnimatePresence mode="wait">
                  {showLoginOptions && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 16 }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full space-y-6"
                    >
                      <div className="flex flex-col items-center">
                        <FadeUp delay={0}>
                          <TextGenerateEffect
                            text="Welcome to"
                            className="text-sm tracking-wide text-muted-foreground"
                            wordDelay={0.12}
                          />
                        </FadeUp>
                        <FadeUp delay={180}>
                          <TextGenerateEffect text="BALANCE" className="mt-3 font-mono-display text-6xl font-bold leading-none text-white" wordDelay={0.22} />
                        </FadeUp>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const isNative = window.location.protocol === "capacitor:" || (window as any).Capacitor?.isNativePlatform?.();
                          if (isNative) {
                            const { Browser } = await import("@capacitor/browser");
                            const { data } = await supabase.auth.signInWithOAuth({
                              provider: "google",
                              options: { redirectTo: "com.mackieb.balance://auth-callback", skipBrowserRedirect: true },
                            });
                            if (data?.url) await Browser.open({ url: data.url });
                          } else {
                            await supabase.auth.signInWithOAuth({
                              provider: "google",
                              options: { redirectTo: window.location.origin + "/onboarding" },
                            });
                          }
                        }}
                        className="flex w-full items-center justify-center gap-3 rounded-full bg-white/10 px-4 py-3 text-sm font-medium transition hover:bg-white/15"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                          <path d="M17.64 9.2045C17.64 8.56636 17.58 7.96227 17.4655 7.38636H9V10.8364H13.8445C13.7064 11.9364 13.0645 12.8364 12.09 13.45V15.6027H14.9318C16.67 14.0845 17.64 11.88 17.64 9.2045Z" fill="#4285F4"/>
                          <path d="M9 17.9999C11.43 17.9999 13.4355 17.0845 14.9318 15.6028L12.09 13.45C11.3373 14.0127 10.33 14.3318 9 14.3318C6.63818 14.3318 4.61545 12.8973 3.78182 10.8418H0.892273V13.0068C2.39 15.9827 5.46 17.9999 9 17.9999Z" fill="#34A853"/>
                          <path d="M3.78182 10.8418C3.61818 10.266 3.54545 9.65727 3.54545 9.00009C3.54545 8.34291 3.61818 7.73418 3.78182 7.15836V4.99336H0.892273C0.234091 6.26545 0 7.60818 0 9.00009C0 10.392 0.234091 11.7347 0.892273 13.0068L3.78182 10.8418Z" fill="#FBBC05"/>
                          <path d="M9 3.66818C10.2355 3.66818 11.3273 4.11818 12.1636 4.98091L14.9855 2.15909C13.4336 0.75 11.43 0 9 0C5.46 0 2.39 2.01818 0.892273 4.99364L3.78182 7.15864C4.61545 5.10318 6.63818 3.66818 9 3.66818Z" fill="#EA4335"/>
                        </svg>
                        <TextGenerateEffect text="Continue with Google" className="text-sm font-medium" wordDelay={0.12} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            {loginEmail && <ArrowFooter onClick={next} />}
          </Step>
        )}

        {step === 2 && (
          <Step>
            <div className="m-auto flex flex-col items-center text-center w-full" style={{ transform: kb ? `translateY(-${Math.round(kb * 0.5)}px)` : undefined, transition: "transform 0.2s ease" }}>
              <div className="px-4 text-center">
                <h1 className="font-mono-display text-xl text-center">
                  <TextGenerateEffect text="What should we call you?" className="font-mono-display text-xl" wordDelay={0.12} />
                </h1>
              </div>
              <input
                ref={nameRef}
                autoFocus
                defaultValue={prefillName}
                placeholder="Your name"
                className="mt-10 mx-auto w-full max-w-[14rem] border-b border-white/15 bg-transparent pb-3 text-center font-mono-display text-2xl outline-none focus:border-white/50"
              />
            </div>
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

        {step === 3 && (
          <Step>
            <div className="m-auto flex flex-col items-center text-center w-full" style={{ transform: kb ? `translateY(-${Math.round(kb * 0.5)}px)` : undefined, transition: "transform 0.2s ease" }}>
              <h1 className="font-mono-display text-xl text-center">
                <TextGenerateEffect text="Add a profile photo" className="font-mono-display text-xl" wordDelay={0.12} />
              </h1>
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
            </div>
            <button onClick={next} className="mt-6 self-center text-sm text-muted-foreground underline">Skip</button>
            <ArrowFooter onClick={next} />
          </Step>
        )}

        {step === 4 && (
          <Step>
            <div className="m-auto flex flex-col items-center text-center w-full" style={{ transform: kb ? `translateY(-${Math.round(kb * 0.5)}px)` : undefined, transition: "transform 0.2s ease" }}>
              <h1 className="font-mono-display text-2xl">
                <TextGenerateEffect text="How much money do you have right now?" className="font-mono-display text-2xl" wordDelay={0.12} />
              </h1>
              <TextGenerateEffect text="Enter what you have in each — skip any that don't apply." className="mt-2 text-sm text-muted-foreground" wordDelay={0.12} />
              <div className="mt-6 w-full space-y-3">
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
            </div>
            <ArrowFooter
              onClick={() => {
                if (persistBalances()) next();
              }}
            />
          </Step>
        )}

        {step === 5 && (
          <Step>
            <div className="m-auto flex flex-col items-center text-center w-full" style={{ transform: kb ? `translateY(-${Math.round(kb * 0.5)}px)` : undefined, transition: "transform 0.2s ease" }}>
              <h1 className="font-mono-display text-2xl">
                <TextGenerateEffect text="Stay on top of your spending" className="font-mono-display text-2xl" wordDelay={0.12} />
              </h1>
              <TextGenerateEffect text="Balance can notify you when your weekly and monthly analytics are ready." className="mt-3 text-sm text-muted-foreground" wordDelay={0.12} />
            </div>
            <div className="mt-auto space-y-3">
              <button
                onClick={async () => {
                  const granted = await requestNotificationPermission();
                  if (granted) {
                    await scheduleWeeklyNotification();
                    await scheduleMonthlyNotification();
                  }
                  const s = loadState();
                  saveState({ ...s, weeklyNotificationsEnabled: granted, monthlyNotificationsEnabled: granted });
                  next();
                }}
                className="w-full rounded-2xl bg-white py-4 text-base font-medium text-black"
              >
                <TextGenerateEffect text="Allow notifications" className="text-base font-medium text-black" wordDelay={0.12} />
              </button>
              <button
                onClick={() => {
                  const s = loadState();
                  saveState({ ...s, weeklyNotificationsEnabled: false, monthlyNotificationsEnabled: false });
                  next();
                }}
                className="w-full rounded-2xl border border-white/15 py-4 text-base"
              >
                <TextGenerateEffect text="Not now" className="text-base text-white" wordDelay={0.12} />
              </button>
            </div>
          </Step>
        )}

        {step === 6 && (
          <Step>
            <div className="m-auto flex flex-col items-center text-center">
              <FadeUp delay={0}>
                <TextGenerateEffect text="All set," className="text-sm tracking-wide text-muted-foreground" wordDelay={0.12} />
              </FadeUp>
              <FadeUp delay={180}>
                <TextGenerateEffect text={`${committedName || "friend"}!`} className="mt-3 font-mono-display text-5xl font-bold leading-none text-white" wordDelay={0.22} />
              </FadeUp>
              {avatar && (
                <FadeUp delay={270}>
                  <div className="mt-10 grid h-20 w-20 place-items-center overflow-hidden rounded-full border border-white/15">
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  </div>
                </FadeUp>
              )}
              {!avatar && committedName && (
                <FadeUp delay={270}>
                  <div className="mt-10 grid h-20 w-20 place-items-center overflow-hidden rounded-full border border-white/15">
                    <span className="font-mono-display text-2xl">{initials(committedName)}</span>
                  </div>
                </FadeUp>
              )}
            </div>
            <FadeUp delay={360}>
              <div className="mt-auto pt-6">
                <YellowPillButton onClick={finish}>
                  <TextGenerateEffect text="Hop In" className="text-sm font-bold uppercase tracking-[0.2em] text-black" wordDelay={0.12} />
                </YellowPillButton>
              </div>
            </FadeUp>
          </Step>
        )}
      </AnimatePresence>

      <div className="h-screen" />
      {step > 1 && step < 6 && (
        <button onClick={prev} className="absolute left-6 z-10 text-xs uppercase tracking-[0.18em] text-muted-foreground" style={{ top: 28 + 4 }}>
          Back
        </button>
      )}
      <CropImageSheet
        file={cropFile}
        onCancel={() => setCropFile(null)}
        onComplete={async (blob) => {
          await saveAvatar(blob);
          setAvatar(await loadAvatar());
          setCropFile(null);
        }}
      />
    </motion.div>
  );
}