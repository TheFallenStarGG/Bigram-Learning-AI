import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

export const SNAPSHOT_REPOSITORY_URL =
  "https://github.com/TheFallenStarGG/Bigram-Learning-AI-Snapshots";

export const SNAPSHOT_REPOSITORY = {
  owner: "TheFallenStarGG",
  repository: "Bigram-Learning-AI-Snapshots",
  branch: "main",
} as const;

type GithubRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

type GithubContent = {
  name: string;
  type: string;
  download_url?: string | null;
  content?: string;
};

async function githubRequest<T>(
  requestPath: string,
  init?: GithubRequestInit,
  options?: { allowNotFound?: boolean },
) {
  const response = await connectors.proxy("github", requestPath, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      ...(init?.headers ?? {}),
    },
  });

  const responseText = await response.text();
  let payload: unknown = null;
  if (responseText) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = responseText;
    }
  }

  if (response.status === 404 && options?.allowNotFound) {
    return null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : response.statusText || "GitHub request failed";
    throw new Error(`GitHub request failed (${response.status}): ${message}`);
  }

  return payload as T;
}

function repositoryPath(owner: string, repository: string, suffix: string) {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}${suffix}`;
}

export async function pushSnapshotToGithub(input: {
  filename: string;
  content: string;
}) {
  const filePath = `snapshots/${input.filename}`
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  await githubRequest(
    repositoryPath(
      SNAPSHOT_REPOSITORY.owner,
      SNAPSHOT_REPOSITORY.repository,
      `/contents/${filePath}`,
    ),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Save model snapshot ${input.filename}`,
        content: Buffer.from(input.content, "utf8").toString("base64"),
        branch: SNAPSHOT_REPOSITORY.branch,
      }),
    },
  );
}

export async function getLatestSnapshotFromGithub() {
  const directory = await githubRequest<GithubContent[]>(
    repositoryPath(
      SNAPSHOT_REPOSITORY.owner,
      SNAPSHOT_REPOSITORY.repository,
      `/contents/snapshots?ref=${encodeURIComponent(SNAPSHOT_REPOSITORY.branch)}`,
    ),
    undefined,
    { allowNotFound: true },
  );

  if (!directory) return null;

  const latestFile = directory
    .filter(
      (item) =>
        item.type === "file" &&
        item.name.startsWith("bigram-model-") &&
        item.name.endsWith(".json"),
    )
    .sort((left, right) => right.name.localeCompare(left.name))[0];

  if (!latestFile) return null;

  const file = await githubRequest<GithubContent>(
    repositoryPath(
      SNAPSHOT_REPOSITORY.owner,
      SNAPSHOT_REPOSITORY.repository,
      `/contents/snapshots/${encodeURIComponent(latestFile.name)}?ref=${encodeURIComponent(SNAPSHOT_REPOSITORY.branch)}`,
    ),
  );

  if (!file?.content) {
    throw new Error(`GitHub snapshot ${latestFile.name} did not include file content`);
  }

  return {
    filename: latestFile.name,
    content: Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8"),
  };
}