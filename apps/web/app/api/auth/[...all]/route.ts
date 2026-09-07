import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@emora/auth';

export const { GET, POST } = toNextJsHandler(auth);
