# Incredible India Travel

React 19 + Vite + TypeScript + Tailwind v4 + React Router 7 + Axios.

## Scripts

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build
npm run lint
```

## Environment (`.env`)

| Variable                   | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `VITE_API_URL`             | Backend base URL (falls back to the hosted API)                |
| `VITE_GOOGLE_CLIENT_ID`    | Google Sign-In client id                                       |
| `VITE_GOOGLE_MAPS_API_KEY` | Optional - without it maps fall back to a plain Google Maps link |

All env access goes through `src/config/env.ts`.

## Folder structure

```
src/
├── app/
│   ├── router/app.routes.tsx     # route table (layouts + lazy pages)
│   ├── providers/AppProviders.tsx# Google OAuth + Auth + Toast providers
│   └── store/                    # global client state (empty for now)
├── features/                     # one folder per domain
│   └── <feature>/{api,components,hooks,pages,types}   (auth also has validation/)
│       auth · destinations · hotels · packages · bookings · wishlist
│       reviews · payments · profile · admin · site (home, about, contact, faq, blog, 404)
├── components/
│   ├── ui/                       # shadcn primitives
│   ├── common/                   # shared widgets (pagination, search, map, toast ...)
│   ├── layout/                   # header, footer
│   └── cards/                    # destination / hotel / package cards
├── layouts/                      # PublicLayout · AuthLayout · UserLayout · AdminLayout
├── lib/                          # axios.ts (http client) · storage.ts · utils.ts
├── hooks/                        # shared hooks (useToast)
├── types/                        # shared types (CloudImage, PaginatedResponse)
├── constants/                    # static data + storage keys
├── config/env.ts
├── assets/{images,icons,logos}
├── App.tsx                       # root route element (providers + ScrollToTop)
├── main.tsx                      # entry: <RouterProvider router={router} />
└── index.css
```

### Conventions

- **Layouts own the chrome.** Pages never render `<Header />` / `<Footer />` - `PublicLayout`, `AuthLayout`
  and `UserLayout` do. `UserLayout` also enforces login; `AdminLayout` enforces the admin role.
- **API calls** live in `features/<feature>/api/*.api.ts` and go through `lib/axios.ts`
  (adds the JWT, throws `ApiError` on HTTP errors).
- **Types** are owned by the feature that defines them; only truly shared ones live in `src/types`.
- Import with the `@/` alias (`@/features/hotels/api/hotel.api`), never relative `../..` paths.
