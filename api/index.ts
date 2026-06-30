import express from "express";
import cors from "cors";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { eq, count, gte, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import pg from "pg";

// ── Schema (inline, sem @workspace/db) ──────────────────────
const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  password: text("password"),
  email: text("email"),
  authenticator: text("authenticator"),
  avatarUrl: text("avatar_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Zod schemas (inline, sem @workspace/api-zod) ──────────────
const AccountSchema = z.object({
  id: z.number(),
  username: z.string(),
  password: z.string().nullable(),
  email: z.string().nullable(),
  authenticator: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const CreateAccountBody = z.object({
  username: z.string().min(1),
  password: z.string().optional(),
  email: z.string().optional(),
  authenticator: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

const UpdateAccountBody = CreateAccountBody.partial();

// ── DB connection ─────────────────────────────────────────────
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// ── Express app ───────────────────────────────────────────────
const app = express();

app.use(cors({ origin: "*", methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "X-API-Key"] }));
app.use(express.json());

// Optional API key auth
app.use("/api", (req, res, next) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return next();
  if (req.method === "GET" && req.path.startsWith("/accounts")) return next();
  const provided = req.headers["x-api-key"];
  if (provided !== apiKey) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// ── Routes ────────────────────────────────────────────────────
app.get("/api/accounts/stats", async (_req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const [totalRow] = await db.select({ count: count() }).from(accountsTable);
    const [withEmailRow] = await db.select({ count: count() }).from(accountsTable).where(isNotNull(accountsTable.email));
    const [withAuthRow]  = await db.select({ count: count() }).from(accountsTable).where(isNotNull(accountsTable.authenticator));
    const [withPassRow]  = await db.select({ count: count() }).from(accountsTable).where(isNotNull(accountsTable.password));
    const [recentRow]   = await db.select({ count: count() }).from(accountsTable).where(gte(accountsTable.createdAt, thirtyDaysAgo));
    res.json({ total: totalRow?.count ?? 0, withEmail: withEmailRow?.count ?? 0, withAuthenticator: withAuthRow?.count ?? 0, withPassword: withPassRow?.count ?? 0, recent: recentRow?.count ?? 0 });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get("/api/accounts", async (_req, res) => {
  try {
    const accounts = await db.select().from(accountsTable).orderBy(sql`${accountsTable.createdAt} DESC`);
    res.json(z.array(AccountSchema).parse(accounts));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.post("/api/accounts", async (req, res) => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [account] = await db.insert(accountsTable).values(parsed.data).returning();
    res.status(201).json(AccountSchema.parse(account));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get("/api/accounts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }
    res.json(AccountSchema.parse(account));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.patch("/api/accounts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [account] = await db.update(accountsTable).set(parsed.data).where(eq(accountsTable.id, id)).returning();
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }
    res.json(AccountSchema.parse(account));
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.delete("/api/accounts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [account] = await db.delete(accountsTable).where(eq(accountsTable.id, id)).returning();
    if (!account) { res.status(404).json({ error: "Account not found" }); return; }
    res.sendStatus(204);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

app.get("/api/healthz", (_req, res) => res.json({ ok: true }));

export default app;
