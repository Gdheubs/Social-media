# Next-Gen Hybrid Social Ecosystem - Architecture Documentation

## System Overview
A full-stack social media platform merging Instagram Reels-style short-form video with Facebook's community depth, featuring a creator economy with monetization.

## Tech Stack
- **Frontend**: React 19, React Router, Framer Motion, Tailwind CSS, Recharts
- **Backend**: FastAPI (Python), Motor (MongoDB async driver)
- **Database**: MongoDB
- **Video Processing**: Cloudinary (upload, transcode, HLS streaming)
- **Payments**: Stripe Connect (tips, fundraising, payouts)
- **Authentication**: JWT-based with bcrypt password hashing

## Database Schema

### Collections

#### `users`
```javascript
{
  id: String (UUID),
  email: String (unique),
  password_hash: String (bcrypt),
  username: String (unique),
  account_type: String (personal|professional|business),
  avatar: String (Cloudinary URL),
  bio: String,
  verification_status: Boolean,
  wallet_balance: Float,
  total_views: Integer,
  created_at: String (ISO 8601)
}
```

#### `videos`
```javascript
{
  id: String (UUID),
  user_id: String,
  username: String,
  user_avatar: String,
  cloudinary_public_id: String,
  cloudinary_url: String (secure_url),
  aspect_ratio: String (9:16|16:9),
  title: String,
  description: String,
  view_count: Integer,
  validated_views: Integer,
  tips_received: Float,
  created_at: String (ISO 8601),
  status: String (active|moderated|removed)
}
```

#### `payment_transactions`
```javascript
{
  id: String (UUID),
  session_id: String (Stripe session ID),
  from_user_id: String,
  to_user_id: String (for tips),
  fundraiser_id: String (for fundraisers),
  video_id: String (for tips),
  amount: Float,
  currency: String (default: usd),
  type: String (tip|fundraiser|payout),
  payment_status: String (pending|completed|failed),
  metadata: Object,
  created_at: String (ISO 8601)
}
```

#### `fundraisers`
```javascript
{
  id: String (UUID),
  business_user_id: String,
  username: String,
  title: String,
  description: String,
  goal_amount: Float,
  current_amount: Float,
  status: String (active|completed|cancelled),
  created_at: String (ISO 8601)
}
```

#### `moderation_flags`
```javascript
{
  id: String (UUID),
  video_id: String,
  flagged_by: String (user_id),
  reason: String,
  status: String (pending|reviewed|actioned),
  reviewed_by: String (admin user_id),
  created_at: String (ISO 8601)
}
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login and get JWT token

### Users
- `GET /api/users/me` - Get current user profile
- `GET /api/users/{username}` - Get public user profile
- `PUT /api/users/profile` - Update profile (avatar, bio)

### Videos
- `POST /api/videos/upload` - Upload video metadata after Cloudinary upload
- `GET /api/videos/feed` - Get paginated video feed
- `GET /api/videos/{video_id}` - Get single video
- `POST /api/videos/{video_id}/view` - Increment view count
- `GET /api/videos/user/{username}` - Get user's videos

### Cloudinary
- `GET /api/cloudinary/signature` - Generate signed upload params (authenticated)

### Tips
- `POST /api/tips/initiate` - Start tip payment flow (creates Stripe session)
- `GET /api/tips/status/{session_id}` - Poll payment status

### Fundraisers
- `POST /api/fundraisers/create` - Create fundraiser (business accounts only)
- `GET /api/fundraisers` - Get all active fundraisers
- `POST /api/fundraisers/{fundraiser_id}/contribute` - Start contribution payment
- `GET /api/fundraisers/status/{session_id}` - Poll contribution status

### Analytics
- `GET /api/analytics/dashboard` - Get creator analytics (videos, views, tips, balance)

### Moderation
- `POST /api/moderation/flag` - Flag video for review
- `GET /api/moderation/queue` - Get pending flags (admin only)

### Admin
- `GET /api/admin/stats` - Get platform statistics (admin only)

### Webhooks
- `POST /api/webhook/stripe` - Stripe payment webhook handler

## Monetization Engine

### View-Based Earnings
- **Rate**: $0.50 per 1,000 validated views
- **Tracking**: `validated_views` field in videos collection
- **Payout**: Automatic credit to `wallet_balance` every 1,000 views
- **Platform Fee**: 5% on all transactions

### Tipping System
1. User clicks tip button on video
2. Frontend sends tip request to backend
3. Backend creates Stripe checkout session
4. User redirects to Stripe, completes payment
5. Frontend polls `/api/tips/status/{session_id}`
6. Backend verifies payment, credits creator wallet (95% after platform fee)
7. Updates `tips_received` on video

### Fundraising (Business Accounts Only)
1. Business user creates fundraiser with goal amount
2. Supporters contribute any amount via Stripe
3. Progress bar shows `current_amount / goal_amount`
4. All contributions tracked in `payment_transactions`
5. Escrow-like transparency through transaction records

## Video Upload Flow

### Client-Side (Frontend)
1. User selects video file
2. Selects aspect ratio (9:16 vertical or 16:9 horizontal)
3. Fills title and description
4. Frontend requests signed upload from `/api/cloudinary/signature`
5. Frontend uploads video directly to Cloudinary using signature
6. On success, sends metadata to `/api/videos/upload`

### Server-Side (Backend)
1. Validates user authentication
2. Generates Cloudinary signature with timestamp
3. Returns signature, timestamp, cloud_name, api_key
4. Receives video metadata after upload
5. Stores video record in database with Cloudinary URLs

### Cloudinary Configuration
- **Resource Types**: image, video
- **Folders**: uploads/ (can extend to users/{user_id}/)
- **Transformations**: Auto quality, auto format, responsive sizing
- **Streaming**: HLS for buffer-free playback

## Frontend Architecture

### Routes
- `/` - Landing page (public)
- `/feed` - Video feed with infinite scroll (authenticated)
- `/upload` - Video upload interface (authenticated)
- `/profile/:username` - User profile with video grid (public/authenticated)
- `/wallet` - Earnings and payout management (authenticated)
- `/analytics` - Creator dashboard with charts (authenticated)
- `/fundraisers` - Browse and contribute to fundraisers (authenticated)
- `/tip-success` - Payment success page with polling
- `/fundraiser-success` - Contribution success page

### State Management
- Local state with React hooks
- localStorage for auth token and user data
- No global state library (keeping it simple)

### Design System
- **Theme**: Dark cinematic with emerald (#10B981) accents
- **Typography**: Outfit (headings), Manrope (body)
- **Effects**: Glassmorphism, neumorphism, gradient masks
- **Animations**: Framer Motion for page transitions, micro-interactions

## Security Considerations

### Authentication
- Passwords hashed with bcrypt (cost factor 12)
- JWT tokens with 30-day expiration
- Tokens stored in localStorage (consider httpOnly cookies for production)

### Payment Security
- Never trust frontend for payment amounts
- All amounts validated on backend
- Stripe handles PCI compliance
- 5% platform fee calculated server-side
- Double-payment prevention via session_id checks

### Video Upload Security
- Signed uploads only (no unsigned Cloudinary uploads)
- Folder path validation
- File size/type validation (client-side preview)
- Cloudinary handles malware scanning

### CORS Configuration
- Backend allows all origins (for development)
- Production should restrict to frontend domain

## Environment Variables

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
CORS_ORIGINS=*
JWT_SECRET=<secure_random_string>
STRIPE_API_KEY=sk_test_emergent
CLOUDINARY_CLOUD_NAME=dck4rnfs3
CLOUDINARY_API_KEY=523221771562841
CLOUDINARY_API_SECRET=fwPtyK5aPdBSwd4L7CpI8GP7m80
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://creator-cosmos.preview.emergentagent.com
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
```

## Deployment Notes

### Service Architecture
- Backend runs on port 8001 (internally)
- Frontend runs on port 3000 (internally)
- Kubernetes ingress routes:
  - `/api/*` → Backend (8001)
  - `/*` → Frontend (3000)

### Hot Reload
- Both services have hot reload enabled
- Restart required only for .env changes or dependency updates

### Database
- MongoDB runs locally at localhost:27017
- No authentication required (development environment)

## Future Enhancements

### Phase 2 Features
1. **Admin Panel**: Complete moderation dashboard with AI flagging
2. **Close Friends**: Privacy-first sharing for personal accounts
3. **Payout Integration**: Stripe Connect for creator withdrawals
4. **Analytics**: Advanced metrics, heatmaps, audience demographics
5. **Search**: Full-text search for videos and users
6. **Comments**: Real-time comment threads on videos
7. **Notifications**: Push notifications for tips, comments, milestones
8. **Live Streaming**: Real-time video broadcasting
9. **Stories**: 24-hour ephemeral content
10. **Verification System**: Manual review flow for verified badges

### Technical Debt
1. Add comprehensive error boundaries in React
2. Implement retry logic for failed API calls
3. Add request rate limiting on backend
4. Implement caching (Redis) for frequently accessed data
5. Add database indexes for performance
6. Implement CDN for static assets
7. Add monitoring and logging (Sentry, DataDog)
8. Implement feature flags for gradual rollouts
9. Add end-to-end tests with Cypress
10. Implement progressive web app (PWA) features

## Test Credentials

### Test Users
- **Personal**: personal@test.com / Test123456
- **Creator**: creator@test.com / Test123456
- **Business**: business@test.com / Test123456
- **Admin**: admin@example.com / Admin123456

### API Keys
- **Stripe**: sk_test_emergent (pre-configured test key)
- **Cloudinary**: Configured with provided credentials

## Performance Optimizations

### Frontend
- Code splitting by route
- Lazy loading for heavy components
- Image optimization via Cloudinary
- Video lazy loading (intersection observer)

### Backend
- Async/await for non-blocking I/O
- MongoDB projections to exclude unnecessary fields
- Pagination for all list endpoints
- Connection pooling with Motor

### Video Delivery
- Cloudinary auto-quality and auto-format
- Adaptive bitrate streaming (HLS)
- CDN edge caching
- Responsive image transformations

## Monitoring & Observability

### Key Metrics to Track
1. **Business Metrics**:
   - Daily/Monthly Active Users (DAU/MAU)
   - Video uploads per day
   - Total views and watch time
   - Tip conversion rate
   - Average revenue per user (ARPU)

2. **Technical Metrics**:
   - API response times (p50, p95, p99)
   - Error rates by endpoint
   - Database query performance
   - Video upload success rate
   - Payment success rate

3. **User Experience**:
   - Page load times
   - Time to first video play
   - Video buffering rate
   - Bounce rate by page

## Support & Documentation

### User Documentation
- Landing page has clear value propositions
- Account types explained during registration
- In-app tooltips for complex features

### Developer Documentation
- This architecture document
- API documentation (can generate OpenAPI/Swagger)
- Integration playbooks for Stripe and Cloudinary
- Test credentials file for QA

---

**Last Updated**: January 30, 2026
**Version**: 1.0.0
**Status**: MVP Complete, Ready for Testing
