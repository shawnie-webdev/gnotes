document.addEventListener('DOMContentLoaded', async () => {
    const loginBtn = document.getElementById("login");
    const whatsNewGrid = document.getElementById("whats-new-grid");
    const supabaseClient = window.supabaseClient;

    if (!supabaseClient) {
        console.error('Supabase client not initialized');
        return;
    }

    // 1. Load Announcements for "What's New"
    try {
        const { data: announcements, error } = await supabaseClient
            .from('announcement')
            .select('*')
            .order('created-on', { ascending: false })
            .limit(4);

        if (error) throw error;

        if (announcements && announcements.length > 0) {
            whatsNewGrid.innerHTML = '';
            announcements.forEach(ann => {
                const typeBadge = ann['announcement-type'] === 'calendar' ? 'badge-blue' : 'badge-orange';
                const typeLabel = ann['announcement-type'] === 'calendar' ? 'New Event' : 'Updated';
                const link = ann['announcement-type'] === 'calendar' ? '/calendar/index.html' : '/announcement/index.html';

                const card = document.createElement('div');
                card.className = 'preview-card';
                card.innerHTML = `
                    <span class="badge ${typeBadge}">${typeLabel}</span>
                    <h3>${ann.author || 'Anonymous'}</h3>
                    <p>${ann.content || 'No content provided.'}</p>
                    <a href="${link}" class="technical-text">View Details →</a>
                `;
                whatsNewGrid.appendChild(card);
            });
        }
    } catch (e) {
        console.error('Error loading announcements:', e);
    }

    // 2. Auth logic
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        const username = session.user.user_metadata?.username || "User";
        loginBtn.innerText = `Hi, ${username}!`;
    } else {
        loginBtn.innerText = "Login";
        loginBtn.addEventListener("click", () => {
            window.location.href = "/auth/login.html";
        });
    }

    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session) {
            const username = session.user.user_metadata?.username || "User";
            loginBtn.innerText = `Hi, ${username}!`;
        } else {
            loginBtn.innerText = "Login";
        }
    });
});