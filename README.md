# Marketing Department Portal

Internal marketing department portal built with React, TypeScript, Tailwind CSS, and Supabase.

## Tech Stack

- **React** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Utility-first styling
- **React Router** - Client-side routing
- **TanStack Query** - Data fetching and caching
- **React Hook Form + Zod** - Form handling and validation
- **Supabase** - Authentication and database
- **Vite** - Build tool

## Prerequisites

- Node.js 22.13.0 or higher
- A Supabase account and project

## Setup

1. Clone the repository:
```bash
git clone https://github.com/mendiolanivelle/marketing-department-website.git
cd marketing-department-website
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Replace the placeholder values with your Supabase credentials:
```bash
VITE_SUPABASE_URL=your_actual_supabase_url
VITE_SUPABASE_ANON_KEY=your_actual_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:5173`

## Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API
3. Copy your Project URL and anon/public key
4. Paste them into your `.env` file
5. (Optional) Set up authentication providers in Supabase Dashboard > Authentication > Providers

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/       # Reusable UI components
├── contexts/         # React context providers
├── lib/             # Utility libraries (Supabase client)
├── pages/           # Page components
├── providers/       # Third-party providers (TanStack Query)
└── main.tsx         # Application entry point
```

## Features

- **Authentication** - Secure login with Supabase Auth
- **Protected Routes** - Only authenticated users can access the portal
- **Dashboard** - Central hub with announcements and quick links
- **Department Info** - About, services, and team information
- **Contact Form** - Internal request submission with validation
- **Responsive Design** - Works on desktop, tablet, and mobile

## Deployment

The project is configured for deployment on Coolify. Push to the `master` branch to trigger automatic deployment.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

## License

Internal use only.
