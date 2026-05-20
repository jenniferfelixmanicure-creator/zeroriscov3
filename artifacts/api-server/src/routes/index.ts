import { Router, type IRouter } from "express";
import path from "path";
import express from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import categoriesRouter from "./categories";
import ridesRouter from "./rides";
import driversRouter from "./drivers";
import ratingsRouter from "./ratings";
import walletRouter from "./wallet";
import messagesRouter from "./messages";
import notificationsRouter from "./notifications";
import adminRouter from "./admin";

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
router.use("/admin/uploads", express.static(UPLOADS_DIR));

router.use(healthRouter);
router.use(authRouter);
router.use(categoriesRouter);
router.use(ridesRouter);
router.use(driversRouter);
router.use(ratingsRouter);
router.use(walletRouter);
router.use(messagesRouter);
router.use(notificationsRouter);
router.use(adminRouter);

export default router;
