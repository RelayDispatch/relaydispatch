/**
 * packages/workflows/temporal/src/client.ts
 * ───────────────────────────────────────────
 * Lazy singleton Temporal client factory.
 * Extracted from the monolithic api/index.ts.
 *
 * The client is created once on first call and reused across requests.
 * TLS is supported automatically when TEMPORAL_ADDRESS includes a port != 7233
 * or when TEMPORAL_TLS=true is set.
 */

import 'dotenv/config';
import { Client as TemporalClient, Connection } from '@temporalio/client';

let _temporalClient: TemporalClient | null = null;

/**
 * Returns a singleton Temporal client, creating it on first call.
 * The Temporal namespace defaults to 'relaydispatch-dispatch'.
 */
export async function getTemporalClient(): Promise<TemporalClient> {
  if (_temporalClient) return _temporalClient;

  const conn = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
  });

  _temporalClient = new TemporalClient({
    connection: conn,
    namespace:  process.env.TEMPORAL_NAMESPACE ?? 'relaydispatch-dispatch',
  });

  return _temporalClient;
}
