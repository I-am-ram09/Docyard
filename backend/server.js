require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");

// Fail fast with a clear message instead of a confusing crash later.
const REQUIRED_ENV = [
  "JWT_SECRET",
  "DATABASE_URL",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    `[server] Missing required settings in backend/.env: ${missing.join(", ")}\n` +
      "         Copy .env.example to .env and fill them in (see README)."
  );
  process.exit(1);
}

const db = require("./db");
const authRoutes = require("./routes/auth");
const documentRoutes = require("./routes/documents");
const shareRoutes = require("./routes/share");
const collabRoutes = require("./routes/collab");
const collabServer = require("./collab/hocuspocus");
const { startExpiryCron } = require("./utils/cron");
const { fail } = require("./utils/http");

const app = express();
app.set("trust proxy", 1); // Render/Railway sit behind a proxy; needed for correct per-IP rate limits

const allowedOrigins = (process.env.CLIENT_URL || "*").split(",").map((s) => s.trim());
app.use(cors({ origin: allowedOrigins.includes("*") ? "*" : allowedOrigins }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/share", shareRoutes);
app.use("/api/collab", collabRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === "LIMIT_FILE_SIZE") {
    return fail(res, 413, "FILE_TOO_LARGE", "File is too large (25MB max).");
  }
  fail(res, 500, "SERVER_ERROR", "Something went wrong on the server.");
});

const PORT = process.env.PORT || 4000;

db.init()
  .then(() => {
    const server = http.createServer(app);
    collabServer.attach(server, allowedOrigins); // WebSocket endpoint for live editing: /collab
    server.listen(PORT, () => {
      console.log(`DocYard API running on port ${PORT}`);
      startExpiryCron();
    });
  })
  .catch((err) => {
    console.error("[db] Could not connect to the database / create tables:", err.message);
    process.exit(1);
  });
