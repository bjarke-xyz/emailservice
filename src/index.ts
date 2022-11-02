/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Router } from "itty-router";
import * as Joi from "joi";
import { validateAuth } from "./auth";
import { Env } from "./types";

const missingHandler = () => new Response("Not found.", { status: 404 });

interface EmailInput {
  from: {
    email: string;
    name: string;
  };
  to: {
    email: string;
  };
  subject: string;
  content: {
    type: string;
    value: string;
  }[];
}
const emailInputSchema = Joi.object({
  from: Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .required(),
    name: Joi.string().required(),
  }).required(),
  to: Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .required(),
  }),
  subject: Joi.string().required(),
  content: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().required(),
        value: Joi.string().required(),
      })
    )
    .min(1)
    .required(),
});
function validateEmailInput(input: any): input is EmailInput {
  const { error } = emailInputSchema.validate(input);
  console.log(error);
  if (error) {
    throw error;
  }
  return true;
}

async function sendEmail(input: EmailInput): Promise<any> {
  try {
    const request = new Request("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [
              {
                email: input.to.email,
              },
            ],
          },
        ],
        from: {
          email: input.from.email,
          name: input.from.name,
        },
        subject: input.subject,
        content: input.content.map((x) => ({ type: x.type, value: x.value })),
      }),
    });
    const resp = await fetch(request);
    if (!resp.ok) {
      console.error(
        `mailchannels.net api responded non-200 when sending mail to ${input.to.email}`
      );
    }
  } catch (error) {
    console.error(`Failed to send mail to ${input.to.email}`, error);
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const router = Router();
    router.post(
      "/email",
      async (request: Request, env: Env, ctx: ExecutionContext) => {
        const userId = await validateAuth(request, env);
        if (!userId) {
          return new Response("Could not authenticate", { status: 401 });
        }
        if (!request.json) {
          return new Response("", {
            status: 400,
          });
        }
        let input: EmailInput | null = null;
        try {
          const inputAny = await request.json?.();
          if (validateEmailInput(inputAny)) {
            input = inputAny;
          }
        } catch (error) {
          return new Response(JSON.stringify(error), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (!input) {
          return new Response("invalid input", { status: 400 });
        }
        ctx.waitUntil(sendEmail(input));
        return new Response("mail sent");
      }
    );
    router.all("*", missingHandler);
    return router.handle(request, env, ctx);
  },
};
