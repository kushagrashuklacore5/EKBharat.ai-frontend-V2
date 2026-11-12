# Ek Bharat AI & Core5 Mail Server

Backend email service powered by Node.js, Express, and Nodemailer with Gmail SMTP.

## Configuration

Settings are configured via `.env` (or `mail-config.json`):

```env
PORT=5501
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@core5.co.in
SMTP_PASS=your-smtp-app-password
FROM_NAME=Core5 Website
CONTACT_TO=enquiry@core5.co.in
```

### Workflow Studio AI generator & email sharing

Add to `server/.env` (never to a `VITE_` variable — the frontend must not see these):

```env
GROQ_API_KEY=<your Groq key>          # required for "Describe your workflow"
GROQ_MODEL=openai/gpt-oss-120b        # any Groq chat model your account can use
GROQ_REASONING_EFFORT=low             # gpt-oss models only: low | medium | high
SMTP_FROM="Workflow Studio <you@yourdomain>"   # optional; defaults to FROM_NAME <SMTP_USER>
WORKFLOW_GENERATE_LIMIT=20            # generations per IP per hour
WORKFLOW_EMAIL_LIMIT=10               # emails per IP per hour
```

Endpoints: `POST /api/workflows/generate` (prompt + node catalog → validated workflow JSON) and
`POST /api/workflows/email` (approved snapshot → email with SVG diagram + JSON attachment; refused
unless the snapshot matches its approval hash). The Groq free tier allows ~8,000 tokens/minute,
roughly one generation per minute.

## Running the Server

### Option 1: Directly from `server` folder
```bash
cd server
npm install
npm start
```

### Option 2: From project root
```bash
npm run server
```

The server will start on `http://localhost:5501`.

## Endpoints

- `GET /` or `GET /health` : Health check and SMTP status
- `POST /api/contact` : Contact inquiries and Project Brief submissions
- `POST /send` : Legacy compatibility endpoint

## Payload Format

### Contact Form:
```json
{
  "kind": "contact",
  "name": "Sender Name",
  "email": "sender@example.com",
  "topic": "Workflow Studio early access",
  "message": "Inquiry message text"
}
```

### Project Brief (Build With Us):
```json
{
  "kind": "project-brief",
  "name": "Sender Name",
  "email": "sender@example.com",
  "company": "Company Name",
  "types": ["workflow-studio"],
  "problem": "Problem description",
  "brief": "Full brief details..."
}
```

