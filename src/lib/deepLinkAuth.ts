import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/lib/supabase";

export function setupDeepLinkAuth() {
  App.addListener("appUrlOpen", async ({ url }) => {
    if (url.includes("auth-callback")) {
      await Browser.close();
      const hash = url.split("#")[1];
      if (hash) {
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          window.location.href = "/login";
        }
      }
    }
  });
}