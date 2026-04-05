# Flourish — PRD & Implementation Status
*Last updated: 2026-04-05*

## App Overview
Flourish is an AI-powered food intelligence mobile web app for people with hormonal conditions and chronic illnesses. Users select their health condition and rate any food via search or barcode scan. The app uses Claude AI to return personalised health ratings across 4 dimensions.

## Architecture
- **Frontend**: React (Create React App), Framer Motion animations, Lucide icons, mobile-first max-width 480px
- **Backend**: FastAPI (Python), MongoDB, JWT auth
- **AI**: Anthropic Claude Sonnet 4.5 via emergentintegrations library
- **Payments**: Stripe checkout via emergentintegrations library
- **Email**: EmailJS (@emailjs/browser)

## What's Been Implemented ✅

### Auth
- JWT-based email/password register + login
- Token stored in localStorage
- Session persists (30 day JWT expiry)
- Admin seeded on startup (Flourish2026)

### Onboarding (5 screens)
- Screen 1: Flourish logo, tagline, rotating taglines, Get Started
- Screen 2: Condition selection (8 cards, multi-select, purple highlight)
- Screen 3: Goal selection (4 cards, multi-select)
- Screen 4: Duration + challenge (combined screen)
- Screen 5: Personalised welcome + checkmark animation
- Profile saved to MongoDB on complete

### Home Screen
- Time-of-day greeting
- "Today at a glance" stats card (avg score, logged, streak, remaining)
- AI-generated daily tip (personalised by condition, cached per day)
- "What should I eat today?" → Meal Planner
- Food search bar + Rate it button + Camera/Scan button
- Condition-specific loading messages during AI call
- Quick picks (10 foods with emoji)
- Recently rated (last 3 entries)
- "How are you feeling today?" symptom check-in button
- Streak reward banner (spring bounce from top)
- Streak milestone full-screen celebrations (days 3, 7, 14, 21, 30)
- Crown icon → Paywall

### Food Rating Screen
- Full-width food image card (product image or emoji placeholder)
- Animated score circle (0→final, spring easing, 1 second)
- Haptic vibration on score lock
- Audio tones (ascending chime for green, low note for red, neutral for amber)
- Colour-coded verdict pill
- "For Your Conditions" card (blurred for free users)
- Health dimensions 2x2 grid (naturalness free, 3 locked premium)
- Positives / Watch out / Tips cards
- Body systems affected (colour-coded chips)
- Better alternatives (3 cards, blurred for free users)
- Log to diary button (morphs to checkmark, green particle burst, haptic)
- Share button (Web Share API)
- Premium upgrade banner for free users
- Disclaimer text

### Food Diary
- Date navigation (< today >)
- Monthly stats (avg, best day, worst day)
- Search by food name
- Filter by green/amber/red
- Entry cards with food image, score, verdict snippet
- Notes field (auto-save on blur)
- Delete with confirmation dialog
- Diary locked for past dates (free users)
- Dates with entries show purple dot (via /diary/dates API)

### Streak & Rewards System
- Streak tracked on login (consecutive daily logins)
- Longest streak tracked separately
- Bonus scans: 1 scan at day 1, 2 scans at day 3+
- Day 14: 24h premium preview (triggers once ever)
- Day 30: 1 week premium free
- Streak reward banner slides in from top
- Milestone full-screen celebrations (days 3, 7, 14, 21, 30)
- Days 7 and 30 auto-dismiss after 2 seconds

### Symptom Tracker
- 5-dimension check-in (Energy, Bloating, Brain fog, Mood, Skin)
- 1-5 emoji slider rating
- Saved to DB with upsert (one entry per day)
- Accessible from "How are you feeling today?" button

### Meal Planner
- AI-generated one-day meal plan (breakfast, lunch, dinner, snack)
- All meals pre-rated green
- Emoji food images
- Regenerate button
- Free users see breakfast only, rest locked
- Opens from "What should I eat today?" button

### Premium Paywall
- Dynamic headline by condition (8 conditions)
- Price justification card
- Monthly/Annual toggle (annual pre-selected)
- Anchor pricing with strikethrough
- Launch price urgency copy
- 3-day free trial badge
- 6 benefits in outcome language
- Rotating testimonials (3 rotating quotes, labelled "Beta feedback")
- Trust signals
- "Start 3-Day Free Trial" → Stripe checkout
- Exit intent modal ("Maybe later" → "Early access price locks in forever")
- Medical disclaimer

### Stripe Integration
- Server-side checkout session creation
- trial_period_days=3
- Monthly (£12.99) and Annual (£84.99) plans
- success/cancel redirect URLs
- Poll payment status on return
- Premium flag set in DB on payment confirmed
- Upgrade success animation

### Admin Dashboard (/admin)
- Password protection (Flourish2026)
- Real-time stats (total users, premium, revenue, pending affiliates)
- 5 tabs: Overview, Users, Subscriptions, Affiliates, Activity
- CSV export on all tables
- Affiliate approve/reject buttons
- Activity bar chart (last 30 days)
- Auto-refresh every 30 seconds

### Affiliate System
- Application page (/affiliate) with full form + validation
- EmailJS notification on submission
- Affiliate dashboard (/affiliate/dashboard)
- Commission rates displayed (30% monthly £3.90, annual £25.50)
- Referral link with click tracking via localStorage

### Referral Programme (Premium only)
- Unique referral code per user
- Referral link with ?ref= parameter
- Stats: paying referrals, free months earned
- Share via Web Share API (copy fallback)

### EmailJS Notifications
- New user registration
- Premium upgrade
- Affiliate application submitted
- (Note: keys must be set in frontend .env)

### Barcode Scanner
- BarcodeDetector API (native browser)
- Manual barcode input fallback
- Open Food Facts API lookup
- Product image from Open Food Facts
- Rating flow from scan

### Splash Screen
- 800ms total duration
- Logo pulse (1.05 scale) then fade
- Only shows on first load (sessionStorage flag)
- No blank white flash

## Pages / Routes
- `/` - Main app (auth → onboarding → home)
- `/admin` - Admin dashboard
- `/affiliate` - Affiliate application
- `/affiliate/dashboard` - Affiliate dashboard

## Freemium Split
- Free: 5 ratings/day + bonus scan scans, today diary only, naturalness dimension only, breakfast meal plan only
- Premium: unlimited ratings, full diary history, all dimensions, full meal plan, patterns tab, clean share cards

## Known Items / Next Steps
- P0: Add ANTHROPIC_API_KEY / STRIPE keys to backend .env for production
- P0: Add EMAILJS keys to frontend .env for email notifications
- P1: Weekly envelope animation (Sunday sealed envelope card)
- P1: Patterns tab after 14 days (AI-generated condition-specific insights)
- P1: Shareable HTML canvas rating card generation
- P1: Stripe webhook for subscription cancellation detection
- P2: Push notifications for daily reminders
- P2: Split onboarding screen 4 into separate duration and challenge screens
- P2: Progress bars with spring overshoot physics (currently solid fills)
- P2: Confetti burst on streak milestones (currently full-screen celebration)
- P3: Admin: proper JWT instead of password-embedded token

## Backlog
- Stripe webhook endpoint for subscription events (cancellations, renewals)
- App PWA manifest + service worker for installability
- Apple Health / Google Fit integration
- Food photography upload
