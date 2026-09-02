import { Router, type IRouter, type Request, type Response } from "express";
import {
  BanAdminAccountResponse,
  GetAdminChatResponse,
  GetAdminChatsResponse,
  GrantAdminBody,
  GrantAdminResponse,
  GetAdminAccountsResponse,
} from "@workspace/api-zod";
import {
  banAccount,
  getSessionAccount,
  listAccounts,
  setAccountAdmin,
  SESSION_COOKIE,
  type AdminAccount,
} from "../lib/auth-service";
import { getAdminChat, getAdminChats } from "../lib/chat-service";

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response) {
  const account = await getSessionAccount(req.cookies?.[SESSION_COOKIE]);
  if (!account) {
    res.status(401).json({ error: "Sign in to use the admin panel." });
    return null;
  }
  if (!account.isAdmin) {
    res.status(403).json({ error: "Administrator access is required." });
    return null;
  }
  return account;
}

function toAdminAccount(account: AdminAccount) {
  return {
    username: account.username,
    createdAt: account.createdAt,
    isAdmin: account.isAdmin,
    isBanned: account.isBanned,
  };
}

router.get("/admin/accounts", async (req, res, next) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const accounts = await listAccounts();
    res.json(GetAdminAccountsResponse.parse(accounts.map(toAdminAccount)));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/chats", async (req, res, next) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    res.json(GetAdminChatsResponse.parse(await getAdminChats()));
  } catch (error) {
    next(error);
  }
});

router.get("/admin/chats/:chatId", async (req, res, next) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const chat = await getAdminChat(req.params.chatId);
    if (!chat) {
      res.status(404).json({ error: "That AI conversation could not be found." });
      return;
    }
    res.json(GetAdminChatResponse.parse(chat));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/accounts/:username/ban", async (req, res, next) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const account = await banAccount(req.params.username);
    if (!account) {
      res.status(404).json({ error: "That account could not be found." });
      return;
    }
    res.json(BanAdminAccountResponse.parse(toAdminAccount(account)));
  } catch (error) {
    next(error);
  }
});

router.post("/admin/admins", async (req, res, next) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const input = GrantAdminBody.parse(req.body);
    const account = await setAccountAdmin(input.username);
    if (!account) {
      res.status(404).json({ error: "That account could not be found." });
      return;
    }
    res.json(GrantAdminResponse.parse(toAdminAccount(account)));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Enter a valid username." });
      return;
    }
    next(error);
  }
});

export default router;