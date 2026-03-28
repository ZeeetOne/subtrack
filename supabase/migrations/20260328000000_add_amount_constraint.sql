-- Prevent negative or zero expense amounts
alter table expenses
  add constraint expenses_amount_positive check (amount > 0);
