# Feedback Hub DBMS Project

Course Feedback and Faculty Evaluation System built with PostgreSQL, Express, and plain HTML/CSS/JS.

## Files

- `schema.sql` creates the PostgreSQL schema, constraints, indexes, and triggers.
- `seed.sql` loads demo data that matches the current UI.
- `server.js` exposes the Express API and serves the UI.
- `data.js` connects the existing UI to the API, with local demo fallback data.

## Database Setup

Create a PostgreSQL database named `feedback_hub`:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -d postgres -c "CREATE DATABASE feedback_hub;"
```

Then create the tables and load seed data:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -d feedback_hub -f schema.sql
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -d feedback_hub -f seed.sql
```

If `psql` is on your `PATH`, these shorter commands also work:

```powershell
psql -U postgres -d feedback_hub -f schema.sql
psql -U postgres -d feedback_hub -f seed.sql
```

## Add PostgreSQL To PATH

For the current PowerShell window only:

```powershell
$env:Path += ';C:\Program Files\PostgreSQL\18\bin'
```

Permanently for your Windows user account:

```powershell
[Environment]::SetEnvironmentVariable(
  'Path',
  [Environment]::GetEnvironmentVariable('Path', 'User') + ';C:\Program Files\PostgreSQL\18\bin',
  'User'
)
```

Close and reopen PowerShell, then check:

```powershell
psql --version
```

## Backend Setup

Copy `.env.example` to `.env` and update the database password:

```powershell
copy .env.example .env
```

Install dependencies and start the server:

```powershell
npm install
npm start
```

Open:

```text
http://localhost:3000
```

Demo accounts after seeding:

- Student: `AM.SC.U4CSE25018` / `Aditya Sahu`
- Admin: `admin@amrita.edu` / `admin123`

## SQL Reports And Tests

Useful report queries:

```powershell
psql -U postgres -d feedback_hub -f reports.sql
```

Constraint validation tests:

```powershell
psql -U postgres -d feedback_hub -f test_cases.sql
```
