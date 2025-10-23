# RehearsalAI - Bug Reporting MVP

A complete bug reporting system with AI-powered analysis and automated fixes. Add a floating bug report button to any website with a single script tag.

## 🚀 Features

- 🐛 **One-click bug reporting** with floating, draggable button
- 🤖 **AI-powered analysis** using Google Gemini
- 📊 **Automatic telemetry capture** (console logs, network errors, screenshots)
- 🔄 **Real-time processing** with background worker
- 📱 **Responsive UI** with detailed bug viewer
- 🔐 **Project-based authentication** with API keys
- 🎯 **One-line integration** - single script tag

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Google Gemini API key (get one at [Google AI Studio](https://makersuite.google.com/app/apikey))

## ⚡ Quick Start

**Complete Setup Checklist:**
- [ ] Clone repo and install dependencies
- [ ] Copy `.env` file to `packages/server/`
- [ ] Add your Gemini API key to `.env`
- [ ] Generate Prisma client and run migrations
- [ ] Seed database with demo data
- [ ] Build client script
- [ ] Start server and worker
- [ ] Test at `http://localhost:8787/demo`

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd gitREdD

# Install all dependencies (root + all packages)
npm install
```

**Note**: This installs dependencies for the root workspace and all packages (`server`, `worker`, `snippet`).

### 2. Environment Setup

```bash
# Copy environment template to server directory
cp env.example packages/server/.env

# Edit packages/server/.env with your API keys
# Add your Gemini API key:
# GEMINI_API_KEY=your_actual_gemini_api_key
```

**Important**: The `.env` file must be in `packages/server/` directory since that's where the server runs from.

### 3. Database Setup

```bash
cd packages/server

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run migrate

# Seed with demo data
npm run seed
```

You should see:
```
✅ Demo project created successfully!
   Project ID: cmh2l6lrc0000ow819pdosk63
   Public Key: public_demo_key
   Secret Key: secret_demo_key
```

### 4. Build Client Script

```bash
cd packages/snippet
npm run build
```

This creates the `bugger.min.js` file that gets served to browsers.

### 5. Start Services

**Terminal 1 - Start Server:**
```bash
cd packages/server
npm run dev
```

**Terminal 2 - Start Worker:**
```bash
cd packages/worker
npm run dev
```

### 6. Test the System

Visit `http://localhost:8787/demo` to see the bug reporting system in action.

You should see:
- A floating 🐛 button in the bottom-right corner
- Demo controls to trigger errors
- Recent bugs panel

### 7. Verify Everything Works

1. **Check floating button**: Should appear in bottom-right corner
2. **Test error triggers**: Click "Trigger fake error" and "Trigger 404" buttons
3. **Open Developer Tools** (F12) → Console tab to see errors being logged
4. **Test bug submission**: Click floating button, fill form, submit
5. **Check worker processing**: Watch bug status change from `queued` → `analyzing` → `analyzed`

If any step fails, check the [Troubleshooting](#-troubleshooting) section below.

## 🎯 Demo Walkthrough

1. **Open the demo page**: `http://localhost:8787/demo`
2. **Trigger some errors**: Click "Trigger fake error" and "Trigger 404" buttons
3. **Open Developer Tools** (F12) → Console tab to see errors being logged
4. **Click the floating 🐛 button** to open the bug report modal
5. **Fill out the form**:
   - Title: "Button click fails"
   - Steps: "Click save button"
   - Expected: "Should save"
   - Actual: "Throws error"
6. **Submit** → You'll see a success toast with a bug ID
7. **Watch the Recent Bugs panel** auto-refresh every 5 seconds
8. **Click on a bug** to see the detailed analysis page

## 🔧 Integration

Add to any website with a single script tag:

```html
<script src="http://localhost:8787/cdn/bugger.min.js"
        data-bugger-key="public_demo_key"
        data-bugger-origin="http://localhost:8787"></script>
```

### Configuration Options

```html
<script src="http://localhost:8787/cdn/bugger.min.js"
        data-bugger-key="your_public_key"
        data-bugger-origin="https://your-api.com"
        data-bugger-color="#4f46e5"
        data-bugger-position="bottom-right"></script>
```

**Position options**: `bottom-right`, `bottom-left`, `top-right`, `top-left`

## 🛠️ API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/bugs` | Create bug report |
| `GET` | `/api/bugs` | List bugs (with auth) |
| `GET` | `/api/bugs/:id` | Get specific bug (with auth) |
| `GET` | `/cdn/bugger.min.js` | Bug reporting script |
| `GET` | `/demo` | Demo page |
| `GET` | `/bugs/:id/view` | Public bug viewer |

## 📁 Project Structure

```
packages/
├── server/          # Express API server
│   ├── src/
│   │   ├── index.ts # Main server file
│   │   └── contracts.ts # API schemas
│   ├── prisma/
│   │   ├── schema.prisma # Database schema
│   │   └── migrations/  # Database migrations
│   └── scripts/
│       └── seed.ts  # Database seeding
├── worker/          # Background AI processing
│   └── src/
│       ├── index.ts # Worker main loop
│       ├── providers/ # AI provider implementations
│       └── types.ts
└── snippet/         # Client-side bug reporting script
    ├── src/
    │   ├── index.ts # Main Bugger class
    │   └── types.ts # TypeScript types
    └── dist/
        └── bugger.min.js # Built client script
```

## 🔑 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes | - |
| `DATABASE_URL` | SQLite database path | Yes | `file:./prisma/dev.db` |
| `PORT` | Server port | No | `8787` |
| `AI_PROVIDER` | AI provider | No | `gemini` |

## 🚨 Troubleshooting

### Floating Button Not Visible

1. **Check if script is built**:
   ```bash
   cd packages/snippet
   npm run build
   ```

2. **Verify script is served**:
   ```bash
   curl http://localhost:8787/cdn/bugger.min.js
   ```

3. **Check browser console** for JavaScript errors

### Database Errors

1. **Regenerate Prisma client**:
   ```bash
   cd packages/server
   npm run prisma:generate
   ```

2. **Reset database**:
   ```bash
   cd packages/server
   npm run migrate
   npm run seed
   ```

### Worker Not Processing Bugs

1. **Check worker logs** for errors
2. **Verify GEMINI_API_KEY** is set in `.env`
3. **Restart worker**:
   ```bash
   cd packages/worker
   npm run dev
   ```

### API Authentication Errors

- **Demo keys**: `public_demo_key` / `secret_demo_key`
- **Check headers**: `x-bugger-key: secret_demo_key`
- **Verify project exists** in database

## 🔒 Security

- ✅ Never commit `.env` files (they contain API keys)
- ✅ Use project-based authentication for production
- ✅ Rate limiting prevents spam
- ✅ All sensitive data excluded from git
- ✅ Content Security Policy headers configured

## 🧪 Development

```bash
# Build all packages
npm run build

# Run tests
npm test

# Start development mode (all services)
npm run dev:server  # Terminal 1
npm run dev:worker  # Terminal 2

# Watch mode for snippet
cd packages/snippet
npm run dev
```

## 📊 Data Flow

1. **User clicks floating button** → Modal opens
2. **User fills form** → Telemetry captured (console logs, network errors, screenshot)
3. **Form submitted** → POST to `/api/bugs`
4. **Bug created** → Status: `queued`
5. **Worker picks up job** → Status: `analyzing`
6. **AI analysis runs** → Status: `analyzed`
7. **Results stored** → Bug page shows analysis + suggested fix

## 🎬 Demo Script (60-90 seconds)

1. **Setup** (5s): "Here's our one-click bug reporting MVP"
2. **Demo page** (15s): Show floating button, trigger errors
3. **Bug submission** (20s): Fill form, submit, show success toast
4. **Real-time analysis** (15s): Watch status change from queued → analyzing → analyzed
5. **Bug view** (20s): Click bug link, show analysis, confidence, suggested fix
6. **Integration** (10s): Show one-line script tag integration
7. **Closing** (5s): "Complete flow in under 30 seconds"

## 📄 License

MIT

---

**Need help?** Check the troubleshooting section or open an issue.