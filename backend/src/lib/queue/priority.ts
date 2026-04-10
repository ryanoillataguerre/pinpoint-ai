/**
 * Priority queue logic for plan-tier-based job ordering.
 * Maps organization plan tiers to RabbitMQ message priorities.
 */

/**
 * RabbitMQ priority values by plan tier.
 * Higher values = processed first.
 */
const PLAN_PRIORITIES: Record<string, number> = {
  enterprise: 10,
  professional: 5,
  starter: 1,
};

const DEFAULT_PRIORITY = 1;

/**
 * Max priority level for queue declaration.
 * Required when asserting queues with priority support.
 */
export const MAX_QUEUE_PRIORITY = 10;

/**
 * Get the RabbitMQ message priority for a given plan tier.
 */
export function getPriorityForPlan(planTier: string | null | undefined): number {
  if (!planTier) return DEFAULT_PRIORITY;
  return PLAN_PRIORITIES[planTier] || DEFAULT_PRIORITY;
}
