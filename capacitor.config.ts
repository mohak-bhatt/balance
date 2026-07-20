import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mackieb.balance",
  appName: "Balance",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#00000000",
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#00000000",
      overlaysWebView: true,
    },
  },
};

export default config;