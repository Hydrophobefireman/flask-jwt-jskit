import {AbortableFetchResponse, AuthTokenInjectable} from "../types";
const genericResultExtractionErrorHandler = (
  e: Error
): {
  data: null;
  error: string;
} => {
  console.warn("error occured while parsing:");
  console.warn(e);
  return {data: null, error: "A network error occured"};
};
export class HttpClient {
  constructor(
    private authCtx: AuthTokenInjectable | null,
    private onAuthError?: Function
  ) {}

  private _transformHeadersAndAttachController(options: RequestInit) {
    const controller = new AbortController();
    if (this.authCtx) {
      const authHeaders = this.authCtx.getAuthenticationHeaders();
      if (authHeaders.Authorization) {
        const currentHeaders = new Headers(options.headers || {});
        Object.entries(authHeaders).forEach((k) => {
          currentHeaders.set(k[0], k[1]);
        });
        options.headers = currentHeaders;
      }
    }
    options.headers ||= new Headers();
    options.signal = controller.signal;
    return controller;
  }
  static get unauthenticatedClient() {
    return new HttpClient(null, undefined);
  }
  private _wrapResponseWithRetry<T>(
    afr: AbortableFetchResponse<T>,
    retry: () => AbortableFetchResponse<T>
  ): AbortableFetchResponse<T> {
    const {result, headers, controller} = afr;
    if (!this.authCtx) throw new Error("Invalid invocation");
    const {authCtx} = this;
    return {
      controller,
      headers,
      result: result.then((js) => {
        if (js.error == "refresh") {
          return this.get<any>(authCtx.refreshTokenRoute).result.then((x) =>
            x.error ? x : retry().result
          );
        }
        if (js.error == "re-auth") {
          this.onAuthError?.();
        }

        headers
          .then((h) => {
            authCtx.updateCurrentUserAuthHeaders(
              h.get("x-access-token"),
              h.get("x-refresh-token")
            );
          })
          .catch(() => {});
        return js;
      }),
      did_refresh: true,
    };
  }

  private _bodylessRequest<T>(
    method: string,
    url: RequestInfo | URL,
    options: RequestInit | undefined,
    extractResult: (f: Response) => any,
    retry: () => AbortableFetchResponse<T>
  ): AbortableFetchResponse<T> {
    const clone: RequestInit = {...options, method, body: undefined};
    const controller = this._transformHeadersAndAttachController(clone);
    const response = fetch(url, clone);
    const headers = response.then((resp) => {
      return resp.headers;
    });
    const ret: AbortableFetchResponse<T> = {
      controller,
      headers,
      result: response
        .then(extractResult)
        .catch(genericResultExtractionErrorHandler),
      did_refresh: false,
    };
    if (this.authCtx) {
      return this._wrapResponseWithRetry(ret, retry);
    }
    return ret;
  }
  private _sendJSON<T>(
    method: string,
    url: RequestInfo,
    body: object,
    options: RequestInit | undefined,
    extractResult: (f: Response) => any,
    retry: () => AbortableFetchResponse<T>
  ): AbortableFetchResponse<T> {
    const clone = {
      ...options,
      method,
      body: JSON.stringify(body),
    } as RequestInit & {headers: Headers};
    const controller = this._transformHeadersAndAttachController(clone);
    if (!clone.headers.has("content-type"))
      clone.headers.set("content-type", "application/json");
    const response = fetch(url, clone);
    const headers = response.then((resp) => {
      return resp.headers;
    });
    const ret: AbortableFetchResponse<T> = {
      controller,
      headers,
      result: response
        .then(extractResult)
        .catch(genericResultExtractionErrorHandler),
      did_refresh: false,
    };
    if (this.authCtx) {
      return this._wrapResponseWithRetry(ret, retry);
    }
    return ret;
  }
  public get<T>(
    url: RequestInfo | URL,
    options?: RequestInit
  ): AbortableFetchResponse<T> {
    return this._bodylessRequest<T>(
      "GET",
      url,
      options,
      (response) => response.json(),
      () => this.get<T>(url, options)
    );
  }
  public head(
    url: RequestInfo | URL,
    options?: RequestInit
  ): AbortableFetchResponse<null> {
    return this._bodylessRequest<null>(
      "HEAD",
      url,
      options,
      () => null,
      () => this.head(url, options)
    );
  }
  public del<T>(
    url: RequestInfo | URL,
    options?: RequestInit
  ): AbortableFetchResponse<T> {
    return this._bodylessRequest<T>(
      "DELETE",
      url,
      options,
      (response) => response.json(),
      () => this.del<T>(url, options)
    );
  }
  public postJSON<T>(
    url: RequestInfo,
    body: object,
    options?: RequestInit
  ): AbortableFetchResponse<T> {
    return this._sendJSON(
      "POST",
      url,
      body,
      options,
      (r) => r.json(),
      () => this.postJSON<T>(url, body, options)
    );
  }
  public patchJSON<T>(url: RequestInfo, body: object, options?: RequestInit) {
    return this._sendJSON(
      "PATCH",
      url,
      body,
      options,
      (r) => r.json(),
      () => this.patchJSON<T>(url, body, options)
    );
  }
  public putJSON<T>(url: RequestInfo, body: object, options?: RequestInit) {
    return this._sendJSON(
      "PUT",
      url,
      body,
      options,
      (r) => r.json(),
      () => this.putJSON<T>(url, body, options)
    );
  }
  public getBinary(
    url: RequestInfo | URL,
    options?: RequestInit
  ): AbortableFetchResponse<ArrayBuffer | null> {
    const clone: RequestInit = {...options, method: "GET", body: undefined};
    const controller = this._transformHeadersAndAttachController(clone);
    const response = fetch(url, clone);
    const headers = response.then((resp) => {
      return resp.headers;
    });
    const ret: AbortableFetchResponse<ArrayBuffer | null> = {
      controller,
      headers,
      result: response
        .then(async (response) => ({data: await response.arrayBuffer()}))
        .catch(genericResultExtractionErrorHandler),
      did_refresh: false,
    };
    if (this.authCtx) {
      return this._wrapResponseWithRetry(ret, () =>
        this.getBinary(url, options)
      );
    }
    return ret;
  }
  public getBinaryStream(
    url: RequestInfo | URL,
    options?: RequestInit,
    onRead?: ({}: {
      chunk: Uint8Array;
      received: number;
      total: number | null;
    }) => void,
    chunkOptions: {collectChunks?: boolean} = {collectChunks: true}
  ): AbortableFetchResponse<ArrayBuffer | null> {
    const clone: RequestInit = {...options, method: "GET", body: undefined};
    const controller = this._transformHeadersAndAttachController(clone);
    const response = fetch(url, clone);
    const headers = response.then((resp) => {
      return resp.headers;
    });
    const ret = {
      controller,
      headers,
      result: response
        .then(async (response) => {
          const responseHeaders = response.headers;
          const len = +responseHeaders.get("content-length")!;
          const reader = response.body!.getReader();
          let receivedLength = 0;
          let chunks: Uint8Array[] = [];
          while (true) {
            const {done, value} = await reader.read();
            if (done) {
              break;
            }
            if (chunkOptions.collectChunks) chunks.push(value);
            receivedLength += value.length;
            if (onRead) {
              onRead({
                chunk: value,
                received: receivedLength,
                total: len || null,
              });
            }
          }
          if (!chunkOptions.collectChunks) return {data: new ArrayBuffer(0)};
          let chunksAll = new Uint8Array(receivedLength);
          let position = 0;
          for (let chunk of chunks) {
            chunksAll.set(chunk, position);
            position += chunk.length;
          }
          return {data: chunksAll.buffer};
        })
        .catch(genericResultExtractionErrorHandler),
      did_refresh: false,
    };
    return ret;
  }
  public postBinary<T>(url: RequestInfo, body: any, options?: RequestInit) {
    const clone = {
      ...options,
      method: "POST",
      body,
    } as RequestInit & {headers: Headers};
    const controller = this._transformHeadersAndAttachController(clone);
    const response = fetch(url, clone);
    const headers = response.then((resp) => {
      return resp.headers;
    });
    const ret: AbortableFetchResponse<T> = {
      controller,
      headers,
      result: response
        .then((response) => response.json())
        .catch(genericResultExtractionErrorHandler),
      did_refresh: false,
    };
    if (this.authCtx) {
      return this._wrapResponseWithRetry(ret, () =>
        this.postBinary(url, body, options)
      );
    }
    return ret;
  }
}
