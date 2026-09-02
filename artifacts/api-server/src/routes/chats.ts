import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateChatBody,
  CreateChatResponse,
  GetChatResponse,
  GetChatsResponse,
  SendChatMessageBody,
  SendChatMessageResponse,
} from "@workspace/api-zod";
import {
  ChatInputError,
  ChatNotFoundError,
  ChatParticipantNotFoundError,
  createChat,
  getChat,
  getChats,
  sendChatMessage,
} from "../lib/chat-service";
import { readSessionCookie } from "../lib/auth-service";

const router: IRouter = Router();

function requireUsername(req: Request, res: Response) {
  const username = readSessionCookie(req.cookies?.bigram_session);
  if (!username) {
    res.status(401).json({ error: "Sign in to use private chats." });
    return null;
  }
  return username;
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
  return false;
}

router.get("/chats", async (req, res, next) => {
  try {
    const username = requireUsername(req, res);
    if (!username) return;
    res.json(GetChatsResponse.parse(await getChats(username)));
  } catch (error) {
    if (!handleChatError(error, res)) next(error);
  }
});

router.post("/chats", async (req, res, next) => {
  try {
    const username = requireUsername(req, res);
    if (!username) return;
    const input = CreateChatBody.parse(req.body);
    res.status(201).json(CreateChatResponse.parse(await createChat(username, input)));
  } catch (error) {
    if (!handleChatError(error, res)) next(error);
  }
});

router.get("/chats/:chatId", async (req, res, next) => {
  try {
    const username = requireUsername(req, res);
    if (!username) return;
    res.json(GetChatResponse.parse(await getChat(username, req.params.chatId)));
  } catch (error) {
    if (!handleChatError(error, res)) next(error);
  }
});

router.post("/chats/:chatId/messages", async (req, res, next) => {
  try {
    const username = requireUsername(req, res);
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