import { z } from "zod";

export const profileSchema = z.object({
  display_name: z.string().min(2, "Name must be at least 2 characters").optional(),
  base_currency: z.string().length(3).optional(),
});

export const updateEmailSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  password: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => data.currentPassword !== data.password, {
  message: "New password must be different from current password",
  path: ["password"],
});

export const feedbackSchema = z.object({
  message: z.string().min(5, "Feedback must be at least 5 characters"),
  category: z.string().optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
export type UpdateEmailValues = z.infer<typeof updateEmailSchema>;
export type UpdatePasswordValues = z.infer<typeof updatePasswordSchema> & { currentPassword: string };
export type FeedbackFormValues = z.infer<typeof feedbackSchema>;
