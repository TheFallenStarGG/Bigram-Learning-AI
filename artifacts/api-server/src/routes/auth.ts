import { Router, type IRouter, type Response } from "express";
import {
  GetAuthSessionResponse,
  LoginBody,
  SignupBody,
} from "@workspace/api-zod";
import {
  authenticateAccount,
  createAccount,
  createSessionCookie,
  getAuthSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "../lib/auth-service";

const router: IRouter = Router();

function setSession(res: Response, username: string) {
  res.cookie(SESSION_COOKIE, createSessionCookie(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS * 1000,
    path: "/",
  });
}

router.get("/auth/session", async (req, res, next) => {
  try {
    res.json(GetAuthSessionResponse.parse(await getAuthSession(req.cookies?.[SESSION_COOKIE])));
  } catch (error) {
    next(error);
  }
});

router.post("/auth/signup", async (req, res, next) => {
  try {
    const input = SignupBody.parse(req.body);
    const username = await createAccount(input.username, input.password);
    setSession(res, username);
    res.json(
      GetAuthSessionResponse.parse({
        ...(await getAuthSession(createSessionCookie(username))),
        message: "Account created. Your private chat is ready.",
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({
        error: "Use a 3–32 character username and a password with at least 8 characters.",
      });
      return;
    }
    if (error instanceof Error && error.name === "AccountExistsError") {
      res.status(409).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post("/auth/login", async (req, res, next) => {
  try {
    const input = LoginBody.parse(req.body);
    const username = await authenticateAccount(input.username, input.password);
    setSession(res, username);
    res.json(
      GetAuthSessionResponse.parse({
        ...(await getAuthSession(createSessionCookie(username))),
        message: "Welcome back. Your private chat has been restored.",
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Enter your username and password." });
      return;
    }
    if (error instanceof Error && error.name === "BannedAccountError") {
      res.status(403).json({ error: error.message });
      return;
    }
    if (error instanceof Error && error.name === "InvalidCredentialsError") {
      res.status(401).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post("/auth/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
  res.json(
    GetAuthSessionResponse.parse({
      authenticated: false,
      username: null,
      isAdmin: false,
      message: "Signed out.",
    }),
  );
});

export default router;