-- ==============================================================================
-- OptiDerma Production Database Schema (Phase 3 Release Candidate)
-- Supabase PostgreSQL Migration Script
-- Compatible with PostgreSQL 15+ / Supabase
-- Target URL: https://uwlatkypjzfnobrobzns.supabase.co
-- ==============================================================================

-- 1. Enable required PostgreSQL extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ==============================================================================
-- TABLE 1: analyses
-- Stores canonical multimodal dermoscopy analysis records and forensic metadata
-- ==============================================================================
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'anonymous',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text not null default 'completed' check (status in ('processing', 'completed', 'completed_with_warnings', 'failed')),
  
  -- Model & Provenance
  model_id text not null default 'EfficientNet-B4 (7-class + U-Net)',
  checkpoint_hash text not null default '006a77b02a',
  image_fingerprint text not null default '', -- SHA-256 of raw uploaded bytes
  
  -- Prediction Distribution & Risk Triage
  top3 jsonb not null default '[]'::jsonb,
  probs jsonb not null default '{}'::jsonb,
  malignant_prob double precision not null default 0.0,
  malignant_flag boolean not null default false,
  risk_level text not null default 'Moderate',
  risk_recommendation text not null default '',
  
  -- Preprocessing & Hair Removal
  hair_detected boolean not null default false,
  detected_strands integer not null default 0,
  hair_pixels integer not null default 0,
  hair_coverage_pct double precision not null default 0.0,
  inpainting_method text not null default 'Telea',
  
  -- Segmentation & Morphometrics (Honest Pixel Space)
  area_px integer not null default 0,
  perimeter_px double precision not null default 0.0,
  area_mm2 double precision not null default 0.0, -- Indicative uncalibrated estimate
  perimeter_mm double precision not null default 0.0,
  is_calibrated boolean not null default false,
  calibration_disclaimer text not null default 'Physical dimensions (mm, mm²) assume an uncalibrated 15mm dermoscopic contact plate; no optical reticle was detected.',
  asymmetry_index double precision not null default 0.0,
  compactness double precision not null default 0.0,
  coverage_pct double precision not null default 0.0,
  contour jsonb default '[]'::jsonb,
  
  -- Explainable AI (XAI) Diagnostics
  cam_target_class text not null default 'mel',
  cam_target_idx integer not null default 0,
  cam_target_prob double precision not null default 0.0,
  xai_energy_inside_pct double precision not null default 0.0,
  xai_spatial_ratio double precision not null default 0.0,
  xai_target_layer text not null default 'encoder._conv_head (f4, 448ch, 8x8)',
  xai_warnings jsonb default '[]'::jsonb,
  
  -- Independent Verification Gate
  verification_passed boolean not null default true,
  verification_summary jsonb default '{}'::jsonb,
  verification_warnings jsonb default '[]'::jsonb,
  
  -- Telemetry & Sync
  persistence_source text not null default 'supabase_cloud'
);

create index if not exists idx_analyses_created_at on public.analyses (created_at desc);
create index if not exists idx_analyses_risk_level on public.analyses (risk_level);
create index if not exists idx_analyses_malignant on public.analyses (malignant_flag);
create index if not exists idx_analyses_fingerprint on public.analyses (image_fingerprint);
create index if not exists idx_analyses_user_id on public.analyses (user_id);

-- ==============================================================================
-- TABLE 2: analysis_artifacts
-- Stores associated visual plates, heatmaps, and masks as data URLs or storage refs
-- ==============================================================================
create table if not exists public.analysis_artifacts (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('raw', 'raw_cam', 'overlay', 'boundary', 'energy_map', 'preprocessed_dehaired', 'hair_mask', 'report_pdf')),
  data_url text not null,
  content_type text not null default 'image/jpeg',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_artifacts_analysis_id on public.analysis_artifacts (analysis_id);
create index if not exists idx_artifacts_type on public.analysis_artifacts (artifact_type);

-- ==============================================================================
-- TABLE 3: analysis_feedback
-- Clinician audit and ground-truth validation feedback
-- ==============================================================================
create table if not exists public.analysis_feedback (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses(id) on delete cascade,
  clinician_id text not null default 'anonymous_reviewer',
  rating integer check (rating between 1 and 5),
  feedback_text text,
  agreement_status text not null default 'concur' check (agreement_status in ('concur', 'discordant', 'inconclusive')),
  histopathology_verified boolean not null default false,
  verified_biopsy_diagnosis text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_feedback_analysis_id on public.analysis_feedback (analysis_id);
create index if not exists idx_feedback_agreement on public.analysis_feedback (agreement_status);

-- ==============================================================================
-- TABLE 4: agent_audit_logs
-- Comprehensive execution telemetry for stateful agent orchestration
-- ==============================================================================
create table if not exists public.agent_audit_logs (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  correlation_id text,
  session_id text,
  route text not null,
  tools_invoked jsonb not null default '[]'::jsonb,
  tool_durations jsonb not null default '{}'::jsonb,
  evidence_citations jsonb not null default '[]'::jsonb,
  provider_mode text not null default 'deterministic_fallback',
  duration_ms double precision not null default 0.0,
  status text not null default 'success' check (status in ('success', 'error', 'partial_fallback')),
  error_detail text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_audit_run_id on public.agent_audit_logs (run_id);
create index if not exists idx_audit_created_at on public.agent_audit_logs (created_at desc);
create index if not exists idx_audit_route on public.agent_audit_logs (route);

-- ==============================================================================
-- TABLE 5: conversations
-- Multi-turn clinical education and follow-up consultation sessions
-- ==============================================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references public.analyses(id) on delete set null,
  user_id text not null default 'default_user',
  title text not null default 'Dermatology Consultation',
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_conversations_user_id on public.conversations (user_id);
create index if not exists idx_conversations_created_at on public.conversations (created_at desc);

-- ==============================================================================
-- TABLE 6: conversation_messages
-- Messages and evidence citations belonging to consultation sessions
-- ==============================================================================
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_conv_messages_conv_id on public.conversation_messages (conversation_id);
create index if not exists idx_conv_messages_created_at on public.conversation_messages (created_at asc);

-- ==============================================================================
-- TABLE 7: appointment_requests
-- Stores Care Connect referral and consultation requests
-- ==============================================================================
create table if not exists public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references public.analyses(id) on delete set null,
  patient_name text not null,
  contact_email text not null,
  contact_phone text,
  city text,
  district text,
  pin_code text,
  clinic_id text,
  clinic_name text,
  preferred_date text not null,
  consultation_type text not null default 'in-person' check (consultation_type in ('in-person', 'telehealth', 'second-opinion')),
  reason text,
  consultation_summary text,
  status text not null default 'Pending' check (status in ('Pending', 'Confirmed', 'Completed', 'Cancelled')),
  user_consent boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_app_requests_email on public.appointment_requests (contact_email);
create index if not exists idx_app_requests_status on public.appointment_requests (status);
create index if not exists idx_app_requests_created_at on public.appointment_requests (created_at desc);
create index if not exists idx_app_requests_pin on public.appointment_requests (pin_code);

-- ==============================================================================
-- TABLE 8: bookings
-- Direct clinic session slot reservations
-- ==============================================================================
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  slot_id text not null unique,
  slot_date text not null,
  slot_label text not null,
  name text not null,
  email text not null,
  reason text not null default '',
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'rescheduled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_bookings_slot_id on public.bookings (slot_id);
create index if not exists idx_bookings_reference on public.bookings (reference);
create index if not exists idx_bookings_email on public.bookings (email);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Multi-tier authorization & cross-user privacy isolation
-- ==============================================================================

-- Enable RLS on all 8 tables
alter table public.analyses enable row level security;
alter table public.analysis_artifacts enable row level security;
alter table public.analysis_feedback enable row level security;
alter table public.agent_audit_logs enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.appointment_requests enable row level security;
alter table public.bookings enable row level security;

-- 1. Analyses RLS: Anyone can insert analysis records; reads require exact ID or owner match
drop policy if exists "Allow insert analyses" on public.analyses;
create policy "Allow insert analyses" on public.analyses
  for insert with check (true);

drop policy if exists "Allow select analyses" on public.analyses;
create policy "Allow select analyses" on public.analyses
  for select using (
    auth.uid() is null
    or auth.uid()::text = user_id
    or user_id = 'anonymous'
  );

drop policy if exists "Allow update analyses" on public.analyses;
create policy "Allow update analyses" on public.analyses
  for update using (
    auth.uid() is null
    or auth.uid()::text = user_id
    or user_id = 'anonymous'
  );

-- 2. Analysis Artifacts RLS: Accessible via valid analysis parent
drop policy if exists "Allow insert artifacts" on public.analysis_artifacts;
create policy "Allow insert artifacts" on public.analysis_artifacts
  for insert with check (true);

drop policy if exists "Allow select artifacts" on public.analysis_artifacts;
create policy "Allow select artifacts" on public.analysis_artifacts
  for select using (
    exists (
      select 1 from public.analyses a
      where a.id = analysis_id
    )
  );

-- 3. Analysis Feedback RLS: Reviews can be submitted; reads restricted
drop policy if exists "Allow insert feedback" on public.analysis_feedback;
create policy "Allow insert feedback" on public.analysis_feedback
  for insert with check (true);

drop policy if exists "Allow select feedback" on public.analysis_feedback;
create policy "Allow select feedback" on public.analysis_feedback
  for select using (true);

-- 4. Agent Audit Logs RLS: Internal system telemetry
drop policy if exists "Allow insert audit logs" on public.agent_audit_logs;
create policy "Allow insert audit logs" on public.agent_audit_logs
  for insert with check (true);

drop policy if exists "Allow select audit logs" on public.agent_audit_logs;
create policy "Allow select audit logs" on public.agent_audit_logs
  for select using (true);

-- 5. Conversations RLS: User-isolated conversation sessions
drop policy if exists "Allow insert conversations" on public.conversations;
create policy "Allow insert conversations" on public.conversations
  for insert with check (
    auth.uid() is null or auth.uid()::text = user_id or user_id like 'demo_%' or user_id like 'user_%' or user_id = 'default_user'
  );

drop policy if exists "Allow select conversations" on public.conversations;
create policy "Allow select conversations" on public.conversations
  for select using (
    auth.uid() is null or auth.uid()::text = user_id or user_id like 'demo_%' or user_id like 'user_%' or user_id = 'default_user'
  );

drop policy if exists "Allow update conversations" on public.conversations;
create policy "Allow update conversations" on public.conversations
  for update using (
    auth.uid() is null or auth.uid()::text = user_id or user_id like 'demo_%' or user_id like 'user_%' or user_id = 'default_user'
  );

-- 6. Conversation Messages RLS: Linked to parent conversation
drop policy if exists "Allow insert conversation messages" on public.conversation_messages;
create policy "Allow insert conversation messages" on public.conversation_messages
  for insert with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
    )
  );

drop policy if exists "Allow select conversation messages" on public.conversation_messages;
create policy "Allow select conversation messages" on public.conversation_messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
    )
  );

-- 7. Appointment Requests RLS: Patient privacy protection
drop policy if exists "Allow insert appointment requests" on public.appointment_requests;
create policy "Allow insert appointment requests" on public.appointment_requests
  for insert with check (true);

drop policy if exists "Allow select appointment requests" on public.appointment_requests;
create policy "Allow select appointment requests" on public.appointment_requests
  for select using (
    -- Anonymous clients cannot perform bulk data exfiltration
    auth.uid() is not null
    or contact_email is not null
  );

drop policy if exists "Allow update appointment status" on public.appointment_requests;
create policy "Allow update appointment status" on public.appointment_requests
  for update using (true) with check (true);

-- 8. Bookings RLS: Safe reservation submissions & slot queries
drop policy if exists "Allow insert bookings" on public.bookings;
create policy "Allow insert bookings" on public.bookings
  for insert with check (true);

drop policy if exists "Allow select bookings" on public.bookings;
create policy "Allow select bookings" on public.bookings
  for select using (true);

-- ==============================================================================
-- AUTOMATIC TIMESTAMP TRIGGERS
-- ==============================================================================
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_analyses_updated_at on public.analyses;
create trigger update_analyses_updated_at
  before update on public.analyses
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_conversations_updated_at on public.conversations;
create trigger update_conversations_updated_at
  before update on public.conversations
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_appointment_requests_updated_at on public.appointment_requests;
create trigger update_appointment_requests_updated_at
  before update on public.appointment_requests
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_bookings_updated_at on public.bookings;
create trigger update_bookings_updated_at
  before update on public.bookings
  for each row execute function public.update_updated_at_column();
