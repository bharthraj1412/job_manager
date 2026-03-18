import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qxjiagqgjhksuzurvdqf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4amlhZ3Fnamhrc3V6dXJ2ZHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NDMwMzAsImV4cCI6MjA4OTQxOTAzMH0.oBRvRbGA3_XlVVkdOycAq37QVrahnAEKfpshCUh0ins';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
