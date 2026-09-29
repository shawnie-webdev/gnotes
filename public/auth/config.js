/**
 * GoldenNotes Configuration.
 * Centralized Supabase credentials and client initialization.
 */
(function (global) {
    const SUPABASE_URL = 'https://cqxlnmvmfkylozcdffxf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxeGxubXZtZmt5bG96Y2RmZnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NDc4OTMsImV4cCI6MjEwNDMyMzg5M30.mpxEjcWdD9Vy0WsHRL7O8n1fWfnKInsBmOgaYsiv_38';

    function initClient() {
        if (global.supabaseClient) return global.supabaseClient;
        if (!global.supabase || typeof global.supabase.createClient !== 'function') {
            console.error('Supabase JS SDK not loaded. Please ensure the CDN script is included before config.js');
            return null;
        }
        global.supabaseClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return global.supabaseClient;
    }

    global.GoldenNotesConfig = {
        URL: SUPABASE_URL,
        KEY: SUPABASE_ANON_KEY,
        initClient
    };

    // Auto-initialize if SDK is available
    if (global.supabase) {
        initClient();
    }
})(window);
