import postgres from 'postgres';

import { databaseUrl } from './config';

export const sql = postgres(databaseUrl, {
  max: 10,
  prepare: false,
});
