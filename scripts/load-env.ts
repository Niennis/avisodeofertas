import { config } from "dotenv";

// Igual que Next.js: `.env.local` tiene prioridad sobre `.env`.
config({ path: [".env.local", ".env"], quiet: true });
