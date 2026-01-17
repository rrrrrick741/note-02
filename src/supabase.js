import { createClient } from '@supabase/supabase-js'
// 这里的 URL 和 Key 需要替换成你自己的
const supabaseUrl = 'https://mzchpfhxkyusdtutltzr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16Y2hwZmh4a3l1c2R0dXRsdHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjQyMjQsImV4cCI6MjA4NDI0MDIyNH0.5qbF7XVX90LTXF3oWDpBbfgTaP-Nc0Sueyle_t6KSpI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)