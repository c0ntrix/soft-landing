import { AppServer } from '../src/rpc.js';
const rpc = new AppServer();
try {
  console.log('Server:', await rpc.initialize());
  const auth = await rpc.request('account/read', { refreshToken: false });
  console.log('Authentication type:', auth.account?.type ?? 'unavailable');
  const limits = await rpc.request('account/rateLimits/read');
  console.log('Real limits:', JSON.stringify({ rateLimits: limits.rateLimits, rateLimitsByLimitId: limits.rateLimitsByLimitId }, null, 2));
} finally { rpc.close(); }
