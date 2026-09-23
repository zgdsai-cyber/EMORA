import {
  customType,
  doublePrecision,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const timestampWithTimezone = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });

type JsonObject = Record<string, unknown>;

export const organizationRole = pgEnum('organization_role', [
  'OWNER',
  'ADMIN',
  'MEMBER',
  'VIEWER',
]);

export const feedbackType = pgEnum('feedback_type', [
  'SELF_REPORTED_EMOTION',
  'OBSERVED_BEHAVIOR',
  'MODEL_PREDICTION',
  'HUMAN_ANNOTATION',
]);

export const parameterVersionStatus = pgEnum('parameter_version_status', [
  'CANDIDATE',
  'VALIDATED',
  'REJECTED',
]);

export const embedding = customType<{
  data: readonly number[];
  driverData: string;
}>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value) {
    return `[${value.join(',')}]`;
  },
  fromDriver(value) {
    return value.slice(1, -1).split(',').filter(Boolean).map(Number);
  },
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    name: text('name').default('').notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
    updatedAt: timestampWithTimezone('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestampWithTimezone('expires_at').notNull(),
    token: text('token').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
    updatedAt: timestampWithTimezone('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('sessions_token_unique').on(table.token),
    index('sessions_user_id_idx').on(table.userId),
  ],
);

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestampWithTimezone('access_token_expires_at'),
    refreshTokenExpiresAt: timestampWithTimezone('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
    updatedAt: timestampWithTimezone('updated_at').defaultNow().notNull(),
  },
  (table) => [index('accounts_user_id_idx').on(table.userId)],
);

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestampWithTimezone('expires_at').notNull(),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
    updatedAt: timestampWithTimezone('updated_at').defaultNow().notNull(),
  },
  (table) => [index('verifications_identifier_idx').on(table.identifier)],
);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
    updatedAt: timestampWithTimezone('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('organizations_slug_unique').on(table.slug)],
);

export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: organizationRole('role').notNull(),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('organization_members_organization_user_unique').on(
      table.organizationId,
      table.userId,
    ),
    index('organization_members_organization_id_idx').on(table.organizationId),
    index('organization_members_user_id_idx').on(table.userId),
  ],
);
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
    updatedAt: timestampWithTimezone('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('projects_organization_slug_unique').on(
      table.organizationId,
      table.slug,
    ),
    uniqueIndex('projects_organization_id_unique').on(
      table.organizationId,
      table.id,
    ),
    index('projects_organization_id_idx').on(table.organizationId),
  ],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    keyHash: text('key_hash').notNull(),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
    lastUsedAt: timestampWithTimezone('last_used_at'),
    revokedAt: timestampWithTimezone('revoked_at'),
  },
  (table) => [
    uniqueIndex('api_keys_key_hash_unique').on(table.keyHash),
    uniqueIndex('api_keys_project_id_unique').on(table.projectId, table.id),
    index('api_keys_project_id_idx').on(table.projectId),
  ],
);

export const emotionalProfiles = pgTable(
  'emotional_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    externalReference: text('external_reference').notNull(),
    profileData: jsonb('profile_data').$type<JsonObject>().notNull(),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
    updatedAt: timestampWithTimezone('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('emotional_profiles_project_external_reference_unique').on(
      table.projectId,
      table.externalReference,
    ),
    uniqueIndex('emotional_profiles_project_id_unique').on(
      table.projectId,
      table.id,
    ),
    index('emotional_profiles_project_id_idx').on(table.projectId),
  ],
);

export const emotionalEvents = pgTable(
  'emotional_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => emotionalProfiles.id),
    timestamp: timestampWithTimezone('timestamp').notNull(),
    source: text('source').notNull(),
    valence: doublePrecision('valence'),
    intensity: doublePrecision('intensity'),
    relevance: doublePrecision('relevance'),
    surprise: doublePrecision('surprise'),
    uncertainty: doublePrecision('uncertainty'),
    context: jsonb('context').$type<JsonObject>(),
    metadata: jsonb('metadata').$type<JsonObject>(),
    // Slice 1 duplicate protection. Nullable: internal event sources have no key.
    idempotencyKey: text('idempotency_key'),
    // Slice 1 canonical request digest (never the raw payload).
    requestHash: text('request_hash'),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('emotional_events_project_id_idx').on(table.projectId),
    index('emotional_events_profile_id_idx').on(table.profileId),
    index('emotional_events_timestamp_idx').on(table.timestamp),
    uniqueIndex('emotional_events_project_id_unique').on(
      table.projectId,
      table.id,
    ),
    uniqueIndex('emotional_events_idempotency_key_unique')
      .on(table.projectId, table.profileId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
    foreignKey({
      columns: [table.projectId, table.profileId],
      foreignColumns: [emotionalProfiles.projectId, emotionalProfiles.id],
      name: 'emotional_events_project_profile_fk',
    }),
  ],
);

export const modelVersions = pgTable(
  'model_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    version: text('version').notNull(),
    datasetVersion: text('dataset_version'),
    parameterSet: jsonb('parameter_set').$type<JsonObject>(),
    status: text('status').notNull(),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('model_versions_name_version_unique').on(
      table.name,
      table.version,
    ),
  ],
);

export const emotionalStates = pgTable(
  'emotional_states',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => emotionalProfiles.id),
    timestamp: timestampWithTimezone('timestamp').notNull(),
    state: jsonb('state').$type<JsonObject>().notNull(),
    valence: doublePrecision('valence'),
    arousal: doublePrecision('arousal'),
    intensity: doublePrecision('intensity'),
    confidence: doublePrecision('confidence'),
    modelVersionId: uuid('model_version_id')
      .notNull()
      .references(() => modelVersions.id),
    // Slice 1: the event that produced this state (null for legacy rows).
    eventId: uuid('event_id'),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('emotional_states_project_id_idx').on(table.projectId),
    index('emotional_states_profile_id_idx').on(table.profileId),
    index('emotional_states_timestamp_idx').on(table.timestamp),
    foreignKey({
      columns: [table.projectId, table.profileId],
      foreignColumns: [emotionalProfiles.projectId, emotionalProfiles.id],
      name: 'emotional_states_project_profile_fk',
    }),
    foreignKey({
      columns: [table.projectId, table.eventId],
      foreignColumns: [emotionalEvents.projectId, emotionalEvents.id],
      name: 'emotional_states_project_event_fk',
    }),
  ],
);

export const emotionalMemories = pgTable(
  'emotional_memories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => emotionalProfiles.id),
    content: text('content').notNull(),
    reference: text('reference'),
    timestamp: timestampWithTimezone('timestamp').notNull(),
    emotionState: jsonb('emotion_state').$type<JsonObject>(),
    intensity: doublePrecision('intensity'),
    importance: doublePrecision('importance'),
    decayRate: doublePrecision('decay_rate'),
    embedding: embedding('embedding'),
    metadata: jsonb('metadata').$type<JsonObject>(),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
    updatedAt: timestampWithTimezone('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('emotional_memories_project_id_idx').on(table.projectId),
    index('emotional_memories_profile_id_idx').on(table.profileId),
    index('emotional_memories_timestamp_idx').on(table.timestamp),
    foreignKey({
      columns: [table.projectId, table.profileId],
      foreignColumns: [emotionalProfiles.projectId, emotionalProfiles.id],
      name: 'emotional_memories_project_profile_fk',
    }),
  ],
);

export const emotionPredictions = pgTable(
  'emotion_predictions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => emotionalProfiles.id),
    eventId: uuid('event_id').references(() => emotionalEvents.id),
    modelVersionId: uuid('model_version_id')
      .notNull()
      .references(() => modelVersions.id),
    prediction: jsonb('prediction').$type<JsonObject>().notNull(),
    confidence: doublePrecision('confidence'),
    uncertainty: doublePrecision('uncertainty'),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('emotion_predictions_project_id_idx').on(table.projectId),
    index('emotion_predictions_profile_id_idx').on(table.profileId),
    uniqueIndex('emotion_predictions_project_profile_id_unique').on(
      table.projectId,
      table.profileId,
      table.id,
    ),
    foreignKey({
      columns: [table.projectId, table.profileId],
      foreignColumns: [emotionalProfiles.projectId, emotionalProfiles.id],
      name: 'emotion_predictions_project_profile_fk',
    }),
    foreignKey({
      columns: [table.projectId, table.eventId],
      foreignColumns: [emotionalEvents.projectId, emotionalEvents.id],
      name: 'emotion_predictions_project_event_fk',
    }),
  ],
);

export const emotionFeedback = pgTable(
  'emotion_feedback',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => emotionalProfiles.id),
    predictionId: uuid('prediction_id')
      .notNull()
      .references(() => emotionPredictions.id),
    feedbackType: feedbackType('feedback_type').notNull(),
    value: jsonb('value').$type<JsonObject>().notNull(),
    source: text('source').notNull(),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('emotion_feedback_prediction_id_idx').on(table.predictionId),
    foreignKey({
      columns: [table.projectId, table.profileId],
      foreignColumns: [emotionalProfiles.projectId, emotionalProfiles.id],
      name: 'emotion_feedback_project_profile_fk',
    }),
    foreignKey({
      columns: [table.projectId, table.profileId, table.predictionId],
      foreignColumns: [
        emotionPredictions.projectId,
        emotionPredictions.profileId,
        emotionPredictions.id,
      ],
      name: 'emotion_feedback_project_prediction_fk',
    }),
  ],
);

export const modelParameters = pgTable(
  'model_parameters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    modelVersionId: uuid('model_version_id')
      .notNull()
      .references(() => modelVersions.id),
    name: text('name').notNull(),
    parameters: jsonb('parameters').$type<JsonObject>().notNull(),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
    updatedAt: timestampWithTimezone('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('model_parameters_model_version_name_unique').on(
      table.modelVersionId,
      table.name,
    ),
  ],
);

export const parameterVersions = pgTable(
  'parameter_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    projectId: uuid('project_id').notNull(),
    version: text('version').notNull(),
    parameterSet: jsonb('parameter_set').$type<JsonObject>().notNull(),
    parameterSetHash: text('parameter_set_hash').notNull(),
    status: parameterVersionStatus('status').notNull(),
    parentVersionId: uuid('parent_version_id'),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    validatedAt: timestampWithTimezone('validated_at'),
    validatedBy: uuid('validated_by').references(() => users.id),
    rejectedAt: timestampWithTimezone('rejected_at'),
    rejectedBy: uuid('rejected_by').references(() => users.id),
    rejectionReason: text('rejection_reason'),
    evaluationReport: jsonb('evaluation_report').$type<JsonObject>(),
  },
  (table) => [
    uniqueIndex('parameter_versions_organization_project_version_unique').on(
      table.organizationId,
      table.projectId,
      table.version,
    ),
    uniqueIndex('parameter_versions_organization_project_hash_unique').on(
      table.organizationId,
      table.projectId,
      table.parameterSetHash,
    ),
    uniqueIndex('parameter_versions_organization_project_id_unique').on(
      table.organizationId,
      table.projectId,
      table.id,
    ),
    index('parameter_versions_project_status_idx').on(
      table.projectId,
      table.status,
    ),
    index('parameter_versions_project_created_at_idx').on(
      table.projectId,
      table.createdAt,
    ),
    check(
      'parameter_versions_rejected_reason_check',
      sql`(${table.status} <> 'REJECTED' OR ${table.rejectionReason} IS NOT NULL)`,
    ),
    check(
      'parameter_versions_validated_metadata_check',
      sql`(${table.status} <> 'VALIDATED' OR (${table.validatedAt} IS NOT NULL AND ${table.validatedBy} IS NOT NULL AND ${table.evaluationReport} IS NOT NULL))`,
    ),
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [projects.organizationId, projects.id],
      name: 'parameter_versions_organization_project_fk',
    }),
    foreignKey({
      columns: [table.organizationId, table.projectId, table.parentVersionId],
      foreignColumns: [table.organizationId, table.projectId, table.id],
      name: 'parameter_versions_parent_scope_fk',
    }),
  ],
);

export const projectParameterActivation = pgTable(
  'project_parameter_activation',
  {
    projectId: uuid('project_id').primaryKey(),
    organizationId: uuid('organization_id').notNull(),
    parameterVersionId: uuid('parameter_version_id').notNull(),
    activatedAt: timestampWithTimezone('activated_at').defaultNow().notNull(),
    activatedBy: uuid('activated_by').notNull().references(() => users.id),
  },
  (table) => [
    uniqueIndex('project_parameter_activation_organization_project_unique').on(
      table.organizationId,
      table.projectId,
    ),
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [projects.organizationId, projects.id],
      name: 'project_parameter_activation_project_fk',
    }),
    foreignKey({
      columns: [
        table.organizationId,
        table.projectId,
        table.parameterVersionId,
      ],
      foreignColumns: [
        parameterVersions.organizationId,
        parameterVersions.projectId,
        parameterVersions.id,
      ],
      name: 'project_parameter_activation_version_fk',
    }),
  ],
);

export const usageRecords = pgTable(
  'usage_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    apiKeyId: uuid('api_key_id').references(() => apiKeys.id),
    endpoint: text('endpoint').notNull(),
    model: text('model'),
    tokens: integer('tokens'),
    processingTime: integer('processing_time'),
    estimatedCost: doublePrecision('estimated_cost'),
    timestamp: timestampWithTimezone('timestamp').notNull(),
  },
  (table) => [
    index('usage_records_organization_id_idx').on(table.organizationId),
    index('usage_records_project_id_idx').on(table.projectId),
    index('usage_records_timestamp_idx').on(table.timestamp),
    foreignKey({
      columns: [table.organizationId, table.projectId],
      foreignColumns: [projects.organizationId, projects.id],
      name: 'usage_records_organization_project_fk',
    }),
    foreignKey({
      columns: [table.projectId, table.apiKeyId],
      foreignColumns: [apiKeys.projectId, apiKeys.id],
      name: 'usage_records_project_api_key_fk',
    }),
  ],
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    provider: text('provider').notNull(),
    externalSubscriptionId: text('external_subscription_id').notNull(),
    status: text('status').notNull(),
    plan: text('plan').notNull(),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
    updatedAt: timestampWithTimezone('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('subscriptions_provider_external_id_unique').on(
      table.provider,
      table.externalSubscriptionId,
    ),
    index('subscriptions_organization_id_idx').on(table.organizationId),
  ],
);

export const billingEvents = pgTable(
  'billing_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    provider: text('provider').notNull(),
    externalEventId: text('external_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').$type<JsonObject>().notNull(),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('billing_events_provider_external_id_unique').on(
      table.provider,
      table.externalEventId,
    ),
    index('billing_events_organization_id_idx').on(table.organizationId),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id').references(() => users.id),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: uuid('resource_id'),
    metadata: jsonb('metadata').$type<JsonObject>(),
    createdAt: timestampWithTimezone('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_organization_id_idx').on(table.organizationId),
    index('audit_logs_created_at_idx').on(table.createdAt),
  ],
);
