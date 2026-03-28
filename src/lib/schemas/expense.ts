import { z } from "zod";

export const expenseSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number",
  }),
  currency: z.string().min(1, { message: "Currency is required" }),
  billing_cycle: z.enum(["weekly", "monthly", "quarterly", "yearly", "one-time"]),
  category: z.string().optional(),
  category_id: z.string().uuid().optional(),
  notes: z.string().max(500, "Notes must be under 500 characters").optional(),
  next_billing_date: z.string().optional().refine((val) => {
    if (!val) return true;
    if (isNaN(Date.parse(val))) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(val);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate >= today;
  }, {
    message: "Date cannot be in the past",
  }),
  is_active: z.boolean(),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;
