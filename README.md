# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## API configuration

The frontend uses `VITE_API_BASE_URL` as the Laravel API base URL. Set it to the deployed Laravel URL, including Laravel's `/api` prefix:

```text
VITE_API_BASE_URL=https://ordercafe-ncw5.onrender.com/api
```

Admin and Mini App request paths are relative to this URL and must not include another `/api` prefix.

For the Render Static Site, set `VITE_API_BASE_URL` under Environment, use `npm install && npm run build` as the build command, and `dist` as the publish directory. Trigger a new deploy after setting the variable so Vite includes it in the built assets. `VITE_` variables are public; never put passwords, database credentials, Telegram bot tokens, or other secrets in them.

Admin requests send the token returned by the login endpoint as a bearer token. Requests made inside Telegram also send Telegram's `initData` in `X-Telegram-Init-Data`. If the browser reports a CORS error, configure Laravel to allow the deployed frontend origin and the `Authorization` and `X-Telegram-Init-Data` headers; frontend code cannot override the backend's CORS policy.

For local development, configure `VITE_API_BASE_URL` in `.env`, run `npm run dev`, and use `npm run build` and `npm run lint` to validate changes.

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
