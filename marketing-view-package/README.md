# Project List - Marketing View

A React component for the marketing site to view and manage project review tickets in the feasibility pipeline, with the ability to schedule Google Meet discovery calls.

## Files Included

- `MarketingProjectList.jsx` — Main component with table, schedule modal, and detail modal
- `supabase.js` — Supabase client initialization
- `.env.example` — Required environment variables
- `App.jsx.example` — Example integration into a marketing site

## Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "@iconify/react": "^5.0.1",
    "@supabase/supabase-js": "^2.108.2",
    "react": "^19.2.6",
    "react-dom": "^19.2.6"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.18",
    "tailwindcss": "^4.1.18",
    "vite": "^6.4.3"
  }
}
```

## Setup

1. Copy `MarketingProjectList.jsx` and `supabase.js` into your `src/` directory
2. Copy `.env.example` to `.env` and fill in your Supabase credentials
3. Import and render the component in your app:

```jsx
import MarketingProjectList from './components/MarketingProjectList'

function App() {
  return (
    <div>
      <MarketingProjectList />
    </div>
  )
}
```

## Data Flow

- Reads projects from `prt_leads` localStorage key
- Listens for `prt-projects-updated` custom event to refresh data
- When scheduling a discovery call, updates localStorage and dispatches `prt-projects-updated`
- The operations site picks up the changes via the same event

## Google Calendar OAuth

The schedule meeting modal uses Google Calendar API to create events. The OAuth client ID is hardcoded in the component. Replace it with your own Google Cloud Console OAuth client ID:

```
client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'
```

## Environment Variables

Create a `.env` file: