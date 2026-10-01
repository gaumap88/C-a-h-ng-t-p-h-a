window.APP_CONFIG = {
  SUPABASE_URL: 'https://xophthgrzhcifnkukejd.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_SgSXpvvAzs621BfjQBWpZw_rmLgV6qn'
};

// Khởi tạo Supabase client
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
