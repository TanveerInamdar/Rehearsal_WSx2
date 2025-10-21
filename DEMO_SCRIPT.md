# DEMO_SCRIPT.md

## 60-90 Second Loom Recording Script

### Setup (5 seconds)
"Here's our one-click bug reporting MVP. I'll start the server and worker, then show you the complete flow."

```bash
npm run dev:server
npm run dev:worker
```

### Demo Page (15 seconds)
"Opening the demo page at localhost:8787/demo. You can see the floating bug button, and I'll trigger some errors to capture telemetry."

- Click "Trigger fake error" → shows console error
- Click "Trigger 404" → shows network error
- "The snippet automatically captures these errors."

### Bug Submission (20 seconds)
"Now I'll open the bug report modal and submit a real bug."

- Click floating button
- Fill form: "Button click fails", "Click save button", "Should save", "Throws error"
- Submit → shows success toast with bug ID

### Real-time Analysis (15 seconds)
"Watch the Recent Bugs panel - it auto-refreshes every 5 seconds. The bug starts as 'queued', then flips to 'analyzing', and finally 'analyzed'."

- Point to status changes in the list
- "The worker picked up the job and ran AI analysis."

### Bug View (20 seconds)
"Clicking the bug shows the complete analysis page."

- Click bug link
- Scroll through: title, severity, environment
- Show console logs table
- Show network errors table
- Point to AI analysis section
- Show confidence bar
- Show suggested fix patch diff

### Integration (10 seconds)
"Integration is just one script tag with your public key. The secret key is only used server-side in production - this demo page shows it for testing only."

```html
<script src="/cdn/bugger.min.js"
        data-bugger-key="your_public_key"
        data-bugger-origin="https://your-api.com"></script>
```

### Closing (5 seconds)
"That's the complete flow: capture telemetry, submit bug, AI analysis, and suggested fixes - all in under 30 seconds."

---

## Key Points to Emphasize

1. **One-line integration** - single script tag
2. **Automatic telemetry** - console logs, network errors, screenshots
3. **Real-time processing** - queue to analyzed in seconds
4. **AI-powered analysis** - structured analysis with confidence scores
5. **Suggested fixes** - unified diff patches when applicable
6. **Production ready** - proper auth, rate limiting, sanitization

## Timing Notes

- **Total**: 60-90 seconds
- **Setup**: 5s (already running)
- **Demo page**: 15s
- **Submission**: 20s
- **Analysis**: 15s
- **Bug view**: 20s
- **Integration**: 10s
- **Closing**: 5s

Keep the pace brisk but clear. The demo should feel effortless and impressive.

