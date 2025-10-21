# RehearsalAI - Bug Reporting MVP

A complete bug reporting system with AI-powered analysis and automated fixes.

## Features

- 🐛 **One-click bug reporting** with floating button
- 🤖 **AI-powered analysis** using Google Gemini
- 📊 **Automatic telemetry capture** (console logs, network errors, screenshots)
- 🔄 **Real-time processing** with background worker
- 📱 **Responsive UI** with detailed bug viewer
- 🔐 **Project-based authentication** with API keys

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp env.example .env

# Edit .env with your API keys
# GEMINI_API_KEY=your_actual_gemini_api_key
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

```bash
cd packages/server
npx prisma migrate dev
npx prisma generate
```

### 4. Start Services

```bash
# Terminal 1: Start server
cd packages/server
npm run dev

# Terminal 2: Start worker
cd packages/worker
npm start
```

### 5. Test the System

Visit `http://localhost:8787/demo` to see the bug reporting system in action.

## Integration

Add to any website with a single script tag:

```html
<script src="http://localhost:8787/cdn/bugger.min.js"
        data-bugger-key="public_demo_key"
        data-bugger-origin="http://localhost:8787"></script>
```

## API Endpoints

- `POST /api/bugs` - Create bug report
- `GET /api/bugs` - List bugs
- `GET /api/bugs/:id` - Get specific bug
- `GET /cdn/bugger.min.js` - Bug reporting script

## Project Structure

```
packages/
├── server/     # Express API server
├── worker/     # Background AI processing
└── snippet/    # Client-side bug reporting script
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `DATABASE_URL` | SQLite database path | Yes |
| `PORT` | Server port (default: 8787) | No |
| `AI_PROVIDER` | AI provider (default: gemini) | No |

## Security

- Never commit `.env` files (they contain API keys)
- Use project-based authentication for production
- Rate limiting prevents spam
- All sensitive data is excluded from git

## Development

```bash
# Build all packages
npm run build

# Run tests
npm test

# Start development mode
npm run dev
```

## License

MIT