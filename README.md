# DailyQuill

A private daily diary. Write your thoughts, keep them to yourself, or share them with
people you choose — with approval-based following, realtime chat, and voice/video calling.

The project is split into two servers:

```
dailyquill/
├── backend/     Express + Socket.IO + MongoDB — all data, auth and realtime
└── frontend/    Next.js 14 (App Router) — the UI
```

## Getting started

```bash
# Install both workspaces from the repo root
npm install

# Copy the env templates and fill them in
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Run both servers together
npm run dev
```

- API → http://localhost:5000
- Web → http://localhost:3000

Other root scripts: `npm run build`, `npm start`, `npm run typecheck`, `npm run lint`.

> The backend uses MongoDB transactions for follow approvals and comment counters, so
> `MONGO_URI` must point at a replica set. MongoDB Atlas works out of the box.

## Deployment

One repo, two targets. They can't share a host: the backend holds long-lived
Socket.IO connections, and **Vercel's serverless functions can't keep those open** —
so only the frontend goes there.

| Workspace | Host | Config |
| --- | --- | --- |
| `frontend/` | Vercel | Root Directory → `frontend` |
| `backend/` | Render | [render.yaml](render.yaml) |

Deploy the **backend first** — the frontend needs its URL at build time.

### Backend → Render

**New → Blueprint**, point it at this repo; it reads `render.yaml`. Fill in the
secrets in the dashboard (everything marked `sync: false`), and set `CORS_ORIGINS`
to your Vercel origin once you have it.

Build and start commands run from the repo root, not `backend/`, because npm
workspaces keeps one lockfile at the root.

> Render's free tier sleeps after ~15 min idle and takes ~30 s to wake, dropping
> live socket connections. Use a paid instance for real traffic.

### Frontend → Vercel

**Add New → Project**, import this repo, then set **Root Directory** to `frontend`.
Vercel detects the Next.js preset and the npm workspace automatically.

Add both env vars under Settings → Environment Variables, for Production *and* Preview:

| Variable | Example |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://dailyquill-api.onrender.com` |
| `NEXT_PUBLIC_SITE_URL` | `https://dq-fb.vercel.app` |

Both are `NEXT_PUBLIC_*`, so they're **inlined into the client bundle at build
time** — changing either needs a redeploy, not just an env edit.

### The handshake

The deploy isn't done until both sides know each other: the frontend needs
`NEXT_PUBLIC_API_URL`, and the backend needs your Vercel origin in `CORS_ORIGINS`.
Miss the second and every request fails CORS — login breaks with no obvious error.

Preview deploys get generated URLs (`dq-fb-git-<branch>-<you>.vercel.app`) that
won't be in `CORS_ORIGINS`. Add the ones you use, or test against Production.

### Cookies across two domains

Auth rides on a cookie set by the API's origin. Across `vercel.app` and
`onrender.com` the browser treats it as third-party — **Safari and Firefox block
those by default**, so sign-in will fail for those users.

`backend/src/utils/token.ts` already sends `SameSite=None; Secure` whenever
`NODE_ENV=production`, which is what makes Chrome work. Leave `COOKIE_DOMAIN`
blank while the two live on different domains.

The durable fix is putting both behind one domain via custom domains
(`www.dailyquill.com` + `api.dailyquill.com`) and setting `COOKIE_DOMAIN=.dailyquill.com`.

## How the social model works

**Following is always by approval.** Sending a follow creates a *pending* request. Nothing
lands in a follower or following list until the recipient accepts it from **Requests**.
That approved edge is what unlocks messaging and calling.

**Private accounts** control readability. A private account's entries are visible only to
accepted followers; a public account's entries are visible to any signed-in user.

**Six reachability controls** live in Adjustments. Each channel has a yes/no switch and,
when it's on, an audience:

| Channel | "Do you want this at all?" | "And from whom?" |
| --- | --- | --- |
| Messages | Let people message you | Only connections · Everyone |
| Voice calls | Let people call you | Only connections · Everyone |
| Video calls | Let people video call you | Only connections · Everyone |

All three default to **Only connections**, where a connection is an accepted follow edge
in either direction — so the person being followed can always reply to whoever reached out.
The recipient's settings are re-checked on every message and every call, not just when a
conversation is first opened.

## Realtime

Socket.IO replaces the previous Pusher integration. One authenticated connection per user
carries presence, chat, follow notifications, and WebRTC signaling. All of a user's tabs
join a shared room, so events reach every device.

## Calling

Media is peer-to-peer; the server only relays SDP and ICE and never sees audio or video.

The connection is tuned rather than left on browser defaults:

- **Audio** — echo cancellation, noise suppression and auto gain control, mono at 48 kHz,
  with Opus in-band FEC and DTX enabled so speech survives packet loss.
- **Video** — 720p30 target, VP8/H.264 preferred for hardware acceleration.
- **Adaptive** — `getStats()` is sampled every 3 s; measured RTT, jitter and packet loss
  re-budget the encoder bitrate and send resolution, and audio is prioritised over video
  when the link degrades.
- **Reliability** — perfect-negotiation handling for renegotiation races, automatic ICE
  restart on failure, and a grace period so a brief network blip doesn't drop a live call.

Public STUN servers are built in and there is no TURN relay, so calls do not connect for
peers behind symmetric NAT — common on mobile and corporate networks.

## Frontend notes

There is no component library. Every UI primitive under `frontend/src/components/ui/` is
written from scratch on Tailwind — `antd`, `@mui/material`, `@mantine/core`, `react-icons`
and `@heroicons/react` were all removed, taking shared JS from roughly 400 kB to 87 kB.

The layout is mobile-first throughout: a bottom tab bar and full-screen sheets on phones,
a sidebar and split panes from `lap` (1024px) up.

Core Web Vitals are treated as constraints rather than an afterthought — fixed-footprint
skeletons and reserved media boxes for CLS, `next/font` with a metric-matched fallback and
API preconnect for LCP, and debounced search with lazily-mounted overlays for INP.

## Removed

Razorpay, the subscription model and all payment/checkout routes have been deleted. There
is no paid tier.
