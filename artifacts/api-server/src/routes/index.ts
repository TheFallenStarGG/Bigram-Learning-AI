import { Router, type IRouter } from "express";
import healthRouter from "./health";
import brainRouter from "./brain";
import authRouter from "./auth";
import chatRouter from "./chats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(brainRouter);
router.use(authRouter);
router.use(chatRouter);

export default router;
