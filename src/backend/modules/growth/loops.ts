export const growthLoops = {
  referral: {
    trigger: "successful_purchase",
    rewardModel: "double_sided",
    antiFraudChecks: ["device_fingerprint", "velocity", "same_payment_source"],
  },
  affiliate: {
    trigger: "attributed_conversion",
    payoutModel: "tiered_commission",
  },
  ambassador: {
    trigger: "milestone_challenge_completion",
    rewardModel: "points_and_unlocks",
  },
  socialProof: {
    trigger: "verified_order_review",
    effect: "auto_ugc_distribution",
  },
} as const;