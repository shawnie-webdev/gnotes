/**
 * GoldenNotes write-permission helper.
 * Checks public.editors for the signed-in user's UUID via column "user-uuid".
 * Write UI stays disabled until the user is listed as an editor.
 */
(function (global) {
    async function getSessionUser(client) {
        try {
            const { data: { session }, error } = await client.auth.getSession();
            if (error) {
                console.error('Auth session error:', error.message);
                return null;
            }
            return session?.user || null;
        } catch (err) {
            console.error('Auth session exception:', err);
            return null;
        }
    }

    /**
     * Returns true when the user's id appears in editors."user-uuid".
     */
    async function userHasWritePermission(client, userId) {
        if (!userId) return false;

        try {
            const { data, error } = await client
                .from('editors')
                .select('*')
                .eq('user-uuid', userId)
                .limit(1);

            if (error) {
                console.error('editors query failed:', error.message);
                return false;
            }

            return Array.isArray(data) && data.length > 0;
        } catch (err) {
            console.error('editors exception:', err);
            return false;
        }
    }

    function normalizeElements(elements) {
        if (!elements) return [];
        if (typeof elements === 'string') {
            return Array.from(document.querySelectorAll(elements));
        }
        if (NodeList.prototype.isPrototypeOf(elements) || Array.isArray(elements)) {
            return Array.from(elements).filter(Boolean);
        }
        return [elements].filter(Boolean);
    }

    function setWriteEnabled(elements, enabled, reason) {
        normalizeElements(elements).forEach((el) => {
            el.disabled = !enabled;
            el.setAttribute('aria-disabled', enabled ? 'false' : 'true');

            if (!enabled) {
                el.classList.add('write-disabled');
                el.title = reason || 'Editor access required';
            } else {
                el.classList.remove('write-disabled');
                el.removeAttribute('title');
            }
        });
    }

    /**
     * Disable write controls by default, then enable only for editors.
     * @returns {{ user: object|null, canWrite: boolean }}
     */
    async function initWriteControls(client, elements) {
        const list = normalizeElements(elements);
        setWriteEnabled(list, false, 'Checking editor access…');

        const user = await getSessionUser(client);
        if (!user) {
            setWriteEnabled(
                list,
                false,
                'Log in with an editor account to use this action'
            );
            return { user: null, canWrite: false };
        }

        const canWrite = await userHasWritePermission(client, user.id);
        setWriteEnabled(
            list,
            canWrite,
            canWrite ? '' : 'Your account is not listed in the editors table'
        );
        return { user, canWrite };
    }

    global.GoldenNotesPermissions = {
        getSessionUser,
        userHasWritePermission,
        setWriteEnabled,
        initWriteControls
    };
})(window);
