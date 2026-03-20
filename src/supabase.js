import { createClient } from '@supabase/supabase-js';

// ✅ SECURITY: Never hardcode credentials. Use .env file.
// Create a .env file in project root:
//   VITE_SUPABASE_URL=https://yourproject.supabase.co
//   VITE_SUPABASE_ANON_KEY=your_anon_key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ Missing Supabase credentials. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);
