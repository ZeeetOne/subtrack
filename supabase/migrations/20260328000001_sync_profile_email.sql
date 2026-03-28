-- Trigger to keep profiles.email in sync with auth.users.email
-- Fires after auth email is confirmed/updated

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id
    and email is distinct from new.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  execute procedure public.sync_profile_email();
