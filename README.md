# Creator Cosmos - Next-Gen Hybrid Social Ecosystem

A full-stack social media platform merging Instagram Reels and Facebook, featuring vertical/horizontal video feeds, creator monetization, live streaming, AI moderation, and a full admin dashboard.

## Tech Stack

| Layer       | Technology                              |
|-------------|----------------------------------------|
| Frontend    | React 18, Tailwind CSS, Framer Motion  |
| Backend     | FastAPI (Python), Uvicorn              |
| Database    | MongoDB (via Motor async driver)       |
| Real-time   | Socket.IO (python-socketio)            |
| Payments    | Stripe (standard Python SDK)           |
| Video CDN   | Cloudinary                             |
| Live Stream | Agora RTC                              |
| AI          | OpenAI (content moderation)            |

---

## Features

- **Unified Video Engine** - Vertical and horizontal video feed with infinite scroll
- **3 Account Types** - Personal, Creator, Business (with different capabilities)
- **Tips & Fundraisers** - Stripe-powered monetization for creators
- **Live Streaming** - Real-time broadcasting via Agora SDK
- **AI Content Moderation** - OpenAI-powered flagging and review
- **Admin God-Mode Dashboard** - Full analytics with time-series charts, user management, content moderation queue
- **Real-time Notifications** - WebSocket-powered notification system
- **Creator Spotlight** - Featured creators section
- **Comments & Threads** - Nested comment system with edit/delete
- **Privacy Settings** - Configurable profile visibility
- **Search** - Video and user discovery
- **Wallet** - Track earnings and transaction history

---

## Project Structure

```
/app
├── backend/
│   ├── server.py              # FastAPI application (all routes)
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Backend environment variables
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── TipModal.js
│   │   │   ├── FundraiserModal.js
│   │   │   ├── Navigation.js
│   │   │   ├── NotificationCenter.js
│   │   │   └── CreatorSpotlight.js
│   │   ├── pages/             # Route pages
│   │   │   ├── Feed.js
│   │   │   ├── Landing.js
│   │   │   ├── Profile.js
│   │   │   ├── Upload.js
│   │   │   ├── Wallet.js
│   │   │   ├── Fundraisers.js
│   │   │   ├── Analytics.js
│   │   │   ├── AdminDashboard.js
│   │   │   ├── TipSuccess.js
│   │   │   └── FundraiserSuccess.js
│   │   ├── services/
│   │   │   └── websocket.js   # Socket.IO client
│   │   ├── App.js             # Router and layout
│   │   └── index.css          # Global styles (Tailwind)
│   ├── package.json
│   └── .env                   # Frontend environment variables
├── deployment/
│   └── AWS_DEPLOYMENT_GUIDE.md
└── README.md
```

---

## Environment Variables

### Backend (`/app/backend/.env`)

| Variable                 | Required | Description                                      | Where to Get It                                         |
|--------------------------|----------|--------------------------------------------------|--------------------------------------------------------|
| `MONGO_URL`              | Yes      | MongoDB connection string                        | MongoDB Atlas or self-hosted                            |
| `DB_NAME`                | Yes      | Database name                                    | Your choice (e.g., `creator_cosmos`)                   |
| `JWT_SECRET`             | Yes      | Secret for JWT token signing                     | Generate: `openssl rand -base64 32`                    |
| `CORS_ORIGINS`           | Yes      | Comma-separated allowed origins                  | Your frontend domain(s)                                |
| `STRIPE_API_KEY`         | Yes      | Stripe secret key for payments                   | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) |
| `STRIPE_WEBHOOK_SECRET`  | Optional | Stripe webhook endpoint secret                   | [Stripe Webhooks](https://dashboard.stripe.com/webhooks) |
| `CLOUDINARY_CLOUD_NAME`  | Yes      | Cloudinary cloud name for video uploads          | [Cloudinary Console](https://console.cloudinary.com)   |
| `CLOUDINARY_API_KEY`     | Yes      | Cloudinary API key                               | Cloudinary Console > Settings > API Keys               |
| `CLOUDINARY_API_SECRET`  | Yes      | Cloudinary API secret                            | Same as above                                          |
| `OPENAI_API_KEY`         | Optional | OpenAI key for AI content moderation             | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `AGORA_APP_ID`           | Optional | Agora app ID for live streaming                  | [Agora Console](https://console.agora.io)              |
| `AGORA_APP_CERTIFICATE`  | Optional | Agora app certificate                            | Agora Console > Project > App Certificate              |
| `FRONTEND_URL`           | Yes      | Public URL of the frontend                       | Your deployed frontend URL                             |

### Frontend (`/app/frontend/.env`)

| Variable                  | Required | Description                        |
|---------------------------|----------|------------------------------------|
| `REACT_APP_BACKEND_URL`   | Yes      | Public URL of the backend API      |

---

## Local Development Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB (local or Atlas)
- yarn

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd app
```

### 2. Backend Setup
```bash
cd backend

# Create and configure .env (see table above)
# Edit .env with your values

# Install dependencies
pip install -r requirements.txt

# Start the backend (port 8001)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Frontend Setup
```bash
cd frontend

# Configure .env
echo 'REACT_APP_BACKEND_URL=http://localhost:8001' > .env

# Install dependencies
yarn install

# Start the frontend (port 3000)
yarn start
```

### 4. Access the App
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8001/api`

---

## API Reference

### Authentication
| Method | Endpoint                | Auth | Description            |
|--------|------------------------|------|------------------------|
| POST   | `/api/auth/register`   | No   | Register a new user    |
| POST   | `/api/auth/login`      | No   | Login, returns JWT     |

### Users
| Method | Endpoint                         | Auth | Description                   |
|--------|----------------------------------|------|-------------------------------|
| GET    | `/api/users/me`                  | Yes  | Get current user profile      |
| GET    | `/api/users/{username}`          | No   | Get user by username          |
| PUT    | `/api/users/profile`             | Yes  | Update profile                |
| GET    | `/api/users/me/privacy`          | Yes  | Get privacy settings          |
| PUT    | `/api/users/me/privacy`          | Yes  | Update privacy settings       |
| PUT    | `/api/users/me/profile-extended` | Yes  | Update phone/birthday/location|

### Videos
| Method | Endpoint                         | Auth | Description                    |
|--------|----------------------------------|------|--------------------------------|
| GET    | `/api/cloudinary/signature`      | Yes  | Get Cloudinary upload signature|
| POST   | `/api/videos/upload`             | Yes  | Register uploaded video        |
| GET    | `/api/videos/feed`               | No   | Get video feed (paginated)     |
| GET    | `/api/videos/{video_id}`         | No   | Get single video               |
| POST   | `/api/videos/{video_id}/view`    | No   | Record a view                  |
| GET    | `/api/videos/user/{username}`    | No   | Get user's videos              |
| GET    | `/api/videos/search/query`       | No   | Search videos by query         |

### Comments
| Method | Endpoint                             | Auth | Description          |
|--------|--------------------------------------|------|----------------------|
| POST   | `/api/videos/{video_id}/comments`    | Yes  | Add comment          |
| GET    | `/api/videos/{video_id}/comments`    | No   | Get video comments   |
| GET    | `/api/comments/{comment_id}/replies` | No   | Get comment replies  |
| PUT    | `/api/comments/{comment_id}`         | Yes  | Edit comment         |
| DELETE | `/api/comments/{comment_id}`         | Yes  | Delete comment       |

### Payments (Stripe)
| Method | Endpoint                                       | Auth | Description                     |
|--------|------------------------------------------------|------|---------------------------------|
| POST   | `/api/tips/initiate`                           | Yes  | Create Stripe tip checkout      |
| GET    | `/api/tips/status/{session_id}`                | No   | Check tip payment status        |
| POST   | `/api/fundraisers/create`                      | Yes  | Create fundraiser (Business)    |
| GET    | `/api/fundraisers`                             | No   | List active fundraisers         |
| POST   | `/api/fundraisers/{id}/contribute`             | Yes  | Contribute to fundraiser        |
| GET    | `/api/fundraisers/status/{session_id}`         | No   | Check fundraiser payment status |
| POST   | `/api/webhook/stripe`                          | No   | Stripe webhook receiver         |

### Live Streaming (Agora)
| Method | Endpoint                              | Auth | Description             |
|--------|---------------------------------------|------|-------------------------|
| POST   | `/api/live/token`                     | Yes  | Generate Agora token    |
| POST   | `/api/live/start`                     | Yes  | Start a live stream     |
| PUT    | `/api/live/{stream_id}/end`           | Yes  | End a live stream       |
| GET    | `/api/live/active`                    | No   | List active streams     |
| GET    | `/api/live/{stream_id}`               | No   | Get stream details      |
| PUT    | `/api/live/{stream_id}/viewer-count`  | No   | Update viewer count     |

### Notifications
| Method | Endpoint                                 | Auth | Description             |
|--------|------------------------------------------|------|-------------------------|
| GET    | `/api/notifications`                     | Yes  | Get user notifications  |
| PUT    | `/api/notifications/{id}/read`           | Yes  | Mark notification read  |
| PUT    | `/api/notifications/read-all`            | Yes  | Mark all read           |

### Moderation
| Method | Endpoint                            | Auth  | Description                |
|--------|-------------------------------------|-------|----------------------------|
| POST   | `/api/moderation/flag`              | Yes   | Flag a video               |
| GET    | `/api/moderation/queue`             | Admin | Get pending flags          |

### Admin (requires admin@example.com)
| Method | Endpoint                              | Auth  | Description                  |
|--------|---------------------------------------|-------|------------------------------|
| GET    | `/api/admin/stats`                    | Admin | Platform statistics          |
| GET    | `/api/admin/users`                    | Admin | List all users               |
| PUT    | `/api/admin/users/{id}/verify`        | Admin | Verify a user account        |
| DELETE | `/api/admin/videos/{id}`              | Admin | Remove a video               |
| PUT    | `/api/admin/flags/{id}/resolve`       | Admin | Resolve a moderation flag    |
| GET    | `/api/admin/analytics/timeseries`     | Admin | Time-series chart data       |
| GET    | `/api/admin/analytics/engagement`     | Admin | Engagement metrics           |

### Analytics
| Method | Endpoint                  | Auth | Description                  |
|--------|--------------------------|------|------------------------------|
| GET    | `/api/analytics/dashboard`| Yes  | Creator analytics dashboard  |
| GET    | `/api/creators/spotlight` | No   | Featured creators            |

---

## Stripe Integration Setup

### 1. Get Your API Keys
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Copy your **Secret key** (`sk_test_...` for testing, `sk_live_...` for production)
3. Set it as `STRIPE_API_KEY` in `backend/.env`

### 2. Set Up Webhooks (Optional but Recommended)
1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. URL: `https://your-domain.com/api/webhook/stripe`
4. Events to listen for: `checkout.session.completed`
5. Copy the **Signing secret** (`whsec_...`)
6. Set it as `STRIPE_WEBHOOK_SECRET` in `backend/.env`

> **Note:** Without the webhook, payments are still verified via polling when users return to the success page. The webhook provides a backup confirmation mechanism for edge cases (e.g., user closes browser before redirect).

### 3. How Payments Work
- **Tips:** User clicks "Tip" on a video -> Stripe Checkout session created -> User pays -> Redirected to `/tip-success` -> Status polled -> Creator wallet credited (minus 5% platform fee)
- **Fundraisers:** Business accounts create fundraisers -> Users contribute via Stripe Checkout -> Progress tracked -> Goal tracking

---

## Cloudinary Integration Setup

1. Create an account at [Cloudinary](https://cloudinary.com)
2. Go to **Dashboard** to find your Cloud Name, API Key, and API Secret
3. Set all three in `backend/.env`
4. Videos are uploaded directly from the frontend using signed uploads
5. The backend provides a signature via `/api/cloudinary/signature`

---

## Agora Live Streaming Setup

1. Create an account at [Agora Console](https://console.agora.io)
2. Create a new project
3. Copy the **App ID** and **App Certificate**
4. Set them in `backend/.env` as `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE`
5. The backend generates temporary RTC tokens for each live session

> **Note:** If Agora credentials are not set, the live streaming feature will return a 500 error when users try to start/join streams. All other features work independently.

---

## OpenAI Moderation Setup (Optional)

1. Get an API key from [OpenAI](https://platform.openai.com/api-keys)
2. Set it as `OPENAI_API_KEY` in `backend/.env`
3. Used for AI-powered content moderation

> **Note:** If not configured, the manual moderation queue (admin flagging/review) still works.

---

## Admin Account

The admin panel is accessible to accounts registered with `admin@example.com`. To create an admin:

1. Register a new account with email `admin@example.com`
2. Navigate to `/admin` to access the God-Mode dashboard
3. Features: platform stats, user management, content moderation, analytics charts

---

## Database Schema

### Collections

**users**
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "password_hash": "bcrypt hash",
  "account_type": "personal | creator | business",
  "bio": "string",
  "avatar": "url",
  "wallet_balance": 0.0,
  "followers_count": 0,
  "following_count": 0,
  "privacy_settings": { "profile_visibility": "public", "show_activity": true },
  "created_at": "ISO datetime"
}
```

**videos**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "username": "string",
  "title": "string",
  "description": "string",
  "cloudinary_url": "url",
  "thumbnail_url": "url",
  "orientation": "vertical | horizontal",
  "view_count": 0,
  "tips_received": 0.0,
  "status": "active | removed",
  "created_at": "ISO datetime"
}
```

**payment_transactions**
```json
{
  "id": "uuid",
  "session_id": "stripe_session_id",
  "from_user_id": "uuid",
  "to_user_id": "uuid (for tips)",
  "fundraiser_id": "uuid (for fundraisers)",
  "amount": 10.0,
  "currency": "usd",
  "type": "tip | fundraiser",
  "payment_status": "pending | completed",
  "created_at": "ISO datetime"
}
```

**fundraisers**
```json
{
  "id": "uuid",
  "business_user_id": "uuid",
  "title": "string",
  "description": "string",
  "goal_amount": 1000.0,
  "current_amount": 0.0,
  "status": "active",
  "created_at": "ISO datetime"
}
```

**comments**, **notifications**, **live_streams**, **moderation_flags** - similar UUID-based documents.

---

## AWS Deployment

See the detailed guide: [`/deployment/AWS_DEPLOYMENT_GUIDE.md`](./deployment/AWS_DEPLOYMENT_GUIDE.md)

**Quick summary of what you need:**
1. EC2 instance (t3.medium minimum)
2. MongoDB (DocumentDB, Atlas, or self-hosted)
3. Domain + SSL certificate
4. All environment variables configured
5. Nginx as reverse proxy + Supervisor as process manager

---

## Pre-Deployment Checklist

Before deploying, you only need to plug in your own API keys:

- [ ] **MongoDB**: Set up Atlas or DocumentDB, get connection string -> `MONGO_URL`
- [ ] **Stripe**: Get live keys from dashboard -> `STRIPE_API_KEY`, optionally `STRIPE_WEBHOOK_SECRET`
- [ ] **Cloudinary**: Already configured with existing account, or replace with your own
- [ ] **Agora** (optional): Sign up and get credentials for live streaming
- [ ] **OpenAI** (optional): Get API key for AI moderation
- [ ] **JWT_SECRET**: Generate a strong random secret for production
- [ ] **FRONTEND_URL**: Set to your production domain
- [ ] **CORS_ORIGINS**: Set to your production domain(s)
- [ ] **REACT_APP_BACKEND_URL**: Set to your production backend URL

**Zero code changes required** - just update the `.env` files and deploy.

---

## License

Private - All rights reserved.
