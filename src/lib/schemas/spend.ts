import { z } from "zod";

const dateNotFuture = (val: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
  const [y, m, d] = val.split('-').map(Number);
  // One day of grace: this refine also runs server-side, where the clock may be
  // up to a day behind the user's local date (UTC server, UTC+N user).
  const limit = new Date();
  limit.setDate(limit.getDate() + 1);
  limit.setHours(23, 59, 59, 999);
  return new Date(y, m - 1, d) <= limit;
};

const amountString = z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
  message: "Amount must be a positive number",
});

export const spendEntrySchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  amount: amountString,
  currency: z.string().min(1, { message: "Currency is required" }),
  spent_on: z.string().refine(dateNotFuture, { message: "Date cannot be in the future" }),
  category_id: z.string().uuid().optional(),
  notes: z.string().max(500, "Notes must be under 500 characters").optional(),
  is_subscription: z.boolean(),
  cycle: z.enum(["weekly", "monthly", "quarterly", "yearly"]).optional(),
}).refine((data) => !data.is_subscription || !!data.cycle, {
  message: "Pick a billing cycle for the subscription",
  path: ["cycle"],
});

export type SpendEntryFormValues = z.infer<typeof spendEntrySchema>;

/**
 * What the client actually sends to the server.
 *
 * The row ids are generated on the client (crypto.randomUUID) rather than by
 * Postgres so a queued write can be replayed safely: re-inserting the same id
 * hits the primary key and is treated as success, which is what makes the
 * offline outbox idempotent. `created_at` comes from the device too, so an
 * entry added offline keeps its true position in `order('created_at')`.
 */
export const spendEntryInputSchema = z.object({
  id: z.uuid(),
  rule_id: z.uuid().nullish(),
  created_at: z.iso.datetime().optional(),
  exchange_rate: z.number().positive().optional(),
  rate_status: z.enum(['resolved', 'pending']).optional(),
  name: z.string().min(1, { message: "Name is required" }),
  amount: amountString,
  currency: z.string().min(1, { message: "Currency is required" }),
  spent_on: z.string().refine(dateNotFuture, { message: "Date cannot be in the future" }),
  category_id: z.string().uuid().optional(),
  notes: z.string().max(500, "Notes must be under 500 characters").optional(),
  is_subscription: z.boolean(),
  cycle: z.enum(["weekly", "monthly", "quarterly", "yearly"]).optional(),
}).refine((data) => !data.is_subscription || !!data.cycle, {
  message: "Pick a billing cycle for the subscription",
  path: ["cycle"],
});

export type SpendEntryInput = z.infer<typeof spendEntryInputSchema>;

export const confirmPaymentSchema = z.object({
  paid_date: z.string().refine(dateNotFuture, { message: "Date cannot be in the future" }),
  amount: amountString,
});

export type ConfirmPaymentValues = z.infer<typeof confirmPaymentSchema>;
