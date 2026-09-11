/* Project Goldenotes | Inspiration by Ram, Programmed by Roshaun */

const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");

console.log("[INFO]: Server module loading - [server.js]");

const app = express();
app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, "public");
console.log("[server.js] - Public directory at:")
console.log(publicDir);

const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY_SIZE = "5mb";

function getIP() {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip over internal (i.e. 127.0.0.1) and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address; // Return the first valid local IP found
            }
        }
    }

    return '127.0.0.1'; // Fallback if no external network is connected
}
const localIP = getIP();

function sendErrorPage(res, status, endpoint = res.req?.originalUrl || "unknown", err = null) {
    const info = {
        404 : "The file/object was not found, either it was moved, renamed or deleted, or did not exist in the first place",
        401 : "The action you are trying to do is unauthorized, the server does not know who you are, logging in might fix this",
        403 : "The action you are trying to do is forbidden, you may not have enough permissions to do this",
        429 : "You are sending too many requests to the server",

        500 : "An error occurred inside the server while processing your request",
        502 : "A proxy/gateway server got an invalid response from an upstream server",
        503 : "The server might be temporarily overloaded or the service you are trying to use is unavailable"
    }
    const meaning = {
        404 : "File/object not found",
        401 : "Unauthorized",
        403 : "Forbidden",
        429 : "Too many requests",

        500 : "Internal Server Error",
        502 : "Bad Gateway",
        503 : "Service temporarily unavailable"
    }

    res.status(status).type('html').send("" +
        "<DOCTYPE html>" +
        "<html>" +
        `   <h1>HTTP Status Code ${status} - ${meaning[status]}</h1>` +
        "   <h3>" + info[status] + "</h3>" +
        "   <p></p>" +
        "   <p>More about this error</p>" +
        "   <ol>" +
    "<li>Endpoint: " + endpoint + "</li>" +
    "</ol>"
    )
}

function sendFileOrError(res, endpoint, raw) {
    const filePath = path.join(publicDir, raw);
    console.log(`[server.js]: Sending file '${filePath}' for endpoint '${endpoint}`)
    if (!fs.existsSync(filePath)) {
        console.log("hahah")
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

app.use(express.static("public"));

/* ===---===---=== ENDPOINTS ===---===---=== */
app.get("/", (req, res) => {
    sendFileOrError(res, '/', 'homepage.html');
})

app.get("/credits", (req, res) => {
    sendFileOrError(res, '/credits', 'credits.html');
})

app.get("/login.html", (req, res) => {
    sendFileOrError(res, '/login.html', 'auth/login.html');
})
app.get("/login", (req, res) => {
    sendFileOrError(res, '/login.html', 'auth/login.html');
})

app.get("/signup", (req, res) => {
    sendFileOrError(res, '/signup', 'auth/signup.html');
})

app.get("/dashboard", (req, res) => {
    sendFileOrError(res, '/dashboard', 'auth/dashboard.html');
})

app.get("/corkboard", (req, res) => {
    sendFileOrError(res, '/corkboard', 'corkboard/join.html');
})

app.get("/corkboard/help", (req, res) => {
    sendFileOrError(res, '/corkboard/help', 'corkboard/help.html');
})

app.get("/corkboard/join", (req, res) => {
    sendFileOrError(res, '/corkboard/join', 'corkboard/main.html');
})

app.get("/study/new-topic", (req, res) => {
    sendFileOrError(res, '/study/new-topic', 'study/courses/newtopic.html');
})

app.get("/study", (req, res) => {
    sendFileOrError(res, '/study', 'study/course-list.html');
})

app.get("/study/view", (req, res) => {
    sendFileOrError(res, '/study/view', 'study/courses/viewtopic.html');
})

app.get("/study/advanced-topics", (req, res) => {
    sendFileOrError(res, '/study/advanced-topics', 'study/courses/advanced-topics.html');
})

app.get("/study/new-advanced", (req, res) => {
    sendFileOrError(res, '/study/new-advanced', 'study/courses/new-advanced.html');
})

app.get("/documents", (req, res) => {
    sendFileOrError(res, '/documents', 'files/documents.html');
})

// in your server.js
app.use('/tinymce', express.static(path.join(__dirname, 'node_modules', 'tinymce')));

app.get('/study', (req, res) => { /* ... */ });
app.get('/corkboard', (req, res) => { /* ... */ });
app.get("/public", (req, res) => {
    res.redirect("/")
});

// 404 Catch-All Route (Must be placed AFTER all other routes)
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
