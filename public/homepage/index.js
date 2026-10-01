// Grab createClient from the window object loaded by the CDN script
const { createClient } = window.supabase;

const supabaseUrl = 'https://cqxlnmvmfkylozcdffxf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxeGxubXZtZmt5lozcdffxfIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NDc4OTMsImV4cCI6MjEwNDMyMzg5M30.mpxEjcWdD9Vy0WsHRL7O8n1fWfnKInsBmOgaYsiv_38';

// Reuse existing instance if theme.js initialized it first to prevent GoTrueClient warning
const supabaseClient = window.supabaseClient || createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'X-App-Version': '1.0.0'
        }
    }
});
window.supabaseClient = supabaseClient;

document.addEventListener('DOMContentLoaded', async () => {
    console.log("page loaded")
    const loginBtn = document.getElementById("login");
    const whatsNewGrid = document.getElementById("whats-new-grid");

    if (!supabaseClient) {
        console.error('Supabase client not initialized');
        return;
    }

    // 1. Load Announcements for "What's New"
    console.log("loading annoucement page");
    try {
        const { data: announcements, error } = await supabaseClient
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false }) // Fixed: changed 'created-on' to 'created_at'
            .limit(5);
        console.log("fetched announcements table")

        if (error) {
            console.log("error!")
            throw error;
        }

        if (announcements && announcements.length > 0) {
            whatsNewGrid.innerHTML = '';
            announcements.forEach(ann => {
                console.log("inserting new annoucement")
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

                card.addEventListener('click', () => {
                    window.location.href = `/announcement?view${ann.id}`;
                })
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