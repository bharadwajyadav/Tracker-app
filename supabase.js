import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://myjaozwmhelujfwjltej.supabase.co';
const SUPABASE_KEY = 'sb_publishable_902m8DmeosVv0aYV6HEYHA_WMyCUfkS';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
