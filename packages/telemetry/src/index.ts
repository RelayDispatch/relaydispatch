/**
 * packages/telemetry/src/index.ts
 * ─────────────────────────────────────────────────────────────
 * OpenTelemetry tracing and metrics for RelayDispatch.
 *
 * Provides structured distributed tracing across:
 *   Hono API → Temporal workflow → Activity → LLM call
 *
 * Spans exported to OTLP collector (Grafana Cloud / Honeycomb / Datadog).
 * Configure via standard OTEL env vars:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  — e.g. https://otlp.grafana.net/otlp
 *   OTEL_EXPORTER_OTLP_HEADERS   — e.g. Authorization=Basic <base64>
 *   OTEL_SERVICE_NAME             — defaults to 'relaydispatch-api'
 *
 * Usage:
 *   import { tracer, recordLlmCost } from '@relaydispatch/telemetry';
 *   const span = tracer.startSpan('dispatcher.run');
 *   span.setAttributes({ 'org.id': orgId, 'llm.model': modelId });
 *   // ... work ...
 *   span.end();
 *
 * Per-org LLM cost tracking:
 *   recordLlmCost({ orgId, modelId, promptTokens, completionTokens, costUsd })
 *   Emits a metric counter: relaydispatch.llm.cost_usd (org_id, model_id labels)
 *   Query in Grafana: sum by(org_id) (relaydispatch_llm_cost_usd_total)
 */

import { NodeSDK }               from '@opentelemetry/sdk-node';
import { OTLPTraceExporter }     from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter }    from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION }
                                 from '@opentelemetry/semantic-conventions';
import { trace, metrics, context, SpanStatusCode }
                                 from '@opentelemetry/api';

// ── SDK initialisation (call once at process start, before imports) ──
let _sdkStarted = false;

export function initTelemetry(): void {
  if (_sdkStarted) return;
  _sdkStarted = true;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    // No-op: OTEL not configured (dev / test environments)
    return;
  }

  const resource = resourceFromAttributes({
    [SEMRESATTRS_SERVICE_NAME]:    process.env.OTEL_SERVICE_NAME ?? 'relaydispatch-api',
    [SEMRESATTRS_SERVICE_VERSION]: '0.2.0',
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    metricReader:  new PeriodicExportingMetricReader({
      exporter:        new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
      exportIntervalMillis: 30_000,
    }),
  });

  sdk.start();

  process.on('SIGTERM', async () => {
    await sdk.shutdown().catch(console.error);
  });
}

// ── Tracer singleton ─────────────────────────────────────────
export const tracer = trace.getTracer('relaydispatch', '0.2.0');

// ── Metrics: per-org LLM cost counter ───────────────────────
const meter           = metrics.getMeter('relaydispatch', '0.2.0');
const llmCostCounter  = meter.createCounter('relaydispatch.llm.cost_usd', {
  description: 'Total LLM cost in USD per org and model',
  unit:        'USD',
});
const llmTokenCounter = meter.createCounter('relaydispatch.llm.tokens', {
  description: 'Total LLM tokens consumed per org and model',
  unit:        'tokens',
});

export interface LlmCostEvent {
  orgId:            string;
  modelId:          string;
  promptTokens:     number;
  completionTokens: number;
  costUsd:          number;
}

/**
 * Records per-org LLM cost to OTEL metrics.
 * Call this in the dispatcher after every LLM response.
 * Grafana query: sum by(org_id) (rate(relaydispatch_llm_cost_usd_total[5m]))
 */
export function recordLlmCost(event: LlmCostEvent): void {
  const attrs = { 'org.id': event.orgId, 'llm.model': event.modelId };
  llmCostCounter.add(event.costUsd,                                     attrs);
  llmTokenCounter.add(event.promptTokens + event.completionTokens,      attrs);
}

/**
 * Wraps an async fn in an OTEL span. Automatically records errors.
 * Usage:
 *   const result = await withSpan('activity.classify', { 'org.id': orgId }, async (span) => {
 *     // ... do work
 *     return result;
 *   });
 */
export async function withSpan<T>(
  name:  string,
  attrs: Record<string, string | number | boolean>,
  fn:    (span: ReturnType<typeof tracer.startSpan>) => Promise<T>,
): Promise<T> {
  const span = tracer.startSpan(name);
  span.setAttributes(attrs);
  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
    span.recordException(err as Error);
    throw err;
  } finally {
    span.end();
  }
}

// Re-export for convenience
export { context, SpanStatusCode };
