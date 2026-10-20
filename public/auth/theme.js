/**
 * GoldenNotes theme helper.
 * Persists prefer-light-mode in public.settings ("user-uuid", "prefer-light-mode").
 * Applies via document.documentElement[data-theme="light"|"dark"|"experimental"].
 */
(function (global) {
    const SUPABASE_URL = 'https://cqxlnmvmfkylozcdffxf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxeGxubXZtZmt5bG96Y2RmZnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NDc4OTMsImV4cCI6MjEwNDMyMzg5M30.mpxEjcWdD9Vy0WsHRL7O8n1fWfnKInsBmOgaYsiv_38';
    const STORAGE_KEY = 'gn-theme';
    const EXPERIMENTAL_STORAGE_KEY = 'gn-experimental-theme';
    let lightMode = true;
    let experimentalMode = false;

    function applyTheme(isLight) {
        lightMode = !!isLight;
        const theme = isLight ? 'light' : 'dark';
        if (!experimentalMode) {
            document.documentElement.setAttribute('data-theme', theme);
        }
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (_) { /* ignore */ }
        return experimentalMode ? 'experimental' : theme;
    }

    function applyExperimentalTheme(isExperimental) {
        experimentalMode = !!isExperimental;
        try {
            localStorage.setItem(EXPERIMENTAL_STORAGE_KEY, String(experimentalMode));
        } catch (_) { /* ignore */ }
        if (experimentalMode) {
            document.documentElement.setAttribute('data-theme', 'experimental');
        } else {
            applyTheme(lightMode);
        }
        return experimentalMode;
    }
    // Fast paint from local cache (avoids flash before auth/settings fetch)
    (function bootstrapFromCache() {
        try {
            const cached = localStorage.getItem(STORAGE_KEY);
            lightMode = cached !== 'dark';
            experimentalMode = localStorage.getItem(EXPERIMENTAL_STORAGE_KEY) === 'true';
        } catch (_) { /* ignore */ }
        document.documentElement.setAttribute(
            'data-theme',
            experimentalMode ? 'experimental' : lightMode ? 'light' : 'dark'
        );
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
        return lightMode;
    }

    async function initThemeFromUser() {
        const client = getClient();
        if (!client) return null;

        try {
            const { data: { user }, error: authError } = await client.auth.getUser();
            if (authError || !user) return null;

            const { data, error } = await client
                .from('settings')
                .select('prefer-light-mode, experimental-mode')
                .eq('user-uuid', user.id)
                .maybeSingle();

            if (error) {
                console.error('settings fetch failed:', error.message);
                return null;
            }

            if (data && Object.prototype.hasOwnProperty.call(data, 'prefer-light-mode')) {
                applyTheme(!!data['prefer-light-mode']);
            }

            if (data && Object.prototype.hasOwnProperty.call(data, 'experimental-mode')) {
                applyExperimentalTheme(!!data['experimental-mode']);
            }

            return isLightThemeActive();
        } catch (err) {
            console.error('initThemeFromUser exception:', err);
            return null;
        }
    }

    async function updateThemePreference(isLightMode) {
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
                applyTheme(!!isLightMode);
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

            applyTheme(!!isLightMode);
            return { data: inserted && inserted[0], error: null };
        } catch (err) {
            console.error('updateThemePreference exception:', err);
            return { error: err };
        }
    }

    global.GoldenNotesTheme = {
        applyTheme,
        applyExperimentalTheme,
        initThemeFromUser,
        updateThemePreference,
        isLightThemeActive,
        getClient
    };

    // Recovery uses a separate verified email, not a linked Google identity.
    async function enforceGoogleLink(session) {
        const path = location.pathname;
        const exempt = ['/auth/google-link.html', '/auth/recovery.html', '/auth/phone-setup.html', '/auth/login.html', '/auth/signup.html', '/login', '/login.html', '/signup'];
        if (!session?.access_token || exempt.includes(path) || path.startsWith('/auth/google-link')) return;
        try {
            const { data, error } = await getClient().auth.getUser(session.access_token);
            if (error || !data?.user) return;
            if (data.user.user_metadata?.password_reset_required && path !== '/auth/password-change.html') {
                location.replace('/auth/password-change.html');
                return;
            }
            // Do not force OAuth identity linking for password recovery.

        } catch (err) {
            console.warn('Could not verify Google-link status:', err);
        }
    }

    function installGoogleLinkGuard() {
        const client = getClient();
        if (!client || global.__gnGoogleLinkGuardInstalled) return;
        global.__gnGoogleLinkGuardInstalled = true;
        client.auth.getSession().then(({ data, error }) => {
            if (!error) enforceGoogleLink(data?.session);
        });
        client.auth.onAuthStateChange((event, session) => {
            if (event !== 'INITIAL_SESSION' && session) {
                Promise.resolve().then(() => enforceGoogleLink(session));
            }
        });
    }

    // Shared guard: check existing/background sessions on pages that load theme.js.
    // Supabase may still have a cached session after the server bans the account.
    async function checkBanStatus(session) {
        if (!session?.access_token || location.pathname.endsWith('/ban.html')) return;
        try {
            const response = await fetch('/auth/ban-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + session.access_token
                },
                body: '{}'
            });
            if (!response.ok) return;
            const result = await response.json();
            if (result.banned) {
                const reason = encodeURIComponent(result.reason || 'No reason was provided.');
                location.replace('/auth/ban.html?reason=' + reason);
            }
        } catch (err) {
            console.warn('Could not verify account ban status:', err);
        }
    }

    function installBanGuard() {
        const client = getClient();
        if (!client || global.__gnBanGuardInstalled) return;
        global.__gnBanGuardInstalled = true;
        client.auth.getSession().then(({ data, error }) => {
            if (!error) checkBanStatus(data?.session);
        });
        client.auth.onAuthStateChange((event, session) => {
            if (event !== 'INITIAL_SESSION' && session) {
                // Defer network work until Supabase finishes its auth callback.
                Promise.resolve().then(() => checkBanStatus(session));
            }
        });
    }

    function autoInit() {
        if (!global.supabase) return;
        initThemeFromUser();
        installBanGuard();
        installGoogleLinkGuard();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }

    // Keep the Quiz entry available in every page using the shared theme script.
    function addQuizNavigation() {
        document.querySelectorAll('.dropdown-content').forEach(menu => {
            if (menu.querySelector('a[href="/quiz"]')) return;
            const link = document.createElement('a');
            link.href = '/quiz';
            link.className = 'btn btn-secondary';
            link.textContent = 'Quizzes';
            menu.appendChild(link);
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addQuizNavigation, { once: true });
    } else {
        addQuizNavigation();
    }

})(window);
