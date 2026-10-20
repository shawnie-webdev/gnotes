/* Project Goldenotes | Inspiration by Ram, Programmed by Roshaun */

const cookieParser = require('cookie-parser'); // <-- Add this
const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js"); // 1. Import createClient

const SUPABASE_URL = 'https://cqxlnmvmfkylozcdffxf.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// Initialize inside block scope to avoid global collision
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("[INFO]: Server module loading - [server.js]");

const app = express();

// Middleware (Declare body parsers and static assets BEFORE route handlers)
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
const publicStatic = express.static("public");
app.use((req, res, next) => {
    // This page must pass through the role-checking route below, not be served directly.
    if (req.path === "/auth/admin/admin-dashboard.html") return next();
    return publicStatic(req, res, next);
});
app.use(cookieParser()); // <-- Add this middleware
app.use('/tinymce', express.static(path.join(__dirname, 'node_modules', 'tinymce')));

const publicDir = path.join(__dirname, "public");
console.log("[server.js] - Public directory at:");
console.log(publicDir);

let logs = []

function log(type, param, message) {
    const append = {
        type : type,
        info : param,
        message : message
    }

    logs.push(append);
}

const PORT = Number(process.env.PORT) || 3000;

function getIP() {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }

    return '127.0.0.1';
}
const localIP = getIP();

function sendErrorPage(res, status, endpoint = res.req?.originalUrl || "unknown", err = null) {
    const info = {
        404: "The file/object was not found, either it was moved, renamed or deleted, or did not exist in the first place",
        401: "The action you are trying to do is unauthorized, the server does not know who you are, logging in might fix this",
        403: "The action you are trying to do is forbidden, you may not have enough permissions to do this",
        429: "You are sending too many requests to the server",

        500: "An error occurred inside the server while processing your request",
        502: "A proxy/gateway server got an invalid response from an upstream server",
        503: "The server might be temporarily overloaded or the service you are trying to use is unavailable"
    };

    const meaning = {
        404: "File/object not found",
        401: "Unauthorized",
        403: "Forbidden",
        429: "Too many requests",

        500: "Internal Server Error",
        502: "Bad Gateway",
        503: "Service temporarily unavailable"
    };

    res.status(status).type('html').send(`
        <!DOCTYPE html>
        <html>
            <head><title>Error ${status}</title></head>
            <body style="font-family: sans-serif; padding: 20px;">
                <h1>HTTP Status Code ${status} - ${meaning[status] || 'Error'}</h1>
                <h3>${info[status] || 'An error occurred.'}</h3>
                <p>More about this error:</p>
                <ul>
                    <li>Endpoint: ${endpoint}</li>
                </ul>
            </body>
        </html>
    `);
}

function sendFileOrError(res, endpoint, raw) {
    const filePath = path.join(publicDir, raw);
    console.log(`[server.js]: Sending file '${filePath}' for endpoint '${endpoint}'`);

    if (!fs.existsSync(filePath)) {
        return sendErrorPage(res, 404, endpoint, new Error(`File not found: ${filePath}`));
    }

    return res.sendFile(filePath, (err) => {
        if (err && !res.headersSent) {
            return sendErrorPage(res, 500, endpoint, err);
        }

        if (!err) {
            console.log(`[server.js]: Served file for ${endpoint}`);
        }
    });
}

// Middleware to log all GET requests and their status codes
app.use((req, res, next) => {
    if (req.method === 'GET') {
        const startTime = Date.now();

        // The 'finish' event fires when the response has fully sent
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            const statusCode = res.statusCode;

            log(
                "info",
                {
                    timeinfo : {
                        'start' : startTime,
                        'end' : duration + startTime,
                        'duration' : duration
                    },
                    endpoint: req.path,             // e.g. "/developers/debug"
                    fullUrl: req.originalUrl,       // e.g. "/developers/debug?ref=nav"
                    params: req.params,             // Route parameters
                    query: req.query,               // Query string parameters (?key=value)
                    statusCode : statusCode,
                    request_type : 'get'
                },
                "get request on endpoint, view info to know more"
            )
        });
    }
    next(); // Pass control to the next route handler
});


/* === QUIZZES === */
app.get("/quiz", (req, res) => sendFileOrError(res, "/quiz", "student_resources/quiz/index.html"));
app.get("/quiz/make", (req, res) => sendFileOrError(res, "/quiz/make", "student_resources/quiz/make.html"));
app.get("/quiz/answer", (req, res) => {
    if (!req.query.uuid && req.url.includes("?=")) {
        const id = req.url.split("?=")[1]?.split("&")[0];
        if (id) return res.redirect(302, "/quiz/answer?uuid=" + encodeURIComponent(id));
    }
    return sendFileOrError(res, "/quiz/answer", "student_resources/quiz/view.html");
});
app.get("/api/quizzes", async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from("quizzes")
            .select("uuid,author,metadata,created_on").order("created_on", { ascending: false }).limit(200);
        if (error) throw error;
        res.set("Cache-Control", "no-store");
        return res.json({ quizzes: data || [] });
    } catch (error) {
        console.error("[quiz] list failed:", error.message);
        return res.status(503).json({ error: "Quizzes are temporarily unavailable." });
    }
});
app.get("/api/quizzes/:uuid", async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin.from("quizzes").select("uuid,author,metadata,questions,created_on")
            .eq("uuid", req.params.uuid).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Quiz not found." });
        const questions = (Array.isArray(data.questions) ? data.questions : []).map(({ answer, correct, ...q }) => q);
        res.set("Cache-Control", "no-store");
        return res.json({ quiz: { ...data, questions } });
    } catch (error) {
        console.error("[quiz] read failed:", error.message);
        return res.status(503).json({ error: "Could not load this quiz." });
    }
});
app.post("/api/quizzes", async (req, res) => {
    try {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token) return res.status(401).json({ error: "Sign in to publish a quiz." });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: "Your session expired. Please sign in again." });
        const [{ data: profile, error: profileError }, { data: editors, error: editorError }] = await Promise.all([
            supabaseAdmin.from("user-background").select("rank").eq("uuid", user.id).maybeSingle(),
            supabaseAdmin.from("editors").select("*").eq("user-uuid", user.id).limit(1)
        ]);
        if (profileError || editorError) return res.status(503).json({ error: "Could not verify editor permissions." });
        if (!["Admin", "Moderator"].includes(profile?.rank) && !(editors || []).length) {
            return res.status(403).json({ error: "Editor, Moderator, or Admin access required." });
        }
        const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 150) : "";
        const description = typeof req.body?.description === "string" ? req.body.description.trim().slice(0, 2000) : "";
        const questions = req.body?.questions;
        if (!title || !Array.isArray(questions) || questions.length < 1 || questions.length > 100)
            return res.status(400).json({ error: "Add a title and between 1 and 100 questions." });
        const allowed = new Set(["single", "text", "scale", "multiple"]);
        for (const q of questions) {
            if (!q || typeof q.prompt !== "string" || !q.prompt.trim() || !allowed.has(q.type))
                return res.status(400).json({ error: "Every question needs text and a supported question type." });
            if (["single", "multiple"].includes(q.type) && (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 20))
                return res.status(400).json({ error: "Choice questions need 2–20 options." });
            if (q.type === "scale" && (!Number.isFinite(Number(q.min)) || !Number.isFinite(Number(q.max)) || Number(q.max) <= Number(q.min)))
                return res.status(400).json({ error: "Scale questions need a valid minimum and maximum." });
        }
        const metadata = { title, description };
        const cleanQuestions = questions.map(q => ({
            prompt: q.prompt.trim().slice(0, 1000), type: q.type,
            ...(q.type === "single" || q.type === "multiple" ? {
                options: q.options.map(v => String(v).trim().slice(0, 300)).filter(Boolean),
                answer: Array.isArray(q.answer) ? q.answer.map(String) : [String(q.answer ?? "")]
            } : {}),
            ...(q.type === "scale" ? { min: Number(q.min), max: Number(q.max), minLabel: String(q.minLabel || "").slice(0, 80), maxLabel: String(q.maxLabel || "").slice(0, 80) } : {}),
            ...(q.type === "text" ? { answer: String(q.answer || "").trim().slice(0, 500) } : {})
        }));
        const { data, error } = await supabaseAdmin.from("quizzes")
            .insert({ author: user.id, metadata, questions: cleanQuestions })
            .select("uuid,author,metadata,created_on").single();
        if (error) throw error;
        return res.status(201).json({ quiz: data });
    } catch (error) {
        console.error("[quiz] publish failed:", error.message);
        return res.status(500).json({ error: "Could not publish quiz." });
    }
});
app.post("/api/quizzes/:uuid/answer", async (req, res) => {
    try {
        const { data: quiz, error } = await supabaseAdmin.from("quizzes").select("questions").eq("uuid", req.params.uuid).maybeSingle();
        if (error) throw error;
        if (!quiz) return res.status(404).json({ error: "Quiz not found." });
        const submitted = req.body?.answers || {};
        let correct = 0, gradable = 0;
        for (let i = 0; i < quiz.questions.length; i++) {
            const q = quiz.questions[i];
            if (!["single", "multiple", "text"].includes(q.type)) continue;

            // Choice answers are stored as arrays; text answers are stored as strings.
            const rawExpected = Array.isArray(q.answer) ? q.answer : [q.answer ?? ""];
            const expected = rawExpected.map(v => String(v).trim().toLowerCase()).filter(Boolean).sort();
            if (!expected.length) continue;

            gradable++;
            const actualValue = submitted[i];
            const actual = (Array.isArray(actualValue) ? actualValue : [actualValue ?? ""])
                .map(v => String(v).trim().toLowerCase()).filter(Boolean).sort();
            if (expected.length === actual.length && expected.every((v, n) => v === actual[n])) correct++;
        }
        return res.json({ correct, gradable, total: quiz.questions.length, message: gradable ? "Your answers have been checked." : "Answers submitted. This quiz has no automatically gradable questions." });
    } catch (error) {
        console.error("[quiz] answer failed:", error.message);
        return res.status(500).json({ error: "Could not check your answers." });
    }
});

/* ===---===---=== ENDPOINTS ===---===---=== */

app.get("/", (req, res) => sendFileOrError(res, '/', 'homepage/index.html'));
app.get("/credits", (req, res) => sendFileOrError(res, '/credits', 'credits.html'));

app.get("/login.html", (req, res) => sendFileOrError(res, '/login.html', 'auth/login.html'));
app.get("/login", (req, res) => sendFileOrError(res, '/login', 'auth/login.html'));
app.get("/signup", (req, res) => sendFileOrError(res, '/signup', 'auth/signup.html'));
app.get("/dashboard", (req, res) => sendFileOrError(res, '/dashboard', 'auth/dashboard.html'));
app.get("/dashboard/view/user", (req, res) => sendFileOrError(res, '/dashboard/view/user', 'auth/view-other.html'));
app.get("/dashboard/settings", (req, res) => sendFileOrError(res, '/dashboard/settings', 'auth/settings.html'));
app.get("/settings", (req, res) => res.redirect(301, "/dashboard/settings"));

app.get("/corkboard", (req, res) => sendFileOrError(res, '/corkboard', 'corkboard/join.html'));
app.get("/corkboard/help", (req, res) => sendFileOrError(res, '/corkboard/help', 'corkboard/help.html'));
app.get("/corkboard/join", (req, res) => sendFileOrError(res, '/corkboard/join', 'corkboard/main.html'));
app.get("/corkboard/new", (req, res) => res.redirect(301, "/corkboard"));


app.get("/study", (req, res) => sendFileOrError(res, '/study', 'study/course-list.html'));
app.get("/study/new-topic", (req, res) => sendFileOrError(res, '/study/new-topic', 'study/courses/newtopic.html'));
app.get("/study/view", (req, res) => sendFileOrError(res, '/study/view', 'study/courses/viewtopic.html'));
app.get("/study/advanced-topics", (req, res) => sendFileOrError(res, '/study/advanced-topics', 'study/courses/advanced-topics.html'));
app.get("/study/new-advanced", (req, res) => sendFileOrError(res, '/study/new-advanced', 'study/courses/new-advanced.html'));

app.get("/documents", (req, res) => sendFileOrError(res, '/documents', 'documents/viewer.html'));
app.get("/documents/add", (req, res) => sendFileOrError(res, '/documents/add', 'documents/filesupload.html'));
app.get("/calendar", (req, res) => sendFileOrError(res, '/calendar', 'calendar/index.html'));
app.get("/calendar/new", (req, res) => sendFileOrError(res, '/calendar/new', 'calendar/new.html'));

app.get("/announcement/view", (req, res) => sendFileOrError(res, '/announcement/view', '/announcement/view.html'));

app.get("/public", (req, res) => res.redirect("/"));

app.get("/man-page/index.html", (req, res) => sendFileOrError(res, '/man-page/index.html', 'man-page/index.html'));
// Keep the dashboard's existing navigation URL mapped to the protected route.
app.get("/admin-dashboard.html", (req, res) => res.redirect(302, "/auth/admin/admin-dashboard.html"));

app.get('/auth/admin/admin-dashboard.html', (req, res) => {
    // The HTML shell contains no privileged data. The dashboard client obtains a
    // Supabase access token and every data/action request is verified by the API.
    // Browser navigation cannot attach a Supabase bearer token, so requiring one
    // on this GET caused valid admins to receive "Unauthorized: No session token".
    res.set('Cache-Control', 'no-store');
    return sendFileOrError(res, '/admin-dashboard', 'auth/admin/admin-dashboard.html');
});

app.get("/developers/debug", async (req, res) => {
    sendFileOrError(res, "/developers/debug", 'developers/debug.html');
});

const ALLOWED_UUIDS = [
    "b7b67983-9547-4290-ba95-65e7e7794ed1",
    "2d0c79c4-e038-49a2-9f68-12c763d23f8a"
];

// Initialize Supabase Admin Client using the SERVICE ROLE KEY
const supabaseAdmin = createClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);
/**
 * Profanity moderation: APILayer when configured, local bad-words fallback otherwise.
 */
const badWordsModule = require("bad-words");
// bad-words v4 may expose the class as a named export rather than module.exports.
const BadWordsFilter =
    (badWordsModule && typeof badWordsModule.Filter === "function" && badWordsModule.Filter) ||
    (badWordsModule && typeof badWordsModule.default === "function" && badWordsModule.default) ||
    (typeof badWordsModule === "function" && badWordsModule);

let localProfanityFilter = null;
if (typeof BadWordsFilter === "function") {
    localProfanityFilter = new BadWordsFilter();
} else {
    console.error("[moderation] Unsupported bad-words export shape; using built-in fallback word matcher.");
}

// Minimal fallback keeps startup alive if the dependency's export shape changes.
const fallbackProfanityPattern = /\b(fuck(?:er|ing|ed|s)?|shit(?:ty|s)?|bitch(?:es)?|asshole|bastard|damn|hell|crap)\b/i;

async function checkProfanity(text) {
    const input = String(text ?? "");
    if (!input.trim()) return { bad_words_total: 0, bad_words_list: [], censored_content: input, provider: "none" };

    if (process.env.APILAYER_API_KEY) {
        try {
            const response = await fetch("https://api.apilayer.com/bad_words?censor_character=*", {
                method: "POST",
                headers: { apikey: process.env.APILAYER_API_KEY, "Content-Type": "text/plain" },
                body: input,
                signal: AbortSignal.timeout(5000)
            });
            if (!response.ok) throw new Error("APILayer returned HTTP " + response.status);
            const result = await response.json();
            if (typeof result.censored_content === "string" && Number.isFinite(Number(result.bad_words_total))) {
                return { ...result, provider: "apilayer" };
            }
            throw new Error("APILayer returned an unexpected response format");
        } catch (error) {
            console.error("[moderation] APILayer failed; using local filter:", error.message);
        }
    }

    const flagged = localProfanityFilter
        ? localProfanityFilter.isProfane(input)
        : fallbackProfanityPattern.test(input);
    return {
        bad_words_total: flagged ? 1 : 0,
        bad_words_list: flagged ? ["profanity"] : [],
        censored_content: flagged
            ? (localProfanityFilter ? localProfanityFilter.clean(input) : input.replace(fallbackProfanityPattern, (match) => "*".repeat(match.length)))
            : input,
        provider: "local"
    };
}

async function incrementProfanityCount(userId, amount = 1, sentence = "") {
    if (!userId || amount < 1) return;
    const { data: userBg, error: readError } = await supabaseAdmin
        .from("user-background").select('"profanity-count", "curse-senetences-said"').eq("uuid", userId).maybeSingle();
    if (readError) throw readError;
    if (!userBg) throw new Error("User background profile not found.");
    const currentCount = Number(userBg["profanity-count"] || 0);
    const sentences = Array.isArray(userBg["curse-senetences-said"]) ? userBg["curse-senetences-said"] : [];
    const trimmedSentence = String(sentence || "").trim().slice(0, 2000);
    const updates = { "profanity-count": currentCount + amount };
    if (trimmedSentence) updates["curse-senetences-said"] = [...sentences, trimmedSentence].slice(-500);
    const { error: updateError } = await supabaseAdmin
        .from("user-background").update(updates).eq("uuid", userId);
    if (updateError) throw updateError;
}

async function appendCurseSentence(userId, sentence) {
    if (!userId || !String(sentence || "").trim()) return;
    const { data: userBg, error: readError } = await supabaseAdmin
        .from("user-background").select('"curse-senetences-said"').eq("uuid", userId).maybeSingle();
    if (readError) throw readError;
    if (!userBg) throw new Error("User background profile not found.");
    const sentences = Array.isArray(userBg["curse-senetences-said"]) ? userBg["curse-senetences-said"] : [];
    const { error } = await supabaseAdmin.from("user-background")
        .update({ "curse-senetences-said": [...sentences, String(sentence).trim().slice(0, 2000)].slice(-500) })
        .eq("uuid", userId);
    if (error) throw error;
}

app.post("/api/tasks", async (req, res) => {
    try {
        const authorization = req.headers.authorization || "";
        const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
        if (!token) return res.status(401).json({ error: "Sign in to create a task." });

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: "Your session has expired. Please sign in again." });

        const { data: profile, error: profileError } = await supabaseAdmin
            .from("user-background")
            .select("rank")
            .eq("uuid", user.id)
            .maybeSingle();
        if (profileError) {
            console.error("[tasks] Rank lookup failed:", profileError.message);
            return res.status(503).json({ error: "Could not verify your permissions." });
        }

        const { data: editorEntries, error: editorError } = await supabaseAdmin
            .from("editors")
            .select("*")
            .eq("user-uuid", user.id)
            .limit(1);
        if (editorError) {
            console.error("[tasks] Editor lookup failed:", editorError.message);
            return res.status(503).json({ error: "Could not verify your permissions." });
        }

        const isStaff = ["Admin", "Moderator"].includes(profile?.rank);
        const isEditor = Array.isArray(editorEntries) && editorEntries.length > 0;
        if (!isStaff && !isEditor) {
            return res.status(403).json({ error: "Editor, Moderator, or Admin access required." });
        }

        const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
        const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
        const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
        if (!title || title.length > 150 || !subject || subject.length > 100 || description.length > 2000) {
            return res.status(400).json({ error: "Enter a task name and subject within the allowed lengths." });
        }

        const moderatedText = [title, description, subject].join(" ");
        const moderation = await checkProfanity(moderatedText);
        const flagged = Number(moderation.bad_words_total || 0) > 0;
        if (flagged) {
            await incrementProfanityCount(user.id, Number(moderation.bad_words_total) || 1, moderatedText);
            return res.status(422).json({ flagged: true, error: "This task cannot be posted." });
        }

        const record = {
            author: user.user_metadata?.username || user.email || "Anonymous",
            subject: { name: subject },
            name: title,
            data: description
        };
        const { error: insertError } = await supabaseAdmin
            .from("tasks")
            .insert([record]);
        if (insertError) {
            console.error("[tasks] Insert failed:", insertError.message);
            return res.status(500).json({ error: "Could not save the task." });
        }

        return res.status(201).json({ success: true });
    } catch (error) {
        console.error("[tasks] Creation failed:", error);
        return res.status(503).json({ error: "Task creation is temporarily unavailable." });
    }
});

app.get("/api/tasks", async (req, res) => {
    try {
        let { data: tasks, error } = await supabaseAdmin
            .from("tasks")
            .select("*")
            .order("created_at", { ascending: false });

        if (error && /created_at/i.test(error.message || "")) {
            ({ data: tasks, error } = await supabaseAdmin.from("tasks").select("*"));
        }
        if (error) {
            console.error("[tasks] List failed:", error.message);
            return res.status(503).json({ error: "Could not load tasks." });
        }

        const publicTasks = (tasks || []).map((task) => ({
            id: task.id,
            author: task.author,
            subject: task.subject,
            name: task.name,
            data: task.data,
            completed: task.completed === true,
            created_at: task.created_at
        }));
        return res.json({ tasks: publicTasks });
    } catch (error) {
        console.error("[tasks] List request failed:", error);
        return res.status(503).json({ error: "Could not load tasks." });
    }
});

app.post("/api/tasks/manage", async (req, res) => {
    try {
        const authorization = req.headers.authorization || "";
        const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
        if (!token) return res.status(401).json({ error: "Sign in to manage tasks." });

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: "Your session has expired. Please sign in again." });

        const [{ data: profile, error: profileError }, { data: editorEntries, error: editorError }] = await Promise.all([
            supabaseAdmin.from("user-background").select("rank").eq("uuid", user.id).maybeSingle(),
            supabaseAdmin.from("editors").select("*").eq("user-uuid", user.id).limit(1)
        ]);
        if (profileError || editorError) {
            console.error("[tasks] Management permission lookup failed:", profileError?.message || editorError?.message);
            return res.status(503).json({ error: "Could not verify your permissions." });
        }

        const allowed = ["Admin", "Moderator"].includes(profile?.rank) ||
            (Array.isArray(editorEntries) && editorEntries.length > 0);
        if (!allowed) return res.status(403).json({ error: "Editor, Moderator, or Admin access required." });

        const { id, action, completed } = req.body || {};
        if (!(typeof id === "string" && id.trim()) && !(typeof id === "number" && Number.isFinite(id))) {
            return res.status(400).json({ error: "A task ID is required." });
        }
        if (action !== "delete" && !(action === "complete" && typeof completed === "boolean")) {
            return res.status(400).json({ error: "Choose a valid task action." });
        }

        const query = action === "delete"
            ? supabaseAdmin.from("tasks").delete().eq("id", id)
            : supabaseAdmin.from("tasks").update({ completed }).eq("id", id);
        const { data, error } = await query.select("id");
        if (error) {
            console.error("[tasks] Management action failed:", error.message);
            return res.status(500).json({ error: "Could not update the task. Check that the tasks table has a completed column." });
        }
        if (!data?.length) return res.status(404).json({ error: "Task not found." });
        return res.json({ success: true });
    } catch (error) {
        console.error("[tasks] Management request failed:", error);
        return res.status(503).json({ error: "Task management is temporarily unavailable." });
    }
});

app.post("/api/moderate-text", async (req, res) => {
    try {
        const authorization = req.headers.authorization || "";
        const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
        if (!token) return res.status(401).json({ error: "Sign in to post content." });
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: "Your session has expired. Please sign in again." });
        if (typeof req.body?.text !== "string") return res.status(400).json({ error: "A text value is required." });

        const result = await checkProfanity(req.body.text);
        const flagged = Number(result.bad_words_total || 0) > 0;
        if (flagged) await incrementProfanityCount(user.id, Number(result.bad_words_total) || 1, req.body.text);
        return res.status(200).json({ flagged, censoredText: result.censored_content, provider: result.provider || "unknown" });
    } catch (error) {
        console.error("[moderation] Text check failed:", error);
        return res.status(503).json({ error: "Content moderation is temporarily unavailable. Please try again." });
    }
});

/**
 * Database webhook supports both the current corkboard schema (text/userid)
 * and legacy payloads (content/user_id).
 */
app.post("/api/profanity-webhook", async (req, res) => {
    try {
        const { record } = req.body || {};
        const text = record?.text ?? record?.content;
        const userId = record?.userid ?? record?.user_id;
        if (typeof text !== "string" || !text.trim() || !userId) {
            return res.status(200).json({ success: true, skipped: true, reason: "No supported text/user fields" });
        }
        const result = await checkProfanity(text);
        const badWordsTotal = Number(result.bad_words_total || 0);
        if (badWordsTotal <= 0) return res.status(200).json({ success: true, flagged: false });
        await incrementProfanityCount(userId, badWordsTotal, text);
        const field = typeof record.text === "string" ? "text" : "content";
        const { error: noteError } = await supabaseAdmin.from("notes")
            .update({ [field]: result.censored_content }).eq("id", record.id);
        if (noteError) throw noteError;
        return res.status(200).json({ success: true, flagged: true, provider: result.provider });
    } catch (error) {
        console.error("[moderation] Database webhook failed:", error);
        return res.status(500).send("Webhook handler error");
    }
});
/**
 * POST /auth/searchusers?query=pattern
 * Alternatively supports passing { "query": "pattern" } in the JSON body
 */
app.post('/auth/searchusers', async (req, res) => {
    console.log("searchusers request detected");
    try {
        // 1. Extract query from URL query string or request body
        const searchQuery = req.query.query || req.body?.query;

        if (!searchQuery) {
            console.log("searchusers request fail, bad body");
            return res.status(400).json({ error: 'Search query parameter is required.' });
        }

        // 2. Query Supabase Auth Admin API
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 50,
            query: String(searchQuery)
        });

        if (error) {
            console.error('Supabase Admin Error:', error.message);
            return res.status(500).json({ error: error.message });
        }

        const q = String(searchQuery).toLowerCase();

        // 3. Safely filter and sanitize returned fields
        const sanitizedUsers = data.users
            .filter(user => {
                const emailMatch = user.email?.toLowerCase().includes(q);
                const usernameMatch = user.user_metadata?.username?.toLowerCase().includes(q);
                return emailMatch || usernameMatch;
            })
            .map(user => ({
                id: user.id,
                email: user.email,
                user_metadata: user.user_metadata,
                created_at: user.created_at
            }));

        return res.status(200).json({
            count: sanitizedUsers.length,
            users: sanitizedUsers
        });

    } catch (err) {
        console.error('Server Error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/auth/getuser', async (req, res) => {
    try {
        const userId = req.body?.id || req.query?.id

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required.' })
        }

        // Retrieve user directly from Supabase Auth via Admin API
        const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(userId)

        if (error || !user) {
            return res.status(404).json({ error: 'User not found.' })
        }

        // Return safe user information (avoid leaking sensitive metadata)
        return res.status(200).json({
            user: {
                id: user.id,
                email: user.email,
                username: user.user_metadata?.username || user.email.split('@')[0],
                user_metadata: user.user_metadata,
                created_at: user.created_at
            }
        })
    } catch (err) {
        console.error('Error getting user by ID:', err)
        return res.status(500).json({ error: 'Internal server error.' })
    }
})

app.post("/developers/post", async (req, res) => {
    try {
        // 1. Verify Authorization Header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                status: "error",
                message: "Unauthorized: Missing or invalid token format."
            });
        }

        const token = authHeader.split(" ")[1];
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);




        if (authError || !user) {
            return res.status(401).json({
                status: "error",
                message: "Unauthorized: Invalid or expired session."
            });
        }

        // 2. Check Developer UUID Authorization
        if (!ALLOWED_UUIDS.includes(user.id)) {
            return res.status(403).json({
                status: "error",
                message: "Forbidden: Account lacks developer privileges."
            });
        }

        // 3. Extract Command
        const { command } = req.body;
        if (!command || typeof command !== "string") {
            return res.status(400).json({
                status: "error",
                message: "Bad Request: Missing or invalid 'command' string in body."
            });
        }

        // Helper to check Git hash safely
        const getLocalHash = () => {
            try {
                return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
            } catch (err) {
                return null;
            }
        };

        // Command Dictionary
        const commands = {
            "ping": () => "pong",
            "help": () => "help - shows available commands\n" +
                "ping - pingtest\n" +
                "time - shows server ISO time\n" +
                "check - displays check subcommands\n" +
                "check hash - retrieves local commit hash\n" +
                "check latest - compares local hash with GitHub main\n" +
                "check logs - checks logs\n" +
                "bash <cmd> - executes shell command",

            "time": () => new Date().toISOString(),
            "check": () => "check command -> usage: 'check hash' or 'check latest'",

            "check hash": () => {
                const hash = getLocalHash();
                return hash ? hash : "Error: Not a git repository or git binary unavailable.";

            },

            "check logs": () => {
                return JSON.stringify(logs, null, 2);
            },

            "check latest": async () => {
                const localHash = getLocalHash();
                if (!localHash) return "Error: Could not determine local git hash.";

                try {
                    const response = await fetch("https://api.github.com/repos/shawnie-webdev/gnotes/commits/main", {
                        headers: { "User-Agent": "GoldenNotes-Server" }
                    });
                    if (!response.ok) return `GitHub API Error: HTTP ${response.status}`;
                    const data = await response.json();
                    const remoteHash = data.sha;

                    return localHash === remoteHash
                        ? `[UP TO DATE] Local commit (${localHash.substring(0, 7)}) matches GitHub main.`
                        : `[OUTDATED] Local: ${localHash.substring(0, 7)} | Remote: ${remoteHash.substring(0, 7)}`;
                } catch (err) {
                    return `Failed to verify with GitHub: ${err.message}`;
                }
            }
        };

        let output;

        // Privileged account recovery command. Never accept a password from the caller;
        // generate a high-entropy temporary password and require the user to change it.
        const passwordResetMatch = command.match(/^password\s+reset\s+([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
        if (/^password\s+reset\b/i.test(command)) {
            if (!passwordResetMatch) {
                output = "Usage: password reset <user-id>";
            } else if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
                output = "Error: SUPABASE_SERVICE_ROLE_KEY is not configured on the server.";
            } else {
                const targetId = passwordResetMatch[1];
                const { data: targetData, error: targetLookupError } = await supabaseAdmin.auth.admin.getUserById(targetId);
                if (targetLookupError || !targetData?.user) {
                    output = "Error: User not found.";
                } else {
                    const temporaryPassword = crypto.randomBytes(18).toString("base64url") + "aA1!";
                    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(targetId, {
                        password: temporaryPassword,
                        user_metadata: { ...(targetData.user.user_metadata || {}), password_reset_required: true }
                    });
                    if (resetError) {
                        console.error("[dev/password-reset] Reset failed:", resetError.message);
                        output = "Error: Supabase could not reset this user's password.";
                    } else {
                        output = "Temporary password set for user " + targetId + ". Share it with the user privately; they should change it immediately after signing in.\nTemporary password: " + temporaryPassword;
                    }
                }
            }
        }

        // 4. Handle Shell Execution or Internal Commands
        if (typeof output === "string") {
            // A command handled above has already produced its output.
        } else if (command.startsWith("bash ")) {
            const bashCmd = command.substring(5).trim();
            if (!bashCmd) {
                output = "Error: Blank command. Usage: 'bash <command>'";
            } else {
                try {
                    output = execSync(bashCmd, { encoding: "utf-8", timeout: 10000 }).trim();
                } catch (err) {
                    output = err.stderr ? err.stderr.toString().trim() : err.message;
                }
            }
        } else if (commands[command]) {
            output = await commands[command]();
        } else {
            output = `Unknown command: '${command}'. Type 'help' for available options.`;
        }

        return res.status(200).json({
            status: "success",
            inputReceived: command,
            output: output,
            timestamp: new Date().toISOString()
        });

    } catch (err) {
        console.error("[DEV TERMINAL ERROR]:", err);
        return res.status(500).json({
            status: "error",
            output: `Internal Server Error: ${err.message}`
        });
    }
});

app.post('/auth/signup-provider/posthttps', async (req, res) => {
    try {
        // 1. Extract the user object from Supabase's payload
        const { user } = req.body;
        const email = user?.email;

        if (!email) {
            return res.status(400).json({
                error: {
                    http_code: 400,
                    message: "Email address is required."
                }
            });
        }

        // 2. Query AbstractAPI for email reputation
        const apiKey = process.env.ABSTRACT_API_KEY;
        if (!apiKey) {
            return res.status(503).json({
                error: { http_code: 503, message: "Email verification is temporarily unavailable." }
            });
        }
        const apiUrl = `https://emailreputation.abstractapi.com/v1/?api_key=${apiKey}&email=${encodeURIComponent(email)}`;

        const apiResponse = await fetch(apiUrl);
        const reputationData = await apiResponse.json();

        // 3. Block or allow based on reputation checks
        // AbstractAPI returns fields like deliverability or quality_score
        if (reputationData.deliverability === 'UNDELIVERABLE') {
            // Return 400 status to inform Supabase to reject the signup
            return res.status(400).json({
                error: {
                    http_code: 400,
                    message: "The email address provided does not exist or cannot receive mail."
                }
            });
        }

        // 4. Return HTTP 200 with empty JSON object to allow signup
        return res.status(200).json({});

    } catch (error) {
        console.error("Hook Error:", error);
        return res.status(500).json({ error: error.message });
    }
});


// Public-facing ban lookup: only returns a reason for an account currently banned by Supabase.
app.post('/auth/ban-info', async (req, res) => {
    try {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        if (!email || email.length > 320 || !email.includes("@")) {
            return res.status(400).json({ banned: false });
        }
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (error) {
            console.error("[auth/ban-info] User lookup failed:", error.message);
            return res.status(503).json({ banned: false });
        }
        const matched = (data.users || []).find(u => (u.email || "").toLowerCase() === email);
        if (!matched?.banned_until || new Date(matched.banned_until).getTime() <= Date.now()) {
            return res.json({ banned: false });
        }
        return res.json({ banned: true, reason: matched.app_metadata?.ban_reason || "No reason was provided." });
    } catch (err) {
        console.error("[auth/ban-info] Lookup failed:", err);
        return res.status(503).json({ banned: false });
    }
});

// Checks a bearer session's user record using the trusted Auth Admin API, even if getUser(token) rejects a banned session.
app.post('/auth/ban-status', async (req, res) => {
    try {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
        if (!token) return res.status(401).json({ banned: false });
        let userId;
        try {
            const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
            userId = payload.sub;
        } catch (_) {
            return res.status(401).json({ banned: false });
        }
        if (typeof userId !== "string") return res.status(401).json({ banned: false });
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (error || !data?.user) return res.status(401).json({ banned: false });
        const u = data.user;
        const banned = !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();
        return res.json({ banned, reason: banned ? (u.app_metadata?.ban_reason || "No reason was provided.") : "" });
    } catch (err) {
        console.error("[auth/ban-status] Check failed:", err);
        return res.status(503).json({ banned: false });
    }
});

app.post('/auth/moderator/actionpost', async (req, res) => {
    try {
        // The browser sends the Supabase access token as a Bearer token.
        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

        if (!token) {
            return res.status(401).json({ error: "Missing session access token." });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: "Invalid or expired session." });
        }

        const { data: actorProfile, error: actorError } = await supabaseAdmin
            .from("user-background")
            .select("rank")
            .eq("uuid", user.id)
            .maybeSingle();

        if (actorError) {
            console.error("[moderator/actionpost] Could not verify moderator rank:", actorError.message);
            return res.status(500).json({ error: "Could not verify your permissions." });
        }

        const actorRank = actorProfile?.rank;
        if (actorRank !== "Admin" && actorRank !== "Moderator") {
            return res.status(403).json({ error: "Admin or Moderator rank required." });
        }

        const { action, targetUuid, hours, rank, reason, sentence, contentType, itemId, moderationStatus } = req.body || {};

        if (action === "whoami") {
            return res.json({ success: true, userId: user.id, rank: actorRank });
        }

        if (action === "list-users") {
            const { data: profiles, error: profileError } = await supabaseAdmin
                .from("user-background")
                .select("uuid, rank, profanity-count")
                .order("rank", { ascending: true })
                .limit(100);
            if (profileError) {
                console.error("[moderator/actionpost] list-users profile query failed:", profileError.message);
                return res.status(500).json({ error: "Could not load user profiles." });
            }

            const { data: authData, error: authListError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
            if (authListError) {
                console.error("[moderator/actionpost] list-users Auth query failed:", authListError.message);
                return res.status(500).json({ error: "Could not load Auth ban information." });
            }
            const authById = new Map((authData.users || []).map(authUser => [authUser.id, authUser]));
            const users = (profiles || []).map(profile => {
                const authUser = authById.get(profile.uuid);
                return {
                    uuid: profile.uuid,
                    rank: profile.rank || "Viewer",
                    profanity_count: Number(profile["profanity-count"] || 0),
                    banned_until: authUser?.banned_until || null
                };
            });
            return res.json({ success: true, users });
        }

        if (action === "list-content") {
            const [{ data: documents, error: documentsError }, { data: studyGuides, error: studyError }] = await Promise.all([
                supabaseAdmin.from("documents").select("id, name, author, file_path, file_url, moderation_status, created_at"),
                supabaseAdmin.from("study").select("id, name, author, sg")
            ]);
            if (documentsError || studyError) {
                console.error("[moderator/actionpost] Content list failed:", documentsError?.message || studyError?.message);
                return res.status(500).json({ error: "Could not load documents and study guides. Check table permissions/schema." });
            }
            return res.json({ success: true, documents: documents || [], studyGuides: studyGuides || [] });
        }

        if (action === "show-info") {
            if (typeof targetUuid !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUuid)) {
                return res.status(400).json({ error: "Enter a valid target user UUID." });
            }
            const { data: background, error } = await supabaseAdmin
                .from("user-background").select("*").eq("uuid", targetUuid).maybeSingle();
            if (error) return res.status(500).json({ error: "Could not load user background." });
            if (!background) return res.status(404).json({ error: "User background not found." });
            return res.json({ success: true, background });
        }

        if (action === "increment-profanity-count") {
            if (typeof targetUuid !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUuid)) {
                return res.status(400).json({ error: "Enter a valid target user UUID." });
            }
            const enteredSentence = typeof sentence === "string" ? sentence.trim().slice(0, 2000) : "";
            if (!enteredSentence) return res.status(400).json({ error: "Enter the sentence to add to curse-senetences-said." });
            const { data: target, error: targetReadError } = await supabaseAdmin
                .from("user-background").select("rank").eq("uuid", targetUuid).maybeSingle();
            if (targetReadError) return res.status(500).json({ error: "Could not load the target profile." });
            if (!target) return res.status(404).json({ error: "User background not found." });
            if (actorRank === "Moderator" && ["Admin", "Moderator"].includes(target.rank)) {
                return res.status(403).json({ error: "Moderators cannot change another staff account." });
            }
            await incrementProfanityCount(targetUuid, 1, enteredSentence);
            return res.json({ success: true, message: "Profanity count incremented and sentence recorded." });
        }

        if (action === "reset-profanity-counter") {
            if (typeof targetUuid !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUuid)) {
                return res.status(400).json({ error: "Enter a valid target user UUID." });
            }
            const { data: target, error: targetReadError } = await supabaseAdmin
                .from("user-background").select("rank").eq("uuid", targetUuid).maybeSingle();
            if (targetReadError) return res.status(500).json({ error: "Could not load the target profile." });
            if (!target) return res.status(404).json({ error: "User background not found." });
            if (actorRank === "Moderator" && ["Admin", "Moderator"].includes(target.rank)) {
                return res.status(403).json({ error: "Moderators cannot change another staff account." });
            }
            const { error: resetError } = await supabaseAdmin.from("user-background")
                .update({ "profanity-count": 0, "curse-senetences-said": [] })
                .eq("uuid", targetUuid);
            if (resetError) return res.status(500).json({ error: "Could not reset profanity count and sentence history." });
            return res.json({ success: true, message: "Profanity count and recorded sentences have been reset." });
        }

        if (action === "review-document") {
            if (typeof itemId !== "string" || !["accepted", "denied"].includes(moderationStatus)) {
                return res.status(400).json({ error: "A document ID and accepted/denied decision are required." });
            }
            const { error } = await supabaseAdmin.from("documents").update({
                moderation_status: moderationStatus,
                moderation_reviewed_by: user.id,
                moderation_reviewed_at: new Date().toISOString()
            }).eq("id", itemId);
            if (error) return res.status(500).json({ error: "Could not update document review status." });
            return res.json({ success: true, message: "Document " + moderationStatus + "." });
        }

        if (action === "delete-content") {
            if (!["document", "study"].includes(contentType) ||
                (typeof itemId !== "string" && typeof itemId !== "number") ||
                String(itemId).trim().length === 0 || String(itemId).length > 100) {
                return res.status(400).json({ error: "A valid content type and item ID are required." });
            }

            if (contentType === "document") {
                const { data: document, error: documentError } = await supabaseAdmin
                    .from("documents").select("id, file_path").eq("id", itemId).maybeSingle();
                if (documentError) {
                    console.error("[moderator/actionpost] Document lookup failed:", documentError.message);
                    return res.status(500).json({ error: "Could not look up the document." });
                }
                if (!document) return res.status(404).json({ error: "Document not found." });

                if (document.file_path) {
                    const { error: storageError } = await supabaseAdmin.storage
                        .from("documents").remove([document.file_path]);
                    if (storageError) {
                        console.error("[moderator/actionpost] Storage deletion failed:", storageError.message);
                        return res.status(500).json({ error: "Could not delete the stored file; the document record was kept." });
                    }
                }

                const { error: deleteError } = await supabaseAdmin
                    .from("documents").delete().eq("id", itemId);
                if (deleteError) {
                    console.error("[moderator/actionpost] Document row deletion failed:", deleteError.message);
                    return res.status(500).json({ error: "The file was removed, but its database record could not be deleted." });
                }
                return res.json({ success: true, message: "Document and stored file deleted." });
            }

            const { data: studyGuide, error: studyLookupError } = await supabaseAdmin
                .from("study").select("id").eq("id", itemId).maybeSingle();
            if (studyLookupError) {
                console.error("[moderator/actionpost] Study guide lookup failed:", studyLookupError.message);
                return res.status(500).json({ error: "Could not look up the study guide." });
            }
            if (!studyGuide) return res.status(404).json({ error: "Study guide not found." });

            const { error: studyDeleteError } = await supabaseAdmin
                .from("study").delete().eq("id", itemId);
            if (studyDeleteError) {
                console.error("[moderator/actionpost] Study guide deletion failed:", studyDeleteError.message);
                return res.status(500).json({ error: "Could not delete the study guide." });
            }
            return res.json({ success: true, message: "Study guide deleted." });
        }

        if (!["ban", "unban", "change-rank"].includes(action)) {
            return res.status(400).json({ error: "Unknown moderator action." });
        }
        if (typeof targetUuid !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUuid)) {
            return res.status(400).json({ error: "Enter a valid target user UUID." });
        }
        if (targetUuid === user.id && action !== "change-rank") {
            return res.status(400).json({ error: "You cannot ban or unban your own account here." });
        }

        const { data: targetProfile, error: targetError } = await supabaseAdmin
            .from("user-background")
            .select("rank")
            .eq("uuid", targetUuid)
            .maybeSingle();

        if (targetError) {
            console.error("[moderator/actionpost] Target lookup failed:", targetError.message);
            return res.status(500).json({ error: "Could not verify the target account." });
        }
        if (!targetProfile) {
            return res.status(404).json({ error: "Target user profile was not found." });
        }

        // Moderators cannot take action against admins or other moderators.
        if (actorRank === "Moderator" &&
            ["Admin", "Moderator"].includes(targetProfile.rank)) {
            return res.status(403).json({ error: "Moderators cannot change another staff account." });
        }

        if (action === "change-rank") {
            if (actorRank !== "Admin") {
                return res.status(403).json({ error: "Only Admins can change user ranks." });
            }
            const allowedRanks = ["Viewer", "Moderator", "Admin"];
            if (!allowedRanks.includes(rank)) {
                return res.status(400).json({ error: "Rank must be Viewer, Moderator, or Admin." });
            }
            if (targetUuid === user.id && rank !== "Admin") {
                return res.status(400).json({ error: "You cannot remove your own Admin rank." });
            }
            const { error } = await supabaseAdmin
                .from("user-background")
                .update({ rank })
                .eq("uuid", targetUuid);
            if (error) {
                console.error("[moderator/actionpost] Rank update failed:", error.message);
                return res.status(500).json({ error: "Could not update the user's rank." });
            }
            return res.json({ success: true, message: "User rank updated.", rank });
        }

        // Use Supabase Auth's supported ban_duration setting; no client-provided SQL or table names.
        if (action === "ban") {
            const durationHours = Number(hours);
            if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 8760) {
                return res.status(400).json({ error: "Ban duration must be 1–8760 whole hours." });
            }
            const banReason = typeof reason === "string" ? reason.trim().slice(0, 1000) : "";
            if (!banReason) {
                return res.status(400).json({ error: "A reason is required to ban an account." });
            }
            const { data: existingAuth, error: lookupError } = await supabaseAdmin.auth.admin.getUserById(targetUuid);
            if (lookupError || !existingAuth?.user) {
                return res.status(404).json({ error: "Could not find the target authentication account." });
            }
            const appMetadata = { ...(existingAuth.user.app_metadata || {}), ban_reason: banReason };
            const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUuid, {
                ban_duration: `${durationHours}h`,
                app_metadata: appMetadata
            });
            if (error) {
                console.error("[moderator/actionpost] Ban failed:", error.message);
                return res.status(500).json({ error: "Could not ban the user." });
            }
            return res.json({ success: true, message: `User banned for ${durationHours} hour(s).` });
        }

        if (action === "unban") {
            const { data: existingAuth } = await supabaseAdmin.auth.admin.getUserById(targetUuid);
            const appMetadata = { ...(existingAuth?.user?.app_metadata || {}) };
            delete appMetadata.ban_reason;
            const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUuid, {
                ban_duration: "none",
                app_metadata: appMetadata
            });
            if (error) {
                console.error("[moderator/actionpost] Unban failed:", error.message);
                return res.status(500).json({ error: "Could not unban the user." });
            }
            return res.json({ success: true, message: "User unbanned." });
        }
    } catch (err) {
        console.error("[moderator/actionpost] Unexpected error:", err);
        return res.status(500).json({ error: "Internal server error." });
    }
});

/* DEBBUGER ENDPOINT -- DO NOT EDIT SECTION */
// 404 Catch-All Route (Must be placed AFTER all valid routes)
app.use((req, res) => {
    res.status(404).send(`
        <div style="text-align: center; font-family: sans-serif; padding: 50px;">
            <h1>404 - Page Not Found</h1>
            <p>The endpoint <code>${req.originalUrl}</code> does not exist.</p>
            <a href="/">Return to Home</a>
        </div>
    `);
});

app.listen(PORT, () => {
    console.log("[INFO]: Server listening - [server.js]");
    console.log("========= Project GoldenNotes =========");
    console.log(`Server AT: ${localIP}:${PORT}`);

    log('info', 'server-info', 'server is now listening')
    log('info', 'server-info', `Server AT: ${localIP}:${PORT}`)
});
