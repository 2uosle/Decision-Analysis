-- SEC Inventory Tracker schema for Supabase

create table if not exists public.items (
  id text primary key,
  name text not null,
  category text not null,
  unit text not null,
  qty integer not null default 0,
  min integer not null default 0,
  location text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id text primary key,
  item_id text references public.items(id) on delete set null,
  type text not null check (type in ('IN', 'OUT', 'ADJUST')),
  qty integer not null check (qty > 0),
  requested_by text not null,
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_items_updated_at on public.items;
create trigger trg_items_updated_at
before update on public.items
for each row
execute function public.set_updated_at();

alter table public.items enable row level security;
alter table public.transactions enable row level security;

-- MVP open access policies (replace with auth-based policies in production).
drop policy if exists "Allow all on items" on public.items;
create policy "Allow all on items"
on public.items
for all
using (true)
with check (true);

drop policy if exists "Allow all on transactions" on public.transactions;
create policy "Allow all on transactions"
on public.transactions
for all
using (true)
with check (true);
