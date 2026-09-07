const configuredDatabaseUrl = process.env.DATABASE_URL;

if (!configuredDatabaseUrl) {
  throw new Error('DATABASE_URL is required to initialize the database.');
}

export const databaseUrl = configuredDatabaseUrl;
