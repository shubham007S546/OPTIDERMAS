import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uwlatkypjzfnobrobzns.supabase.co'
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_wXqtTFvTROzE0h0bqQfAag_Z-l2Ci-x'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface SupabaseBookingRow {
  id?: string
  reference: string
  slot_id: string
  slot_date: string
  slot_label: string
  name: string
  email: string
  reason?: string
  status?: string
  created_at?: string
}
