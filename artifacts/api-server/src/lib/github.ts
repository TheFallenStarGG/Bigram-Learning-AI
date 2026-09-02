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
  sha?: string;
};

async function githubRequest<T>(
  requestPath: string,
  init?: GithubRequestInit,
  options?: { allowNotFound?: boolean },
) {
  const headers = {
    Accept: "application/vnd.github+json",
    ...(init?.headers ?? {}),
  };
  const response = process.env.GITHUB_TOKEN
    ? await fetch(`https://api.github.com${requestPath}`, {
        ...init,
        headers: {
          ...headers,
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        },
      })
    : await connectors.proxy("github", requestPath, {
        ...init,
        headers,
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

function contentsPath(relativePath: string) {
  const encodedPath = relativePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return repositoryPath(
    SNAPSHOT_REPOSITORY.owner,
    SNAPSHOT_REPOSITORY.repository,
    `/contents/${encodedPath}`,
  );
}

export async function readPrivateFile(relativePath: string) {
  const file = await githubRequest<GithubContent>(
    `${contentsPath(relativePath)}?ref=${encodeURIComponent(SNAPSHOT_REPOSITORY.branch)}`,
    undefined,
    { allowNotFound: true },
  );
  if (!file?.content) return null;
  return {
    content: Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8"),
    sha: file.sha ?? null,
  };
}

export async function listPrivateDirectory(relativePath: string) {
  return (
    (await githubRequest<GithubContent[]>(
      `${contentsPath(relativePath)}?ref=${encodeURIComponent(SNAPSHOT_REPOSITORY.branch)}`,
      undefined,
      { allowNotFound: true },
    )) ?? []
  );
}

export async function writePrivateFile(input: {
  relativePath: string;
  content: string;
  message: string;
}) {
  const existing = await readPrivateFile(input.relativePath);
  await githubRequest(
    contentsPath(input.relativePath),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.message,
        content: Buffer.from(input.content, "utf8").toString("base64"),
        branch: SNAPSHOT_REPOSITORY.branch,
        ...(existing?.sha ? { sha: existing.sha } : {}),
      }),
    },
  );
}

export async function deletePrivateFile(input: {
  relativePath: string;
  message: string;
}) {
  const existing = await readPrivateFile(input.relativePath);
  if (!existing?.sha) return;
  await githubRequest(
    contentsPath(input.relativePath),
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: input.message,
        sha: existing.sha,
        branch: SNAPSHOT_REPOSITORY.branch,
      }),
    },
  );
}

export async function pushSnapshotToGithub(input: {
  filename: string;
  content: string;
}) {
  await writePrivateFile({
    relativePath: `snapshots/${input.filename}`,
    content: input.content,
    message: `Save model snapshot ${input.filename}`,
  });
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