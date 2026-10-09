# Cafe Ordering Frontend

React/Vite frontend for the cafe admin and Telegram Mini App. The Laravel API remains the source of truth for session state, Telegram verification, accepted orders, and final prices.

## Frontend environment

Configure this public build-time variable for local development and the Render Static Site:

```text
VITE_API_BASE_URL=https://your-laravel-api.example.com/api
```

Include the Laravel `/api` prefix. Frontend endpoint paths are relative to this base URL. In production, the app fails to build if this value is missing. Do not add Telegram bot tokens, database credentials, passwords, or other secrets to `VITE_` variables.

Admin requests use the bearer token saved by the existing login flow (`admin_token` or `token`). Requests from Telegram include the Web App `initData` in `X-Telegram-Init-Data`; Laravel must validate that signed value and must not trust a user ID supplied by the browser. Configure Laravel CORS to allow the deployed frontend origin and the `Authorization` and `X-Telegram-Init-Data` headers.

## Existing frontend API contract

The UI uses the routes already present in this project:

| Method | API path | Purpose |
| --- | --- | --- |
| `GET` | `/admin/order-sessions` | List sessions and refresh admin status |
| `POST` | `/admin/order-sessions` | Create a draft with `title` and `expires_at` (ISO timestamp) |
| `POST` | `/admin/order-sessions/{id}/start` | Start the session; Telegram announcement is backend-owned |
| `POST` | `/admin/order-sessions/{id}/close` | End ordering and request the backend report |
| `GET` | `/mini-app/order-session/current` | Load and revalidate the current backend session |
| `GET` | `/mini-app/categories`, `/mini-app/products` | Load the menu |
| `POST` | `/mini-app/orders` | Submit `order_session_id`, product IDs, quantities, and optional note |
| `GET` | `/mini-app/my-order` | Refresh the customer's saved order |

The order total shown before checkout is an estimate. Laravel must recalculate prices from stored product records and reject orders after closure or expiration. Session refresh and the local countdown improve the UI but are not substitutes for server-side deadline enforcement.

The frontend reports Telegram delivery as confirmed only when the start/close response contains an explicit delivery boolean or a recognized delivery status. A successful HTTP response alone is not treated as proof that Telegram delivered a message.

**Backend integration still needs verification:** this repository contains only the frontend, not the Laravel route definitions or controllers. The session list is the source for confirming the refreshed `OPEN` / `CLOSED` status. Telegram delivery feedback is shown only when a delivery status is explicitly present in the start/close response; the exact delivery response field is not specified here. The current-session response must include `id`, `title`, `status`, and `expires_at`, and the order endpoint must accept `order_session_id` as sent here. The Telegram launch button should open the deployed frontend at `/menu`; the existing current-session API must then return the session being announced. The backend must generate the Telegram message/button and report delivery status. The frontend does not call Telegram's Bot API.

### Missing backend contract for Admin order management

There is no Admin orders endpoint in the frontend's existing route usage. The only Admin report endpoints return aggregate sales/product reports, not paginated order records. Therefore, no order/customer management screen has been wired to a guessed URL or populated with fabricated data. To implement the requested Admin order table, filtering, details, and per-session summary, provide the real Laravel route/method and response schema for:

- Paginated Admin orders, including supported search/filter parameters and pagination metadata.
- Customer identity fields from verified Telegram data (display name, username, numeric Telegram user ID), order number/time/status, session ID/name, saved total, and item/product details including image and unit price.
- Session-filter options and the per-session aggregate counts (unique customers, orders, item quantity, sales).
- Any Admin order detail route and whether the list embeds the full item details.

The frontend likewise cannot confirm the Mini App product availability flag, quantity maximum, or exact saved-order/Telegram delivery response fields without the Laravel response schema. Current behavior uses `is_available` when present, keeps a positive cart quantity, displays the saved order response when returned, and falls back to the existing `/mini-app/my-order` refresh.

## Telegram Mini App and Render

The official Telegram Web App SDK is loaded by `index.html` and initialized with `ready()` / `expand()`. `/menu` is a public React route for Mini App launches. `public/_redirects` provides the SPA fallback needed for direct navigation to `/menu` on a Render Static Site.

For deployment:

1. Set `VITE_API_BASE_URL` in the Render frontend service's Environment settings.
2. Use `npm install && npm run build` for the build command and `dist` for the publish directory.
3. Deploy the frontend and configure Laravel CORS for its production origin.
4. Configure the existing backend/bot Mini App button to open the deployed frontend URL ending in `/menu`. Verify the same domain is configured for the existing Telegram Mini App; keep bot credentials on the backend.
5. Redeploy after changing a `VITE_` value; Vite embeds it in the built frontend.

For local development, set `VITE_API_BASE_URL` in `.env` and run `npm run dev`. `npm run lint` and `npm run build` validate the frontend only; neither proves that Laravel routes, Telegram delivery, or production CORS are working.

## Integration test checklist

Use the deployed frontend and Laravel backend to verify each end-to-end behavior:

1. Create a session with a future expiration, then start it from Admin.
2. Confirm Laravel returned success and inspect its explicit Telegram delivery status and the group button.
3. Open the group button and verify it loads the correct session title and deadline.
4. Add multiple products, change quantities, and submit; verify the saved order returned by Laravel and server-calculated total.
5. Wait for expiration and verify the UI disables checkout; separately confirm Laravel rejects a late order.
6. End an open session in Admin and verify refreshed `CLOSED` status and close time.
7. Verify the final report appears from backend data and check explicit Telegram report delivery status in the response/group.
