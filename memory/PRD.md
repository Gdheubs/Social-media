# Creator Cosmos - Product Requirements Document

## Original Problem Statement
Design and build a "Next-Gen Hybrid Social Ecosystem" merging Instagram Reels and Facebook. Key features include a Unified Video Engine (vertical/horizontal), 3 account types (Personal, Creator, Business), Monetization (Stripe tips, fundraisers), AI Content Filtering, Admin God-Mode dashboard, WebSockets for real-time notifications, Live Streaming capabilities, and Multi-Provider Authentication.

## Tech Stack
- Frontend: React 18, Tailwind CSS, Framer Motion
- Backend: FastAPI (Python), Uvicorn
- Database: MongoDB (Motor async driver)
- Real-time: Socket.IO (python-socketio)
- Payments: Stripe (native Python SDK)
- Video CDN: Cloudinary
- Live Streaming: Agora RTC
- AI Moderation: OpenAI

## What's Been Implemented (Complete)

### Phase 1 - Core MVP
- FastAPI + React scaffolding with MongoDB
- User registration/login with JWT auth
- 3 account types: Personal, Creator, Business
- Video feed with Cloudinary integration

### Phase 2 - Social Features
- Comments system (nested threads, edit, delete)
- Search (videos and users)
- Creator Spotlight
- Notifications system

### Phase 3 - Advanced Features
- WebSockets (Socket.IO) for real-time notifications
- AI Moderation structure (OpenAI integration)
- Admin Dashboard with analytics charts (time-series, engagement)
- Stripe payments: Tips and Fundraisers

### Phase 4 - Live & Privacy
- Agora live streaming integration
- Privacy settings (configurable profile visibility)
- Multi-auth structure
- Wallet/earnings tracking

### Phase 5 - AWS Deployment Preparation (COMPLETED Feb 2026)
- Removed `emergentintegrations` vendor dependency
- Migrated all Stripe routes to native `stripe` Python SDK
- Fixed route registration bug (include_router placement)
- Comprehensive README.md with API reference, env variable docs, integration setup guides
- AWS Deployment Guide with VPC, EC2, DocumentDB, ALB, Auto Scaling, CloudWatch setup

## Pending / Backlog

### P1 - Deployment Guide Polish
- Verify AWS_DEPLOYMENT_GUIDE.md reflects all current env variables (DONE)

### P2 - Future Enhancements
- Standard OAuth (Google/Facebook) for AWS-independent auth
- Refactor server.py (~1650 lines) into modular route files
- CI/CD pipeline setup
- Rate limiting and brute force protection

## Key Files
- `/app/backend/server.py` - Main backend (all routes)
- `/app/frontend/src/App.js` - Frontend routing
- `/app/README.md` - Comprehensive documentation
- `/app/deployment/AWS_DEPLOYMENT_GUIDE.md` - AWS deployment guide

## Test Accounts
See `/app/memory/test_credentials.md`
