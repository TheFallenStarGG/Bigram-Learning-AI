import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateChatBody,
  CreateChatResponse,
  GetChatResponse,
  GetChatsResponse,
  RenameChatBody,
  RenameChatResponse,
  SendChatMessageBody,
  SendChatMessageResponse,
} from "@workspace/api-zod";
import {
  ChatInputError,
  ChatNotFoundError,
  ChatParticipantNotFoundError,
  ChatPermissionError,
  createChat,
  getChat,
  getChats,
  renameChat,
  sendChatMessage,
} from "../lib/chat-service";
import { getSessionAccount, SESSION_COOKIE } from "../lib/auth-service";

const router: IRouter = Router();

async function requireUsername(req: Request, res: Response) {
  const account = await getSessionAccount(req.cookies?.[SESSION_COOKIE]);
  if (!account) {
    res.status(401).json({ error: "Sign in to use private chats." });
    return null;
  }
  return account.username;
}

function handleChatError(error: unknown, res: Response) {
  if (error instanceof Error && error.name === "ZodError") {
    res.status(400).json({ error: "Please check the chat details and try again." });
    return true;
  }
  if (error instanceof ChatInputError) {
    res.status(400).json({ error: error.message });
    return true;
  }
  if (error instanceof ChatParticipantNotFoundError) {
    res.status(404).json({ error: error.message });
    return true;
  }
  if (error instanceof ChatNotFoundError) {
    res.status(404).json({ error: error.message });
    return true;
  }
  if (error instanceof ChatPermissionError) {
    res.status(403).json({ error: error.message });
    return true;
  }
  return false;
}

router.get("/chats", async (req, res, next) => {
  try {
    const username = await requireUsername(req, res);
    if (!username) return;
    res.json(GetChatsResponse.parse(await getChats(username)));
  } catch (error) {
    if (!handleChatError(error, res)) next(error);
  }
});

router.post("/chats", async (req, res, next) => {
  try {
    const username = await requireUsername(req, res);
    if (!username) return;
    const input = CreateChatBody.parse(req.body);
    res.status(201).json(CreateChatResponse.parse(await createChat(username, input)));
  } catch (error) {
    if (!handleChatError(error, res)) next(error);
  }
});

router.get("/chats/:chatId", async (req, res, next) => {
  try {
    const username = await requireUsername(req, res);
    if (!username) return;
    res.json(GetChatResponse.parse(await getChat(username, req.params.chatId)));
  } catch (error) {
    if (!handleChatError(error, res)) next(error);
  }
});

router.patch("/chats/:chatId", async (req, res, next) => {
  try {
    const username = await requireUsername(req, res);
    if (!username) return;
    const input = RenameChatBody.parse(req.body);
    res.json(
      RenameChatResponse.parse(
        await renameChat(username, req.params.chatId, input.title),
      ),
    );
  } catch (error) {
    if (!handleChatError(error, res)) next(error);
  }
});

router.post("/chats/:chatId/messages", async (req, res, next) => {
  try {
    const username = await requireUsername(req, res);
    if (!username) return;
    const input = SendChatMessageBody.parse(req.body);
    res.json(
      SendChatMessageResponse.parse(
        await sendChatMessage(username, req.params.chatId, input.content),
      ),
    );
  } catch (error) {
    if (!handleChatError(error, res)) next(error);
  }
});

export default router;