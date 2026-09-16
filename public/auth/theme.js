/**
 * GoldenNotes theme helper.
 * Persists prefer-light-mode in public.settings ("user-uuid", "prefer-light-mode").
 * Applies via document.documentElement[data-theme="light"|"dark"].
 */
(function (global) {
    const SUPABASE_URL = 'https://cqxlnmvmfkylozcdffxf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxeGxubXZtZmt5bG96Y2RmZnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NDc4OTMsImV4cCI6MjEwNDMyMzg5M30.mpxEjcWdD9Vy0WsHRL7O8n1fWfnKInsBmOgaYsiv_38';
    const STORAGE_KEY = 'gn-theme';

    function applyTheme(isLight) {
        const theme = isLight ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (_) { /* ignore */ }
        return theme;
    }

    // Fast paint from local cache (avoids flash before auth/settings fetch)
    (function bootstrapFromCache() {
        try {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached === 'light' || cached === 'dark') {
                document.documentElement.setAttribute('data-theme', cached);
                return;
            }
        } catch (_) { /* ignore */ }
        document.documentElement.setAttribute('data-theme', 'dark');
    })();

    function getClient() {
        if (global.__gnThemeSupabase) return global.__gnThemeSupabase;
        if (!global.supabase || typeof global.supabase.createClient !== 'function') {
            return null;
        }
        global.__gnThemeSupabase = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return global.__gnThemeSupabase;
    }

    function isLightThemeActive() {
        return document.documentElement.getAttribute('data-theme') === 'light';
    }

    async function initThemeFromUser() {
        const client = getClient();
        if (!client) return null;

        try {
            const { data: { user }, error: authError } = await client.auth.getUser();
            if (authError || !user) return null;

            const { data, error } = await client
                .from('settings')
                .select('prefer-light-mode')
                .eq('user-uuid', user.id)
                .maybeSingle();

            if (error) {
                console.error('settings fetch failed:', error.message);
                return null;
            }

            if (data && Object.prototype.hasOwnProperty.call(data, 'prefer-light-mode')) {
                applyTheme(!!data['prefer-light-mode']);
                return !!data['prefer-light-mode'];
            }

            return isLightThemeActive();
        } catch (err) {
            console.error('initThemeFromUser exception:', err);
            return null;
        }
    }

    async function updateThemePreference(isLightMode) {
        applyTheme(!!isLightMode);

        const client = getClient();
        if (!client) {
            return { error: new Error('Supabase client unavailable') };
        }

        try {
            const { data: { user }, error: authError } = await client.auth.getUser();
            if (authError || !user) {
                return { error: new Error('Not logged in') };
            }

            const payload = { 'prefer-light-mode': !!isLightMode };

            const { data: updated, error: updateError } = await client
                .from('settings')
                .update(payload)
                .eq('user-uuid', user.id)
                .select();

            if (updateError) {
                console.error('settings update failed:', updateError.message);
                return { error: updateError };
            }

            if (updated && updated.length > 0) {
                return { data: updated[0], error: null };
            }

            // No existing row — insert one for this user
            const { data: inserted, error: insertError } = await client
                .from('settings')
                .insert([{ 'user-uuid': user.id, 'prefer-light-mode': !!isLightMode }])
                .select();

            if (insertError) {
                console.error('settings insert failed:', insertError.message);
                return { error: insertError };
            }

            return { data: inserted && inserted[0], error: null };
        } catch (err) {
            console.error('updateThemePreference exception:', err);
            return { error: err };
        }
    }

    global.GoldenNotesTheme = {
        applyTheme,
        initThemeFromUser,
        updateThemePreference,
        isLightThemeActive,
        getClient
    };

    function autoInit() {
        if (!global.supabase) return;
        initThemeFromUser();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }
})(window);
