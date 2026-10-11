# DocYard

A community document management platform: sign up, log in, upload documents with optional
credentials and an expiry date, track them on a dashboard, and get an email reminder 21 days
before something expires. Preview, download, share or delete any document you own.

**Languages:** English, हिन्दी (Hindi), मराठी (Marathi) - switch from the dropdown in the navbar.
**Storage:** your account, document details and the files themselves live in the cloud, so you can
log in from any phone or computer and see the same documents.

## Stack

- **Frontend:** React 18 + Vite + React Router
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (cloud) - users and document details
- **File storage:** any S3-compatible bucket (cloud) - the actual files
- **Auth:** JWT (email + password with bcrypt, or Google sign-in)
- **Email:** Nodemailer over SMTP, checked hourly by `node-cron` (reminders are sent in the user's language)

> Nothing is stored on the backend server any more - no SQLite file, no `uploads/` folder. You can
> redeploy, restart or move the backend and every account and document stays safe.

---

## 1. Create the two cloud services (free tiers are fine)

The easiest option is **Supabase**, which gives you both in one project.

1. Create a project at https://supabase.com (pick the region nearest your users, e.g. Mumbai).
2. **Database URL** - click **Connect** and copy the **Session pooler** connection string
   (works from hosts without IPv6, like Render). Put your database password in it. This is `DATABASE_URL`.
3. **Bucket** - go to **Storage -> New bucket**, name it `docyard-documents`, keep it **Private**
   (do NOT make it public - files are served only through the backend after a login check).
4. **S3 keys** - Storage -> **S3 Connection** (or Project Settings -> Storage). Copy the **endpoint**
   and **region**, and create an **access key**. These become `S3_ENDPOINT`, `S3_REGION`,
   `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.

Other options work too, because the code only needs "a Postgres URL" and "an S3-compatible bucket":
Neon / Render Postgres / Railway for the database, and Cloudflare R2 / AWS S3 / Backblaze B2 for files.

## 2. Configure the backend

```bash
cd backend
npm install
cp .env.example .env     # then fill it in
```

Set at least `JWT_SECRET`, `DATABASE_URL`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
(plus `S3_ENDPOINT` / `S3_REGION` unless you use plain AWS S3). The server tells you exactly what is
missing if you forget something. Tables are created automatically on first start.

SMTP and Google settings are optional - without SMTP, reminder emails are printed in the console.

## 3. Run locally

```bash
# terminal 1
cd backend && npm start          # http://localhost:4000

# terminal 2
cd frontend && npm install && npm run dev     # http://localhost:5173
```

## 4. Put it online so every device can reach it

A cloud database alone isn't enough - the backend and frontend also need to be on the internet
(otherwise "your account on another device" has nothing to connect to).

**Backend -> Render (or Railway / Fly.io)**
- New **Web Service**, root directory `backend`, build `npm install`, start `npm start`.
- Add every variable from `.env` in the dashboard. Set `CLIENT_URL` to your frontend's URL.

**Frontend -> Vercel (or Netlify)**
- Root directory `frontend`, build `npm run build`, output `dist`.
- Add the environment variable `VITE_API_URL` = `https://<your-backend>.onrender.com/api`.
- `vercel.json` and `public/_redirects` are included so page refreshes on `/dashboard` etc. work.

**Google sign-in:** add your deployed frontend URL under "Authorized JavaScript origins".

## Languages

- Text lives in `frontend/src/i18n/en.js`, `hi.js` and `mr.js`. All three files use the same keys.
- To change a sentence, edit it in the language file. To add a language, copy `en.js`, translate it,
  and register it in `frontend/src/i18n/index.jsx` (the `LANGUAGES` list and `DICTS` map).
- The chosen language is remembered in the browser, and saved on the account so expiry-reminder
  emails arrive in the same language.
- Server errors are sent as codes (e.g. `EMAIL_EXISTS`) and translated in the browser (`err.*` keys).
- Hindi/Marathi use the Noto Sans Devanagari font; file names in Devanagari upload and download correctly.

## How the pieces work

- **Upload:** the browser sends the file to the backend, which streams it straight into the private
  bucket and saves its details (name, credentials, expiry, owner) in Postgres.
- **Preview / download:** the backend checks you own the document, then streams it from the bucket.
- **Expiry status:** Active (no date, or > 21 days away), Expiring soon (<= 21 days), Expired.
- **Reminders:** an hourly job emails owners of documents expiring within 21 days
  (`EXPIRY_WARNING_DAYS`, `CRON_SCHEDULE` in `.env`).
- **Share links:** "Share" creates a public link to that one file; delete and re-share to rotate it.

## Good to know

- Free hosting tiers may put the backend to sleep when idle; the reminder job only runs while it is
  awake. Use a paid/always-on instance (or an uptime pinger on `/api/health`) for dependable reminders.
- Data from an older local SQLite version of DocYard is not migrated - re-upload those documents.
- Uploads are limited to 25MB per file.

---

## v3 additions

**New features:** document groups (academic / personal / work / other) with 72 ready-made document types in
English, Hindi and Marathi - search, sort and filter - per-document password lock - collaborative documents
with invite links, live cursors, an activity log (who edited and when) and "download a copy".

**Upgrading an existing deployment**

1. `cd backend && npm install` and `cd ../frontend && npm install` (new packages), then commit the updated
   `package-lock.json` files.
2. No new environment variables. The new database columns/tables are created automatically on the first start
   (`ALTER TABLE ... IF NOT EXISTS`), and your existing documents keep working (they land in the "Other" group -
   use **Edit** on a card to move them).
3. Redeploy the backend first (Render supports WebSockets, which live editing needs), then the frontend.
4. Backend host must keep running as a normal web service (not serverless). Live editing connects to
   `wss://<backend>/collab`; `CLIENT_URL` must list your frontend origin (it is also used to check the WebSocket origin).

**Where things live**

- `backend/routes/documents.js` - search/sort/filter query, groups, password lock/unlock, edit details
- `backend/routes/collab.js` - collaborative documents, invite links, guest join, activity log
- `backend/collab/hocuspocus.js` - the live-editing WebSocket server (Yjs) + per-user edit tracking
- `backend/utils/tokens.js` - short-lived scoped tokens (unlock / collaborator) kept separate from login tokens
- `frontend/src/data/documentTypes.js` - the document-type list (add a line to add a type)
- `frontend/src/components/CollabEditor.jsx` - the editor, activity panel and invite panel
