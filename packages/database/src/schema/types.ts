import type {
  apiKeys,
  accounts,
  auditLogs,
  billingEvents,
  emotionalEvents,
  emotionalMemories,
  emotionPredictions,
  emotionalProfiles,
  emotionalStates,
  emotionFeedback,
  modelParameters,
  modelVersions,
  organizationMembers,
  organizations,
  projects,
  sessions,
  subscriptions,
  usageRecords,
  users,
  verifications,
} from './tables';

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuthSession = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type EmotionalProfile = typeof emotionalProfiles.$inferSelect;
export type NewEmotionalProfile = typeof emotionalProfiles.$inferInsert;
export type EmotionalEvent = typeof emotionalEvents.$inferSelect;
export type NewEmotionalEvent = typeof emotionalEvents.$inferInsert;
export type EmotionalState = typeof emotionalStates.$inferSelect;
export type NewEmotionalState = typeof emotionalStates.$inferInsert;
export type EmotionalMemory = typeof emotionalMemories.$inferSelect;
export type NewEmotionalMemory = typeof emotionalMemories.$inferInsert;
export type EmotionPrediction = typeof emotionPredictions.$inferSelect;
export type NewEmotionPrediction = typeof emotionPredictions.$inferInsert;
export type EmotionFeedback = typeof emotionFeedback.$inferSelect;
export type NewEmotionFeedback = typeof emotionFeedback.$inferInsert;
export type ModelVersion = typeof modelVersions.$inferSelect;
export type NewModelVersion = typeof modelVersions.$inferInsert;
export type ModelParameter = typeof modelParameters.$inferSelect;
export type NewModelParameter = typeof modelParameters.$inferInsert;
export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type BillingEvent = typeof billingEvents.$inferSelect;
export type NewBillingEvent = typeof billingEvents.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
