import { supabase } from "@/lib/supabase";
import {
  DEFAULT_STATE,
  migrateCategoriesToV2,
  type BalanceState,
  type Favorite,
  type Loop,
  type Transaction,
} from "@/lib/ledger";

function mapTransactionRow(row: Record<string, any>): Transaction {
  return {
    id: row.id,
    title: row.title,
    note: row.note ?? null,
    amount: Number(row.amount ?? 0),
    category: row.category,
    icon: row.icon,
    direction: row.direction,
    paymentMethod: row.payment_method ?? "cash",
    timestamp: row.timestamp,
    lentTo: row.lent_to ?? null,
    repaid: row.repaid ?? null,
    repaymentOfId: row.repayment_of_id ?? null,
    items: row.items ?? null,
    sourceLoopId: row.source_loop_id ?? null,
  };
}

function mapFavoriteRow(row: Record<string, any>): Favorite {
  return {
    id: row.id,
    label: row.label,
    category: row.category,
    icon: row.icon,
    presetAmount: row.preset_amount ?? null,
    direction: row.direction ?? "out",
    paymentMethod: row.payment_method ?? "cash",
  };
}

function mapLoopRow(row: Record<string, any>): Loop {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon,
    category: row.category,
    amount: Number(row.amount ?? 0),
    direction: row.direction,
    paymentMethod: row.payment_method ?? "cash",
    recurrenceDayOfMonth: Number(row.recurrence_day_of_month ?? 1),
    lastAppliedDate: row.last_applied_date ?? null,
  };
}

function mapTransactionToRow(tx: Transaction, userId: string) {
  return {
    id: tx.id,
    user_id: userId,
    title: tx.title,
    note: tx.note ?? null,
    amount: tx.amount,
    category: tx.category,
    icon: tx.icon,
    direction: tx.direction,
    payment_method: tx.paymentMethod,
    timestamp: tx.timestamp,
    lent_to: tx.lentTo ?? null,
    repaid: tx.repaid ?? null,
    repayment_of_id: tx.repaymentOfId ?? null,
    items: tx.items ?? null,
    source_loop_id: tx.sourceLoopId ?? null,
  };
}

function mapFavoriteToRow(fav: Favorite, userId: string) {
  return {
    id: fav.id,
    user_id: userId,
    label: fav.label,
    category: fav.category,
    icon: fav.icon,
    preset_amount: fav.presetAmount ?? null,
    direction: fav.direction ?? "out",
    payment_method: fav.paymentMethod ?? "cash",
  };
}

function mapLoopToRow(loop: Loop, userId: string) {
  return {
    id: loop.id,
    user_id: userId,
    label: loop.label,
    icon: loop.icon,
    category: loop.category,
    amount: loop.amount,
    direction: loop.direction,
    payment_method: loop.paymentMethod,
    recurrence_day_of_month: loop.recurrenceDayOfMonth,
    last_applied_date: loop.lastAppliedDate ?? null,
  };
}

export async function hasCloudData(userId: string): Promise<boolean> {
  try {
    const { count, error: txError } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (txError) {
      console.error("Failed to check cloud transactions", txError);
      return false;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .eq("onboarding_complete", true)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to check cloud profile", profileError);
      return false;
    }

    return Boolean((count ?? 0) > 0 || profileData);
  } catch (error) {
    console.error("hasCloudData failed", error);
    return false;
  }
}

export async function pullFromCloud(userId: string): Promise<BalanceState> {
  try {
    const [{ data: profileData, error: profileError }, { data: txData, error: txError }, { data: favData, error: favError }, { data: loopData, error: loopError }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("transactions").select("*").eq("user_id", userId),
      supabase.from("favorites").select("*").eq("user_id", userId),
      supabase.from("loops").select("*").eq("user_id", userId),
    ]);

    if (profileError || txError || favError || loopError) {
      console.error("Failed to pull from cloud", { profileError, txError, favError, loopError });
      return { ...DEFAULT_STATE };
    }

    const profile = (profileData as Record<string, any> | null) ?? null;

    return {
      ...DEFAULT_STATE,
      balancesByMethod: profile?.balances_by_method ?? DEFAULT_STATE.balancesByMethod,
      lowBalanceAlertThreshold: profile?.low_balance_alert_threshold ?? DEFAULT_STATE.lowBalanceAlertThreshold,
      transactions: (txData ?? []).map((row: Record<string, any>) => mapTransactionRow(row)),
      favorites: (favData ?? []).map((row: Record<string, any>) => mapFavoriteRow(row)),
      loops: (loopData ?? []).map((row: Record<string, any>) => mapLoopRow(row)),
      categorizationOverrides: profile?.categorization_overrides ?? DEFAULT_STATE.categorizationOverrides,
      notificationsEnabled: profile?.notifications_enabled ?? DEFAULT_STATE.notificationsEnabled,
      lastWeeklyAnalyticsViewed: profile?.last_weekly_analytics_viewed ?? DEFAULT_STATE.lastWeeklyAnalyticsViewed,
      lastMonthlyAnalyticsViewed: profile?.last_monthly_analytics_viewed ?? DEFAULT_STATE.lastMonthlyAnalyticsViewed,
      userName: profile?.user_name ?? DEFAULT_STATE.userName,
      onboardingComplete: profile?.onboarding_complete ?? DEFAULT_STATE.onboardingComplete,
    };
  } catch (error) {
    console.error("pullFromCloud failed", error);
    return { ...DEFAULT_STATE };
  }
}

export async function pushToCloud(userId: string, state: BalanceState): Promise<void> {
  try {
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      user_name: state.userName,
      balances_by_method: state.balancesByMethod,
      low_balance_alert_threshold: state.lowBalanceAlertThreshold,
      categorization_overrides: state.categorizationOverrides,
      notifications_enabled: state.notificationsEnabled ?? false,
      last_weekly_analytics_viewed: state.lastWeeklyAnalyticsViewed,
      last_monthly_analytics_viewed: state.lastMonthlyAnalyticsViewed,
      onboarding_complete: state.onboardingComplete,
    }, { onConflict: "id" });

    if (profileError) {
      console.error("Failed to upsert profile", profileError);
      return;
    }

    // Transactions: upsert current ones, delete any that no longer exist locally
    const localTxIds = state.transactions.map((t) => t.id);
    if (state.transactions.length > 0) {
      const { error: txUpsertError } = await supabase
        .from("transactions")
        .upsert(state.transactions.map((tx) => mapTransactionToRow(tx, userId)), { onConflict: "id" });
      if (txUpsertError) console.error("Failed to push transactions", txUpsertError);
    }
    const txDeleteQuery = supabase.from("transactions").delete().eq("user_id", userId);
    const { error: txDeleteError } = localTxIds.length > 0
      ? await txDeleteQuery.not("id", "in", `(${localTxIds.join(",")})`)
      : await txDeleteQuery;
    if (txDeleteError) console.error("Failed to prune stale transactions", txDeleteError);

    // Favorites: same pattern
    const localFavIds = state.favorites.map((f) => f.id);
    if (state.favorites.length > 0) {
      const { error: favUpsertError } = await supabase
        .from("favorites")
        .upsert(state.favorites.map((fav) => mapFavoriteToRow(fav, userId)), { onConflict: "id" });
      if (favUpsertError) console.error("Failed to push favorites", favUpsertError);
    }
    const favDeleteQuery = supabase.from("favorites").delete().eq("user_id", userId);
    const { error: favDeleteError } = localFavIds.length > 0
      ? await favDeleteQuery.not("id", "in", `(${localFavIds.join(",")})`)
      : await favDeleteQuery;
    if (favDeleteError) console.error("Failed to prune stale favorites", favDeleteError);

    // Loops: same pattern
    const localLoopIds = state.loops.map((l) => l.id);
    if (state.loops.length > 0) {
      const { error: loopUpsertError } = await supabase
        .from("loops")
        .upsert(state.loops.map((loop) => mapLoopToRow(loop, userId)), { onConflict: "id" });
      if (loopUpsertError) console.error("Failed to push loops", loopUpsertError);
    }
    const loopDeleteQuery = supabase.from("loops").delete().eq("user_id", userId);
    const { error: loopDeleteError } = localLoopIds.length > 0
      ? await loopDeleteQuery.not("id", "in", `(${localLoopIds.join(",")})`)
      : await loopDeleteQuery;
    if (loopDeleteError) console.error("Failed to prune stale loops", loopDeleteError);
  } catch (error) {
    console.error("pushToCloud failed", error);
  }
}

export async function migrateCloudTransactionCategories(
  userId: string,
  categorizationOverrides: Record<string, string>,
): Promise<{ transactionsScanned: number; transactionsReassigned: number }> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;

  const cloudState = {
    ...DEFAULT_STATE,
    transactions: (data ?? []).map((row: Record<string, any>) => mapTransactionRow(row)),
    categorizationOverrides,
  };
  const { state: migratedState, stats } = migrateCategoriesToV2(cloudState);
  const changedTransactions = migratedState.transactions.filter((transaction, index) =>
    transaction.category !== cloudState.transactions[index].category ||
    transaction.icon !== cloudState.transactions[index].icon,
  );

  const results = await Promise.all(changedTransactions.map((transaction) =>
    supabase
      .from("transactions")
      .update({ category: transaction.category, icon: transaction.icon })
      .eq("id", transaction.id)
      .eq("user_id", userId),
  ));
  const updateError = results.find((result) => result.error)?.error;
  if (updateError) throw updateError;
  return stats;
}

export async function syncOnLogin(userId: string, localState: BalanceState): Promise<BalanceState> {
  try {
    const hasData = await hasCloudData(userId);
    if (hasData) {
      return await pullFromCloud(userId);
    }

    await pushToCloud(userId, localState);
    return localState;
  } catch (error) {
    console.error("syncOnLogin failed", error);
    return localState;
  }
}
