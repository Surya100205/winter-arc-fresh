# Winter Arc — 90 Day Transformation Tracker

React + Vite + Supabase-ready personal discipline dashboard.

## Features in this MVP

- 90-day Winter Arc progress
- Daily score ring
- Streak
- Water input
- Protein input
- 10K steps tracker
- Gym/workout
- Running
- Sleep
- Coding minutes
- Job applications OR 30-minute career focus
- No junk food
- No added sugar
- No phone while eating
- Hair care
- Focus on yourself
- Daily reflection
- Analytics chart
- Achievement system
- Responsive dark UI
- 10K-step celebration animation
- LocalStorage fallback while Supabase is not configured

## Run

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal.

## Supabase setup

1. Create a free Supabase project.
2. Open SQL Editor.
3. Run `schema.sql`.
4. Copy `.env.example` to `.env`.
5. Put your Supabase project URL and anon key into `.env`.
6. Restart Vite.

The current MVP keeps logs in LocalStorage so the UI works immediately. The `supabase.js` file and `schema.sql` are prepared for the next step where daily logs are persisted to Supabase.

## Important

Do not put a Supabase service-role key in the frontend. Use only the public anon/publishable key.
