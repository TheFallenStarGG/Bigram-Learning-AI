import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

router.get("/brain/overview", async (_req, res, next) => {
  try {
    res.json(GetBrainOverviewResponse.parse(await getOverview()));
  } catch (error) {
    next(error);
  }
});

router.get("/brain/messages", async (_req, res, next) => {
  try {
    res.json(GetBrainMessagesResponse.parse(await getMessages()));
  } catch (error) {
    next(error);
  }
});

router.post("/brain/chat", async (req, res, next) => {
  try {
    const input = SendBrainMessageBody.parse(req.body);
    res.json(SendBrainMessageResponse.parse(await sendMessage(input.message)));
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Please send a message between 1 and 2,000 characters." });
      return;
    }
    next(error);
  }
});

router.get("/brain/snapshots", async (_req, res, next) => {
  try {
    res.json(GetBrainSnapshotsResponse.parse(await getSnapshots()));
  } catch (error) {
    next(error);
  }
});

router.post("/brain/snapshots", async (_req, res, next) => {
  try {
    res.status(201).json(CreateBrainSnapshotResponse.parse(await createSnapshot()));
  } catch (error) {
    next(error);
  }
});

router.get("/brain/github", async (_req, res, next) => {
  try {
    res.json(GetBrainGithubResponse.parse(await getGithubSettings()));
  } catch (error) {
    next(error);
  }
});

router.put("/brain/github", async (req, res, next) => {
  try {
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