// Cấu hình kết nối Supabase
const SUPABASE_URL = 'https://xophthgrzhcifnkukejd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvcGh0aGdyemhjaWZua3VrZWpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NTY1MDMsImV4cCI6MjEwNjMzMjUwM30.mgiHWJI0DNKJP7mP1SZR0aj8X6w0hKxWldMWSe0T_uI';

// Khởi tạo Supabase client
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
