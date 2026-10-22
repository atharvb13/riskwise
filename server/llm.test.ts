import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";

afterEach(() => vi.unstubAllGlobals());

const completion = {
  choices: [{ message: { role: "assistant", content: "{}" } }],
};

describe("LLM transport", () => {
  it("forwards the requested output-token limit and an abort signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(completion));
    vi.stubGlobal("fetch", fetchMock);
    await invokeLLM({
      messages: [{ role: "user", content: "Analyze this route" }],
      maxTokens: 1234,
    });
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(options.body as string).max_tokens).toBe(1234);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([401, 404, 429, 500])(
    "returns a useful error without exposing the provider's response body (%i)",
    async status => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(new Response("private-provider-data", { status }))
      );
      const result = invokeLLM({ messages: [] });
      await expect(result).rejects.toMatchObject({ code: "BAD_GATEWAY" });
      await expect(result).rejects.not.toThrow("private-provider-data");
    }
  );

  it.each([{}, { choices: [] }, { choices: [{ message: null }] }])(
    "rejects an invalid completion envelope: %j",
    async data => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data)));
      await expect(invokeLLM({ messages: [] })).rejects.toMatchObject({
        code: "BAD_GATEWAY",
        message: expect.stringContaining("invalid response"),
      });
    }
  );

  it("bounds response-body reading as well as the initial connection", async () => {
    const timeout = ENV.RISKWISE_LLM_TIMEOUT_MS;
    ENV.RISKWISE_LLM_TIMEOUT_MS = 1000;
    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.write('{"choices":'); // A provider that sends headers then stalls.
    });
    try {
      await new Promise<void>(resolve =>
        server.listen(0, "127.0.0.1", resolve)
      );
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Test server did not bind");
      await expect(
        invokeLLM(
          { messages: [] },
          { baseUrl: `http://127.0.0.1:${address.port}/v1` }
        )
      ).rejects.toMatchObject({ code: "TIMEOUT" });
    } finally {
      ENV.RISKWISE_LLM_TIMEOUT_MS = timeout;
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
