import posthog from "posthog-js";

const POSTHOG_KEY = process.env.REACT_APP_POSTHOG_KEY || "phc_PLACEHOLDER";
const POSTHOG_HOST = "https://eu.i.posthog.com";

export function initPostHog() {
  if (!POSTHOG_KEY || POSTHOG_KEY === "phc_PLACEHOLDER") {
    console.warn("[PostHog] No API key set — analytics disabled");
    return;
  }
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    session_recording: { maskAllInputs: false },
    autocapture: true,
  });
}

// ── Identity ──────────────────────────────────────────────────────────────────

export function identifyUser(user) {
  if (!user) return;
  posthog.identify(user.id || user._id, {
    email: user.email,
    name: user.name,
    plan: user.is_premium ? "premium" : "free",
    conditions: (user.conditions || []).join(","),
    created_at: user.created_at,
  });
}

export function resetUser() {
  posthog.reset();
}

// ── Helper ────────────────────────────────────────────────────────────────────

function track(event, props = {}) {
  try {
    posthog.capture(event, props);
  } catch (e) {
    // Never throw from analytics
  }
}

// ── Auth & Onboarding ─────────────────────────────────────────────────────────

export const ph = {
  // Auth
  userSignedUp: (user) =>
    track("user_signed_up", {
      email: user.email,
      conditions: (user.conditions || []).join(","),
    }),
  userLoggedIn: () => track("user_logged_in"),
  userLoggedOut: () => track("user_logged_out"),
  userDeletedAccount: () => track("user_deleted_account"),
  passwordResetRequested: () => track("password_reset_requested"),

  // Onboarding
  onboardingStepViewed: (step_name, step_number) =>
    track("onboarding_step_viewed", { step_name, step_number }),
  onboardingCompleted: (conditions, goals) =>
    track("onboarding_completed", {
      conditions: (conditions || []).join(","),
      goals: (goals || []).join(","),
    }),
  conditionSelected: (condition) =>
    track("condition_selected", { condition }),

  // Food scanning & search
  barcodeScannerOpened: () => track("barcode_scanner_opened"),
  barcodeScanned: (food_name, barcode) =>
    track("barcode_scanned", { food_name, barcode }),
  barcodeScanFailed: (reason) =>
    track("barcode_scan_failed", { reason }),
  foodSearched: (query) => track("food_searched", { query }),
  foodNotFound: (query) => track("food_not_found", { query }),
  manualFoodEntryStarted: (barcode) =>
    track("manual_food_entry_started", { barcode }),

  // Ratings & results
  ratingViewed: (rating) =>
    track("rating_viewed", {
      food_name: rating.food_name || rating.name,
      overall_score: rating.overallScore,
      naturalness: rating.dimensions?.naturalness?.score,
      hormonal_impact: rating.dimensions?.hormonalImpact?.score,
      inflammation: rating.dimensions?.inflammation?.score,
      gut_health: rating.dimensions?.gutHealth?.score,
    }),
  ratingSaved: (food_name, overall_score) =>
    track("rating_saved", { food_name, overall_score }),
  ratingShared: (food_name, overall_score) =>
    track("rating_shared", { food_name, overall_score }),
  ingredientDetailExpanded: (food_name, dimension) =>
    track("ingredient_detail_expanded", { food_name, dimension }),
  recommendationClicked: (food_name, alternative_name) =>
    track("recommendation_clicked", { food_name, alternative_name }),
  quickPickClicked: (food_name) =>
    track("quick_pick_clicked", { food_name }),
  favouriteToggled: (food_name, saved) =>
    track("favourite_toggled", { food_name, saved }),

  // Diary
  diaryOpened: () => track("diary_opened"),
  diaryEntryAdded: (food_name, overall_score) =>
    track("diary_entry_added", { food_name, overall_score }),
  diaryEntryDeleted: (food_name) =>
    track("diary_entry_deleted", { food_name }),
  diaryDateChanged: (date) => track("diary_date_changed", { date }),
  diaryLockedHit: () => track("diary_locked_hit"),

  // Symptom tracker
  symptomCheckinOpened: () => track("symptom_checkin_opened"),
  symptomCheckinCompleted: (scores) =>
    track("symptom_checkin_completed", scores),

  // Meal planner
  mealPlannerOpened: () => track("meal_planner_opened"),
  mealPlannerMealRated: (meal_name) =>
    track("meal_planner_meal_rated", { meal_name }),

  // My Foods
  myFoodsTabChanged: (tab) => track("my_foods_tab_changed", { tab }),
  historyItemRerated: (food_name) =>
    track("history_item_rerated", { food_name }),
  shoppingItemAdded: (name) =>
    track("shopping_item_added", { name }),
  shoppingItemChecked: (item_id) =>
    track("shopping_item_checked", { item_id }),

  // Paywall & subscription
  paywallHit: (trigger) => track("paywall_hit", { trigger }),
  upgradeModalViewed: (trigger) =>
    track("upgrade_modal_viewed", { trigger }),
  upgradeCTAClicked: (plan) =>
    track("upgrade_cta_clicked", { plan }),
  freeTrialStarted: (plan) =>
    track("free_trial_started", { plan }),
  referralLinkCopied: () => track("referral_link_copied"),
  referralLinkShared: () => track("referral_link_shared"),
  manageSubscriptionClicked: () => track("manage_subscription_clicked"),

  // Navigation
  tabChanged: (tab_name) => track("tab_changed", { tab_name }),
  profileViewed: () => track("profile_viewed"),
  insightsViewed: () => track("insights_viewed"),
  insightsSectionChanged: (section) =>
    track("insights_section_changed", { section }),

  // Errors
  apiError: (endpoint, error_message, status) =>
    track("api_error", { endpoint, error_message, status }),
  scanLimitReached: () => track("scan_limit_reached"),
  networkError: (context) => track("network_error", { context }),
};
