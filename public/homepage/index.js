// REMOVED the import line. We now grab it from the window object loaded by the CDN in Step 1.
const { createClient } = window.supabase;

const supabaseUrl = 'https://cqxlnmvmfkylozcdffxf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxeGxubXZtZmt5bG96Y2RmZnhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NDc4OTMsImV4cCI6MjEwNDMyMzg5M30.mpxEjcWdD9Vy0WsHRL7O8n1fWfnKInsBmOgaYsiv_38';

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'X-App-Version': '1.0.0'
        }
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const loginBtn = document.getElementById("login");
    const whatsNewGrid = document.getElementById("whats-new-grid");

    if (!supabaseClient) {
        console.error('Supabase client not initialized');
        return;
    }

    // 1. Load Announcements for "What's New"
    try {
        const { data: announcements, error } = await supabaseClient
            .from('announcements')
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
            window.location.href = "../auth/login.html";
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