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


 // Secret scavenger badge redemption: magnifying-glass opens the code dialog.
 const scavengerModal = document.getElementById('scavenger-redeem-modal');
 const scavengerCodeInput = document.getElementById('scavenger-code');
 const scavengerStatus = document.getElementById('scavenger-redeem-status');
 const scavengerOpen = document.getElementById('scavenger-secret-trigger');
 const scavengerClose = document.getElementById('scavenger-redeem-close');
 const scavengerSubmit = document.getElementById('scavenger-redeem-submit');
 function openScavengerModal() {
   if (!scavengerModal) return;
   scavengerModal.hidden = false; scavengerModal.style.display = 'flex';
   scavengerStatus.textContent = ''; scavengerCodeInput?.focus();
 }
 function closeScavengerModal() {
   if (!scavengerModal) return;
   scavengerModal.hidden = true; scavengerModal.style.display = 'none';
 }
 scavengerOpen?.addEventListener('click', openScavengerModal);
 scavengerClose?.addEventListener('click', closeScavengerModal);
 scavengerModal?.addEventListener('click', event => { if (event.target === scavengerModal) closeScavengerModal(); });
 scavengerCodeInput?.addEventListener('keydown', event => { if (event.key === 'Enter') scavengerSubmit?.click(); });
 scavengerSubmit?.addEventListener('click', async () => {
   const code = scavengerCodeInput?.value.trim().toUpperCase() || '';
   if (!code) { scavengerStatus.textContent = 'Enter a code first.'; return; }
   scavengerSubmit.disabled = true; scavengerStatus.textContent = 'Checking code…';
   try {
     const { data: { session }, error } = await supabaseClient.auth.getSession();
     if (error || !session?.access_token) throw new Error('Sign in first to redeem a badge.');
     const response = await fetch('/api/scavenger/redeem', { method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token}, body:JSON.stringify({code}) });
     const result = await response.json().catch(()=>({}));
     if (!response.ok) throw new Error(result.error || 'Could not redeem code.');
     scavengerStatus.textContent = result.message || 'Badge redeemed!';
     scavengerStatus.style.color = 'var(--success, #27a66b)'; scavengerCodeInput.value = '';
   } catch (error) {
     scavengerStatus.textContent = error.message || 'Could not redeem code.';
     scavengerStatus.style.color = 'var(--danger, #d33)';
   } finally { scavengerSubmit.disabled = false; }
 });

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
                    <h3>${ann.name || 'No Title'}</h3>
                    <a href="${link}" class="technical-text">View Details →</a>
                `;

                card.addEventListener('click', () => {
                    window.location.href = `/announcement/view?event=${ann.id}`;
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

    document.getElementById("make-ann").addEventListener("click", (e) => {
        window.location.href = "/announcement"
    })
});