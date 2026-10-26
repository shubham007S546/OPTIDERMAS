-- OptiDerma Supabase Database Schema
-- Run this in your Supabase SQL Editor (https://uwlatkypjzfnobrobzns.supabase.co)

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  slot_id text not null,
  slot_date text not null,
  slot_label text not null,
  name text not null,
  email text not null,
  reason text default '',
  status text default 'confirmed',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast slot lookup
create index if not exists bookings_slot_id_idx on public.bookings (slot_id);
create index if not exists bookings_reference_idx on public.bookings (reference);

-- Enable Row Level Security (RLS)
alter table public.bookings enable row level security;

-- Create policy allowing anonymous users to insert bookings and select slots
create policy "Allow anon insert bookings" on public.bookings
  for insert with check (true);

create policy "Allow anon select booked slots" on public.bookings
  for select using (true);
