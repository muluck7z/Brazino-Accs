import { Router, type IRouter } from "express";
import { eq, count, gte, isNotNull, sql } from "drizzle-orm";
import { db, accountsTable } from "@workspace/db";
import {
  CreateAccountBody,
  UpdateAccountBody,
  GetAccountParams,
  UpdateAccountParams,
  DeleteAccountParams,
  ListAccountsResponse,
  GetAccountResponse,
  CreateAccountResponse,
  UpdateAccountResponse,
  GetAccountStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/accounts", async (req, res): Promise<void> => {
  const accounts = await db
    .select()
    .from(accountsTable)
    .orderBy(sql`${accountsTable.createdAt} DESC`);
  res.json(ListAccountsResponse.parse(accounts));
});

router.post("/accounts", async (req, res): Promise<void> => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [account] = await db
    .insert(accountsTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(CreateAccountResponse.parse(account));
});

router.get("/accounts/stats", async (_req, res): Promise<void> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [totalRow] = await db.select({ count: count() }).from(accountsTable);
  const [withEmailRow] = await db
    .select({ count: count() })
    .from(accountsTable)
    .where(isNotNull(accountsTable.email));
  const [withAuthRow] = await db
    .select({ count: count() })
    .from(accountsTable)
    .where(isNotNull(accountsTable.authenticator));
  const [withPassRow] = await db
    .select({ count: count() })
    .from(accountsTable)
    .where(isNotNull(accountsTable.password));
  const [recentRow] = await db
    .select({ count: count() })
    .from(accountsTable)
    .where(gte(accountsTable.createdAt, thirtyDaysAgo));

  res.json(
    GetAccountStatsResponse.parse({
      total: totalRow?.count ?? 0,
      withEmail: withEmailRow?.count ?? 0,
      withAuthenticator: withAuthRow?.count ?? 0,
      withPassword: withPassRow?.count ?? 0,
      recent: recentRow?.count ?? 0,
    })
  );
});

router.get("/accounts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetAccountParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.id, params.data.id));

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  res.json(GetAccountResponse.parse(account));
});

router.patch("/accounts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateAccountParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [account] = await db
    .update(accountsTable)
    .set(parsed.data)
    .where(eq(accountsTable.id, params.data.id))
    .returning();

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  res.json(UpdateAccountResponse.parse(account));
});

router.delete("/accounts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteAccountParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [account] = await db
    .delete(accountsTable)
    .where(eq(accountsTable.id, params.data.id))
    .returning();

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
