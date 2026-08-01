import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Apple } from "lucide-react";
import { motion } from "framer-motion";
import { NOTHING_YELLOW } from "@/components/YellowArrow";
import { loadState, saveState } from "@/lib/ledger";
import { supabase } from "@/lib/supabase";
import { syncOnLogin } from "@/lib/sync";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — Balance" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checkedSession, setCheckedSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
      setCheckedSession(true);
    });
  }, []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUserEmail(session.user.email ?? null);
        const localState = loadState();
        const synced = await syncOnLogin(session.user.id, localState);
        saveState(synced);
      }
      if (event === "SIGNED_OUT") {
        setUserEmail(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const logOut = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <button
        onClick={() => navigate({ to: "/settings" })}
        className="absolute top-[52px] left-5 grid h-10 w-10 place-items-center -ml-2"
      >
        <ChevronLeft size={22} strokeWidth={1.5} />
      </button>

      <div className="min-h-screen flex items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 32, mass: 0.8 }}
          className="w-full max-w-md rounded-[32px] border border-white/10 bg-white/5 px-6 py-8 shadow-[0_20px_80px_rgba(0,0,0,0.35)]"
        >
          {!checkedSession ? null : userEmail ? (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="grid h-16 w-16 place-items-center rounded-full" style={{ background: "rgba(52,211,153,0.15)" }}>
                <Check size={28} strokeWidth={2} className="text-emerald-400" />
              </div>
              <p className="font-mono-display text-2xl font-bold text-white">You're logged in</p>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
              <button
                type="button"
                onClick={() => navigate({ to: "/settings" })}
                className="mt-2 w-full rounded-full py-3 text-sm font-medium text-black"
                style={{ background: NOTHING_YELLOW }}
              >
                OK
              </button>
              <button
                type="button"
                onClick={logOut}
                className="text-xs text-red-400 underline"
              >
                Log out
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-6 text-center">
                <p className="font-mono-display text-4xl font-bold leading-none text-white text-center">BALANCE</p>
              </div>

              <p className="mt-6 text-sm text-muted-foreground text-center">
                Connect your account to sync transactions, favourites, loops, history, settings and personalisation across your devices.
              </p>

              <div className="mt-8 space-y-3">
                <button
                  type="button"
                  onClick={async () => {
                    const isNative = window.location.protocol === "capacitor:" || (window as any).Capacitor?.isNativePlatform?.();
                    if (isNative) {
                      const { Browser } = await import("@capacitor/browser");
                      const { data } = await supabase.auth.signInWithOAuth({
                        provider: "google",
                        options: {
                          redirectTo: "com.mackieb.balance://auth-callback",
                          skipBrowserRedirect: true,
                        },
                      });
                      if (data?.url) await Browser.open({ url: data.url });
                    } else {
                      await supabase.auth.signInWithOAuth({
                        provider: "google",
                        options: {
                          redirectTo: window.location.origin + "/login",
                        },
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
                  Continue with Google
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-3 rounded-full bg-white/10 px-4 py-3 text-sm font-medium transition hover:bg-white/15"
                >
                  <Apple size={18} /> Continue with Apple
                </button>
              </div>

              <button
                type="button"
                onClick={() => navigate({ to: "/settings" })}
                className="mt-4 w-full text-xs text-muted-foreground underline text-center"
              >
                I don't want to sync my data
              </button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}