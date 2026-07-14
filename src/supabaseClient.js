import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bbcdevzxlgcukadrzwrp.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiY2Rldnp4bGdjdWthZHJ6d3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NzA1OTUsImV4cCI6MjA5ODU0NjU5NX0.DSSuKHLiGVUGrKmUwF9JPS32oWkjH_31zrPyhx3WL0E'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
