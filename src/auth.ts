import { Env } from "./types";

export async function validateAuth(
  req: Request,
  env: Env
): Promise<string | null> {
  let userId = "";
  try {
    const authResp = await env.SERVICE_AUTH.fetch(
      "https://auth.bjarke.workers.dev/users/me",
      {
        method: "GET",
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
        },
      }
    );
    if (authResp.status !== 200) {
      return null;
    }
    const authRespJson = await authResp.json<{ id: string }>();
    userId = authRespJson.id;
    if (!userId) {
      return null;
    }
  } catch (error) {
    console.error("error calling auth service", error);
    return null;
  }
  return userId;
}
