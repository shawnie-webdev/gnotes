/* Project Goldenotes | Inspiration by Ram, Programmed by Roshaun */

const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

console.log("[INFO]: Server module loading - [server.js]");

const app = express();

// Middleware (Declare body parsers and static assets BEFORE route handlers)
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.static("public"));
app.use('/tinymce', express.static(path.join(__dirname, 'node_modules', 'tinymce')));

const publicDir = path.join(__dirname, "public");
console.log("[server.js] - Public directory at:");
console.log(publicDir);

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

/* ===---===---=== ENDPOINTS ===---===---=== */

app.get("/", (req, res) => sendFileOrError(res, '/', 'homepage.html'));
app.get("/credits", (req, res) => sendFileOrError(res, '/credits', 'credits.html'));

app.get("/login.html", (req, res) => sendFileOrError(res, '/login.html', 'auth/login.html'));
app.get("/login", (req, res) => sendFileOrError(res, '/login', 'auth/login.html'));
app.get("/signup", (req, res) => sendFileOrError(res, '/signup', 'auth/signup.html'));
app.get("/dashboard", (req, res) => sendFileOrError(res, '/dashboard', 'auth/dashboard.html'));

app.get("/corkboard", (req, res) => sendFileOrError(res, '/corkboard', 'corkboard/join.html'));
app.get("/corkboard/help", (req, res) => sendFileOrError(res, '/corkboard/help', 'corkboard/help.html'));
app.get("/corkboard/join", (req, res) => sendFileOrError(res, '/corkboard/join', 'corkboard/main.html'));

app.get("/study", (req, res) => sendFileOrError(res, '/study', 'study/course-list.html'));
app.get("/study/new-topic", (req, res) => sendFileOrError(res, '/study/new-topic', 'study/courses/newtopic.html'));
app.get("/study/view", (req, res) => sendFileOrError(res, '/study/view', 'study/courses/viewtopic.html'));
app.get("/study/advanced-topics", (req, res) => sendFileOrError(res, '/study/advanced-topics', 'study/courses/advanced-topics.html'));
app.get("/study/new-advanced", (req, res) => sendFileOrError(res, '/study/new-advanced', 'study/courses/new-advanced.html'));

app.get("/documents", (req, res) => sendFileOrError(res, '/documents', 'documents/viewer.html'));
app.get("/documents/add", (req, res) => sendFileOrError(res, '/documents/add', 'documents/filesupload.html'));
app.get("/calendar/new", (req, res) => sendFileOrError(res, '/calendar/new', 'calendar/new.html'));

app.get("/public", (req, res) => res.redirect("/"));

/* DEBBUGER ENDPOINT -- DO NOT EDIT SECTION - roshaun */
app.get("/developers/debug", async (req, res) => {
    sendFileOrError(res, "/developers/debug", 'developers/debug.html');
});

app.post("/developers/post", async (req, res) => {
    // 1. Verify Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            status: "error",
            message: "Unauthorized: Missing or invalid token."
        });
    }

    const token = authHeader.split(" ")[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({
            status: "error",
            message: "Unauthorized: Invalid or expired session."
        });
    }

    const { command } = req.body;

    if (!command) {
        return res.status(400).json({
            status: "error",
            message: "No command provided in request body."
        });
    }

    const getLocalHash = () => {
        try {
            return execSync("git rev-parse HEAD").toString().trim();
        } catch (err) {
            return null;
        }
    };

    const commands = {
        "ping": () => "pong",
        "help": () => "help - shows help\nping - pingtest\ntime - shows time\ncheck - checks for stuff\ncheck latest - checks if the build is latest\ncheck hash - checks hash",
        "time": () => new Date().toISOString(),

        "check": () => "check command -> try 'check hash' or 'check latest'",

        "check hash": () => {
            const hash = getLocalHash();
            return hash ? hash : "Error: Not a git repository or git not installed.";
        },

        "check latest": async () => {
            const localHash = getLocalHash();

            if (!localHash) {
                return "Error: Could not determine local git hash.";
            }

            try {
                const response = await fetch("https://api.github.com/repos/shawnie-webdev/gnotes/commits/main", {
                    headers: {
                        "User-Agent": "GoldenNotes-Server"
                    }
                });

                if (!response.ok) {
                    return `GitHub API error: HTTP ${response.status}`;
                }

                const data = await response.json();
                const latestRemoteHash = data.sha;

                if (localHash === latestRemoteHash) {
                    return `[UP TO DATE] Local commit (${localHash.substring(0, 7)}) matches GitHub main branch.`;
                } else {
                    return `[OUTDATED] Local commit: ${localHash.substring(0, 7)} | Latest remote commit: ${latestRemoteHash.substring(0, 7)}`;
                }
            } catch (err) {
                return `Failed to verify with GitHub: ${err.message}`;
            }
        }
    };

    console.log(`[RECEIVED COMMAND]: ${command}`);

    let output;
    if (commands[command]) {
        output = await commands[command]();
    } else {
        output = `Unknown command: '${command}'. Type 'help' for available commands.`;
    }

    return res.status(200).json({
        status: "success",
        inputReceived: command,
        output: output,
        timestamp: new Date().toISOString()
    });
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
});