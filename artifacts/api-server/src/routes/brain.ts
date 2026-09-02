import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateBrainSnapshotResponse,
  GetBrainGithubResponse,
  GetBrainMessagesResponse,
  GetBrainOverviewResponse,
  GetBrainSnapshotsResponse,
  SendBrainMessageBody,
  SendBrainMessageResponse,
  UpdateBrainGithubBody,
  UpdateBrainGithubResponse,
} from "@workspace/api-zod";
import {
  createSnapshot,
  getGithubSettings,
  getMessages,
  getOverview,
  getSnapshots,
  sendMessage,
  updateGithubSettings,
} from "../lib/brain-service";
import { getSessionAccount, SESSION_COOKIE } from "../lib/auth-service";

const router: IRouter = Router();

async function requireUsername(req: Request, res: Response) {
  const account = await getSessionAccount(req.cookies?.[SESSION_COOKIE]);
  if (!account) {
    res.status(401).json({ error: "Sign in to use the conversation." });
    return null;
  }
  return account.username;
}

router.get("/brain/overview", async (req, res, next) => {
  try {
    if (!(await requireUsername(req, res))) return;
    res.json(GetBrainOverviewResponse.parse(await getOverview()));
  } catch (error) {
    next(error);
  }
});

router.get("/brain/messages", async (_req, res, next) => {
  try {
    const username = await requireUsername(_req, res);
    if (!username) return;
    res.json(GetBrainMessagesResponse.parse(await getMessages(username)));
  } catch (error) {
    next(error);
  }
});

router.post("/brain/chat", async (req, res, next) => {
  try {
    const username = await requireUsername(req, res);
    if (!username) return;
    const input = SendBrainMessageBody.parse(req.body);
    res.json(SendBrainMessageResponse.parse(await sendMessage(username, input.message)));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Please send a message between 1 and 2,000 characters." });
      return;
    }
    next(error);
  }
});

router.get("/brain/snapshots", async (req, res, next) => {
  try {
    if (!(await requireUsername(req, res))) return;
    res.json(GetBrainSnapshotsResponse.parse(await getSnapshots()));
  } catch (error) {
    next(error);
  }
});

router.post("/brain/snapshots", async (req, res, next) => {
  try {
    if (!(await requireUsername(req, res))) return;
    res.status(201).json(CreateBrainSnapshotResponse.parse(await createSnapshot()));
  } catch (error) {
    next(error);
  }
});

router.get("/brain/github", async (req, res, next) => {
  try {
    if (!(await requireUsername(req, res))) return;
    res.json(GetBrainGithubResponse.parse(await getGithubSettings()));
  } catch (error) {
    next(error);
  }
});

router.put("/brain/github", async (req, res, next) => {
  try {
    if (!(await requireUsername(req, res))) return;
    const input = UpdateBrainGithubBody.parse(req.body);
    res.json(UpdateBrainGithubResponse.parse(await updateGithubSettings(input)));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Please provide a repository owner and name." });
      return;
    }
    next(error);
  }
});

export default router;