import { relations } from 'drizzle-orm';

import {
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

export const usersRelations = relations(users, ({ many }) => ({
  organizationMembers: many(organizationMembers),
  auditLogs: many(auditLogs),
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const verificationsRelations = relations(verifications, () => ({}));

export const organizationsRelations = relations(
  organizations,
  ({ many }) => ({
    members: many(organizationMembers),
    projects: many(projects),
    usageRecords: many(usageRecords),
    subscriptions: many(subscriptions),
    billingEvents: many(billingEvents),
    auditLogs: many(auditLogs),
  }),
);

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationMembers.userId],
      references: [users.id],
    }),
  }),
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  apiKeys: many(apiKeys),
  emotionalProfiles: many(emotionalProfiles),
  emotionalEvents: many(emotionalEvents),
  emotionalStates: many(emotionalStates),
  emotionalMemories: many(emotionalMemories),
  emotionPredictions: many(emotionPredictions),
  emotionFeedback: many(emotionFeedback),
  usageRecords: many(usageRecords),
}));

export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  project: one(projects, {
    fields: [apiKeys.projectId],
    references: [projects.id],
  }),
  usageRecords: many(usageRecords),
}));

export const emotionalProfilesRelations = relations(
  emotionalProfiles,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [emotionalProfiles.projectId],
      references: [projects.id],
    }),
    emotionalEvents: many(emotionalEvents),
    emotionalStates: many(emotionalStates),
    emotionalMemories: many(emotionalMemories),
    emotionPredictions: many(emotionPredictions),
    emotionFeedback: many(emotionFeedback),
  }),
);

export const emotionalEventsRelations = relations(
  emotionalEvents,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [emotionalEvents.projectId],
      references: [projects.id],
    }),
    profile: one(emotionalProfiles, {
      fields: [emotionalEvents.profileId],
      references: [emotionalProfiles.id],
    }),
    predictions: many(emotionPredictions),
  }),
);

export const emotionalStatesRelations = relations(
  emotionalStates,
  ({ one }) => ({
    project: one(projects, {
      fields: [emotionalStates.projectId],
      references: [projects.id],
    }),
    profile: one(emotionalProfiles, {
      fields: [emotionalStates.profileId],
      references: [emotionalProfiles.id],
    }),
    modelVersion: one(modelVersions, {
      fields: [emotionalStates.modelVersionId],
      references: [modelVersions.id],
    }),
  }),
);

export const emotionalMemoriesRelations = relations(
  emotionalMemories,
  ({ one }) => ({
    project: one(projects, {
      fields: [emotionalMemories.projectId],
      references: [projects.id],
    }),
    profile: one(emotionalProfiles, {
      fields: [emotionalMemories.profileId],
      references: [emotionalProfiles.id],
    }),
  }),
);

export const emotionPredictionsRelations = relations(
  emotionPredictions,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [emotionPredictions.projectId],
      references: [projects.id],
    }),
    profile: one(emotionalProfiles, {
      fields: [emotionPredictions.profileId],
      references: [emotionalProfiles.id],
    }),
    event: one(emotionalEvents, {
      fields: [emotionPredictions.eventId],
      references: [emotionalEvents.id],
    }),
    modelVersion: one(modelVersions, {
      fields: [emotionPredictions.modelVersionId],
      references: [modelVersions.id],
    }),
    feedback: many(emotionFeedback),
  }),
);

export const emotionFeedbackRelations = relations(
  emotionFeedback,
  ({ one }) => ({
    project: one(projects, {
      fields: [emotionFeedback.projectId],
      references: [projects.id],
    }),
    profile: one(emotionalProfiles, {
      fields: [emotionFeedback.profileId],
      references: [emotionalProfiles.id],
    }),
    prediction: one(emotionPredictions, {
      fields: [emotionFeedback.predictionId],
      references: [emotionPredictions.id],
    }),
  }),
);

export const modelVersionsRelations = relations(
  modelVersions,
  ({ many }) => ({
    parameters: many(modelParameters),
    emotionalStates: many(emotionalStates),
    emotionPredictions: many(emotionPredictions),
  }),
);

export const modelParametersRelations = relations(
  modelParameters,
  ({ one }) => ({
    modelVersion: one(modelVersions, {
      fields: [modelParameters.modelVersionId],
      references: [modelVersions.id],
    }),
  }),
);

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  organization: one(organizations, {
    fields: [usageRecords.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [usageRecords.projectId],
    references: [projects.id],
  }),
  apiKey: one(apiKeys, {
    fields: [usageRecords.apiKeyId],
    references: [apiKeys.id],
  }),
}));

export const subscriptionsRelations = relations(
  subscriptions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [subscriptions.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const billingEventsRelations = relations(
  billingEvents,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [billingEvents.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
