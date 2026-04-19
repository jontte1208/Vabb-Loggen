# Vab-loggen

Mobiloptimerad React-app för svenska småbarnsföräldrar att logga VAB-dagar (vård av barn) och generera sammanställningar för Försäkringskassan.

## Kom igång

```bash
npm install
npm run dev
```

Öppna `http://localhost:5173`.

## Lagring

Appen är offline-first.

- **Utan konfiguration:** all data läses/skrivs till `localStorage`. Fungerar helt utan internet.
- **Med Supabase:** om `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` finns i `.env`, synkas data även till Supabase.

## Aktivera Supabase (valfritt)

1. Skapa ett projekt på [supabase.com](https://supabase.com).
2. Kör `supabase/schema.sql` i SQL-editorn.
3. Kopiera `.env.example` till `.env` och fyll i:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=ey...
   ```
4. Starta om dev-servern.

## Mappstruktur

```
vab-loggen/
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── supabase/
│   └── schema.sql
└── src/
    ├── main.jsx
    ├── index.css
    ├── App.jsx
    └── lib/
        ├── supabase.js
        ├── storage.js
        └── constants.js
```

## Funktioner

- ✅ Registrera VAB-dagar (barn, omfattning, anledning)
- ✅ Hem-översikt med statistik per barn
- ✅ Kalendervy (3 senaste månaderna)
- ✅ Sammanställning för Försäkringskassan
- ✅ Offline-läge via localStorage
- ✅ Supabase-sync (opt-in)
- ⏳ PDF-export
- ⏳ Skicka till Mina sidor
- ⏳ Redigera/ta bort poster
- ⏳ Flera användare / autentisering
