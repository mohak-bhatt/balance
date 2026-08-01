import { LocalNotifications } from "@capacitor/local-notifications";

const WEEKLY_NOTIFICATION_ID = 1001;
const MONTHLY_NOTIFICATION_ID = 1002;

const weeklyBodies = [
  "Last week's spending, decoded.",
  "Curious where your money went? Peek inside.",
  "Your weekly money recap just dropped.",
];

const monthlyBodies = [
  "A whole month of spending, summarized.",
  "See how this month stacked up.",
  "Your monthly money story is ready to read.",
];

function pickRandom(bodyPool: string[]) {
  return bodyPool[Math.floor(Math.random() * bodyPool.length)] ?? bodyPool[0];
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const result = await LocalNotifications.requestPermissions();
    return result.display === "granted";
  } catch {
    return false;
  }
}

export async function scheduleWeeklyNotification(): Promise<void> {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: WEEKLY_NOTIFICATION_ID,
          title: "Your weekly report is ready 📊",
          body: pickRandom(weeklyBodies),
          extra: { type: "weekly" },
          schedule: { on: { weekday: 2, hour: 9, minute: 0 }, repeats: true },
        },
      ],
    });
  } catch (error) {
    console.error("Failed to schedule weekly notification", error);
  }
}

export async function scheduleMonthlyNotification(): Promise<void> {
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: MONTHLY_NOTIFICATION_ID,
          title: "Your monthly report is ready 📈",
          body: pickRandom(monthlyBodies),
          extra: { type: "monthly" },
          schedule: { on: { day: 1, hour: 9, minute: 0 }, repeats: true },
        },
      ],
    });
  } catch (error) {
    console.error("Failed to schedule monthly notification", error);
  }
}

export async function cancelWeeklyNotification(): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: WEEKLY_NOTIFICATION_ID }] });
  } catch (error) {
    console.error("Failed to cancel weekly notification", error);
  }
}

export async function cancelMonthlyNotification(): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: MONTHLY_NOTIFICATION_ID }] });
  } catch (error) {
    console.error("Failed to cancel monthly notification", error);
  }
}

export function setupNotificationTapListener(
  navigate: (opts: { to: string; search?: any }) => void,
) {
  return LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
    const type = action.notification.extra?.type;
    if (type === "weekly") {
      navigate({ to: "/analytics", search: { tab: "weekly" } });
    }
    if (type === "monthly") {
      navigate({ to: "/analytics", search: { tab: "monthly" } });
    }
  });
}
