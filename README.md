# BattleCRM

Personal CRM for job hunting with A/B testing capabilities. Track prospects, manage positioning variants, and optimize your outreach through data-driven experimentation.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18+ / Vite / TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Adonis.js 6 |
| Database | Supabase (PostgreSQL) |
| Monorepo | pnpm workspaces |

## Project Structure

```
BattleCRM/
├── apps/
│   ├── frontend/          # React + Vite SPA
│   └── backend/           # Adonis.js REST API
├── packages/
│   └── shared/            # Shared types (post-MVP)
├── pnpm-workspace.yaml    # Workspace configuration
├── package.json           # Root scripts
└── .env                   # Environment variables
```

## Getting Started

### Prerequisites

- Node.js >= 20.6.0
- pnpm >= 8.0.0

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd BattleCRM

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
# Edit .env with your configuration
```

### Development

```bash
# Run all apps in development mode
pnpm dev

# Run specific commands
pnpm lint          # Lint all packages
pnpm format        # Format all packages
pnpm test          # Run all tests
pnpm type-check    # TypeScript type checking
pnpm build         # Build all packages
```

### Adding Dependencies

```bash
# Add to frontend
pnpm --filter @battlecrm/frontend add <package>

# Add to backend
pnpm --filter @battlecrm/backend add <package>

# Add to root (dev dependencies)
pnpm add -D -w <package>
```

## Environment Variables

See `.env.example` for all available environment variables with documentation.

Key variables:
- `APP_KEY` - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` - From your Supabase project settings
- `DATABASE_URL` - PostgreSQL connection string

## License

Private - All rights reserved.
