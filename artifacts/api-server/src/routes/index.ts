import { Router, type IRouter } from "express";
import healthRouter from "./health";
import brainRouter from "./brain";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(brainRouter);
router.use(authRouter);

export default router;
