# EcoFoodStock

Application web responsive mobile-first pour gerer un stock alimentaire domestique, suivre les DLC, preparer une liste de courses simple et conserver un historique detaille.

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase / PostgreSQL

## MVP 1

Inclus :

- authentification ;
- onboarding ;
- inventaire ;
- scan Open Food Facts ;
- ajout manuel ;
- DLC ;
- quantites simples ;
- courses simples ;
- historique ;
- parametres de base.

Repousse :

- recettes ;
- notifications ;
- sante avancee ;
- suggestions avancees ;
- exports/RGPD complets.

## Lancement local

```bash
npm install
npm run dev
```

Puis ouvrir :

```text
http://localhost:3000
```

## Donnees et API

- Supabase est prepare via les clients dans `src/lib/supabase/`.
- Renseigner les variables dans `.env.local` a partir de `.env.example`.
- Le lookup code-barres passe par `GET /api/products/lookup/[barcode]`.
- Cette route interroge Open Food Facts, API gratuite de reference pour les produits alimentaires.

Variables attendues :

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

OAuth setup:

- Configure Google / Apple providers in the Supabase dashboard.
- Add the redirect URIs used by your app (e.g. `http://localhost:3000` for local dev and `https://your-domain.com` for production).
- Ensure the Supabase project's authentication settings allow the selected providers.


## Documents de cadrage

- `architecture-ecofoodstock.md`
- `cadrage-mvp-ecofoodstock.md`
- `revue-captures-ecrans-ecofoodstock.md`
- `schema-bdd-ecofoodstock.sql`

