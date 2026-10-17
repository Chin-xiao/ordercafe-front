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
| `GET` | `/mini-app/categories`, `/mini-app/products` | Load the menu and top-level `sugar_percent_options` |
| `POST` | `/mini-app/orders` | Submit `order_session_id`, product IDs, quantities, `sugar_percent`, and optional note |
| `GET` | `/mini-app/my-order` | Refresh the customer's saved order |
| `GET` | `/admin/reports/daily-orders` | Resolve today's default date and business timezone |
| `GET` | `/admin/orders` | Load paginated order details and filtered summary metrics |
| `GET` | `/admin/reports/products` | Load top-selling products for a date range |

The order total shown before checkout is an estimate. Laravel must recalculate prices from stored product records and reject orders after closure or expiration. Session refresh and the local countdown improve the UI but are not substitutes for server-side deadline enforcement.

The Mini App requires a customer to choose a sugar percentage from the values returned as `sugar_percent_options`; it does not assume a default. Each saved order item carries its own `sugar_percent`, allowing the same product to appear in separate lines for different sugar levels. The checkout sends only product IDs, quantities, and sugar percentages; Laravel owns prices, Telegram customer identity, session validity, and the saved total.

The Admin daily report reads today's date and the configured business timezone from `/admin/reports/daily-orders`, then requests detailed orders and independently aggregated summary metrics from `/admin/orders`. That route accepts inclusive `date_from` / `date_to` dates, customer `search`, `order_session_id`, `status`, `page`, and `per_page`. Order items contain their saved `product_name`, `sugar_percent`, `unit_price`, `quantity`, and `subtotal`; summary totals are computed from filtered orders without multiplying order totals by item joins.

The frontend reports Telegram delivery as confirmed only when the start/close response contains an explicit delivery boolean or a recognized delivery status. A successful HTTP response alone is not treated as proof that Telegram delivered a message.

The Laravel backend source is maintained separately from this frontend repository. The session list is the source for confirming the refreshed `OPEN` / `CLOSED` status. Telegram delivery feedback is shown only when a delivery status is explicitly present in the start/close response. The current-session response includes `id`, `title`, `status`, and `expires_at`; the frontend checks its ID against the signed launch parameter and submits to the existing order endpoint. The backend generates the Telegram message/button and owns delivery status. The frontend does not call Telegram's Bot API.

For group announcements, configure the bot's **Main Mini App** in Telegram before using the direct link button. The backend-owned announcement should use Telegram's Main Mini App direct-link format `https://t.me/<bot_username>?startapp=order_<session_id>` as an URL button. Do not substitute a regular web URL button: the configured Mini App must open as a Telegram Mini App. The bot username and Telegram configuration are intentionally not guessed or stored in frontend code. See [Telegram Mini App direct links](https://core.telegram.org/bots/webapps#direct-links).

The Laravel backend checks Telegram `getMe` before sending a Main Mini App announcement: the configured link username must match the actual bot, and Telegram must report `has_main_web_app: true`. If that check fails, it records announcement delivery as failed instead of posting a button that Telegram Desktop or mobile cannot open. Configure the Main Mini App in BotFather, then verify the admin start response reports successful announcement delivery.

The Mini App reads `Telegram.WebApp.initDataUnsafe.start_param` and accepts only the `order_<positive-safe-integer>` form. The signed `initData` is sent in `X-Telegram-Init-Data`; Laravel verifies its signature and resolves the session ID from the signed `start_param` on the existing `GET /mini-app/order-session/current` endpoint. That endpoint returns the session in the existing `data` response envelope, including `id`, `title`, `status`, `expires_at`, and boolean `ordering_allowed` (`can_order` remains as a backwards-compatible alias). React rejects a response whose session ID does not match the launch parameter and blocks checkout when `ordering_allowed` is false. Laravel enforces session state and expiration again when accepting an order. The launch parameter is a session selector, not authentication. If there is no Telegram `start_param`, the existing current-session behavior is retained for compatibility.

The frontend does not configure the bot or call Telegram's Bot API. Laravel owns link construction, bot identity/configuration checks, and announcement delivery. Deploy the backend contract and configure the Main Mini App in BotFather before testing the complete flow; no Bot API request or token is added to React.

Existing sales reports accept `date_from` and `date_to` as `YYYY-MM-DD`. Telegram customer requests use the Laravel `BUSINESS_TIMEZONE`; date boundaries are inclusive calendar days, and an omitted range defaults to today in that timezone.

### Telegram customer management

The page uses these authenticated Laravel routes:

| Method | API path | Purpose |
| --- | --- | --- |
| `GET` | `/admin/customers` | Server-filtered and paginated customers, including order count, latest order, and spending for the selected range |
| `GET` | `/admin/customers/{customer}/orders` | Filtered, paginated order history with saved item name, unit price, quantity, subtotal, session, status, and order total |
| `POST` | `/admin/customers/{customer}/messages` | Send a private Telegram message through Laravel; the UI reports success only when `delivered: true` and message status is `sent` |
| `DELETE` | `/admin/customers/{customer}` | Deactivate a customer while preserving order history |

The customer list supports `date_from`, `date_to`, `search`, `page`, and `per_page`. Order history additionally supports `order_session_id` and `status`. Laravel applies search, date filtering, aggregation, and pagination; the browser does not download all orders to build customer totals. Missing usernames are displayed as “No username”. The actual Laravel customer list and order-history responses include the backend-confirmed `private_chat_activated` flag; the Admin UI does not infer activation from a Telegram ID or username. The Admin message endpoint requires an `Idempotency-Key` header and only reports success when it returns `delivered: true` and `data.status: "sent"`. For private messages, the bot token remains server-side; a customer must voluntarily open [@ahseven_bot](https://t.me/ahseven_bot) and press **Start** before the bot can initiate a private conversation. This is not required to browse or order in the Mini App. Deactivation is not a permanent deletion.

The group **Order Now** button is a Telegram Mini App direct link with the signed session selector (`startapp=order_<session_id>`). Laravel validates the Mini App's raw `initData` and owns customer identity; the frontend does not submit a Telegram user ID or make a separate registration request. The Admin message modal only opens the bot link when the admin clicks **Open Bot Link** and reports success only when Laravel confirms Telegram accepted the message.

The current Laravel routes do not expose the signed Mini App customer's profile or private-chat activation status: `/mini-app/order-session/current` returns session data and `/mini-app/my-order` returns order data only. The Mini App therefore displays **Unable to Check** and an optional bot link without claiming activation or preventing ordering. To hide the prompt for activated customers and refresh status after returning from the bot, backend work is still required to include a verified customer activation status in an existing Mini App response or provide a documented authenticated Mini App profile/status route. Do not treat `initDataUnsafe.user` or the order/session response as proof of activation.

The API contract and response examples are documented in the backend repository's `docs/customer-management-api.md`.

The Mini App menu consumes the backend's `is_available` product flag and sugar-option list. Quantity is capped at the API's 100-item limit for each product/sugar combination. The checkout confirmation uses the saved order's item snapshots and server-calculated `total_amount`; a later empty `/mini-app/my-order` refresh does not clear the checkout confirmation.

## Frontend loading and performance

Admin pages and secondary customer pages are loaded on demand so the Mini App does not download every route's code at launch. The Mini App shell and menu skeleton render while menu data loads; categories and products share an in-memory 15-second cache and concurrent requests. Obsolete menu requests are canceled when no active consumers remain, and session requests are canceled when the page unmounts. Telegram `initData`, session status, and order results are not cached by this menu helper. Product images reserve their card dimensions, load lazily except for the first two visible products, and use a lightweight placeholder. The one-second session countdown is isolated from menu filtering and cart calculations.

Use `npm run build` to compare the entry and route chunks after frontend changes. Bundle sizes alone do not measure API latency or image-host performance; verify the live deployment with its configured Laravel CORS and product image URLs as well.

## Telegram Mini App and Render

The official Telegram Web App SDK is loaded by `index.html` and initialized with `ready()` / `expand()`. `/menu` is a public React route for Mini App launches. `public/_redirects` provides the SPA fallback needed for direct navigation to `/menu` on a Render Static Site.

For deployment:

1. Set `VITE_API_BASE_URL` in the Render frontend service's Environment settings.
2. Use `npm install && npm run build` for the build command and `dist` for the publish directory.
3. Deploy the frontend and configure Laravel CORS for its production origin.
4. Configure the bot's Main Mini App URL to the deployed frontend (the root route or `/menu`), then have Laravel post the group URL button `https://t.me/<bot_username>?startapp=order_<session_id>`. Keep bot credentials on the backend and verify the Main Mini App is configured before posting announcements.
5. Redeploy after changing a `VITE_` value; Vite embeds it in the built frontend.

For local development, set `VITE_API_BASE_URL` in `.env` and run `npm run dev`. `npm run lint` and `npm run build` validate the frontend only; neither proves that Laravel routes, Telegram delivery, or production CORS are working.

## Integration test checklist

Use the deployed frontend and Laravel backend to verify each end-to-end behavior:

1. Create a session with a future expiration, then start it from Admin.
2. Confirm Laravel returned success and inspect its explicit Telegram delivery status and the group button.
3. Open the group button and verify it loads the correct session title and deadline.
4. Add the same drink at two sugar levels; confirm checkout keeps separate lines and the confirmation shows each saved sugar percentage and server-calculated total.
5. In Admin reports, confirm today's default uses the business timezone, date boundaries are inclusive, search/session/status filters and pagination work, and each order is separate.
6. Wait for expiration and verify the UI disables checkout; separately confirm Laravel rejects a late order.
7. End an open session in Admin and verify refreshed `CLOSED` status and close time.
8. Verify the final Telegram report uses the same saved sugar selections and order totals as the Admin report.
