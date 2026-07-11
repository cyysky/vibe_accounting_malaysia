/**
 * Unit tests for the MyInvois HTTP client.
 *
 * Focus on the parts that are pure logic (token caching, query string
 * assembly) so the tests do not require network access.
 */
import { MyInvoisClient } from "./myinvois.client";
import type { ConfigService } from "@nestjs/config";
import type { EinvoiceConfig } from "../einvoice.config";

const SANDBOX: EinvoiceConfig = {
  environment: "SANDBOX",
  clientId: "id",
  clientSecret: "secret",
  taxpayerTin: "TIN",
  endpoints: {
    base: "https://preprod-api.myinvois.hasil.gov.my",
    token: "/connect/token",
    submit: "/api/v1.0/documentsubmissions",
    search: "/api/v1.0/documents/search",
    getDocument: "/api/v1.0/documents/{id}/details",
    cancelDocument: "/api/v1.0/documents/{id}/state",
    getRecent: "/api/v1.0/documents/recent",
  },
};

function fakeConfig(values: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe("MyInvoisClient", () => {
  const realFetch = global.fetch;
  let fetchSpy: jest.Mock;

  beforeEach(() => {
    fetchSpy = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = fetchSpy;
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  it("reuses a cached token for the same environment", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ access_token: "tok-1", expires_in: 3600 })),
    });
    const client = new MyInvoisClient(fakeConfig());
    const a = await client.getAccessToken(SANDBOX);
    const b = await client.getAccessToken(SANDBOX);
    expect(a).toBe("tok-1");
    expect(b).toBe("tok-1");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("refetches a token when the cache is cleared", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ access_token: "tok-2", expires_in: 3600 })),
    });
    const client = new MyInvoisClient(fakeConfig());
    client.clearCache();
    const tok = await client.getAccessToken(SANDBOX);
    expect(tok).toBe("tok-2");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("throws when the API returns a non-2xx status", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("invalid_client"),
    });
    const client = new MyInvoisClient(fakeConfig());
    client.clearCache();
    await expect(client.getAccessToken(SANDBOX)).rejects.toThrow(/401/);
  });

  it("assembles query strings without undefined / null values", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ access_token: "tok-3", expires_in: 3600 })),
    });
    const client = new MyInvoisClient(fakeConfig());
    client.clearCache();
    await client.searchDocuments(SANDBOX, { submissionUid: "abc", pageNo: "1", pageSize: undefined as never });
    // First call is the token endpoint, second is the search call.
    const url = fetchSpy.mock.calls[1][0];
    expect(url).toContain("submissionUid=abc");
    expect(url).toContain("pageNo=1");
    expect(url).not.toContain("pageSize=undefined");
    expect(url).not.toContain("null");
  });
});
