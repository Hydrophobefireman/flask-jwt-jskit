import {Object_assign} from "@hydrophobefireman/j-utils";

import {get as idbGet, set as idbSet} from "../idb";
import {AuthenticationTokens, FetchResponse} from "./interfaces";

const ACCESS_TOKEN = "auth_tokens.access";
const REFRESH_TOKEN = "auth_tokens.refresh";

export const tokens: AuthenticationTokens = {
  accessToken: null,
  refreshToken: null,
};

export function _headers(tokens: AuthenticationTokens) {
  return {
    Authorization: `Bearer ${tokens.accessToken}`,
    "X-Access-Token": tokens.accessToken,
    "X-Refresh-Token": tokens.refreshToken,
  };
}

export function clearAuthenticationHeaders() {
  tokens.accessToken = tokens.refreshToken = null;
}

export const getAuthenticationHeaders = async function () {
  if (tokens && tokens.accessToken && tokens.refreshToken)
    return _headers(tokens);

  const access = await idbGet<string>(ACCESS_TOKEN);
  const refresh = await idbGet<string>(REFRESH_TOKEN);
  if (!access && !refresh) return {};
  tokens.accessToken = access;
  tokens.refreshToken = refresh;
  return _headers(tokens);
};

export function updateTokens(access: string, refresh: string) {
  if (access != null) {
    access = access || null;
    idbSet(ACCESS_TOKEN, access);
    tokens.accessToken = access;
  }
  if (refresh != null) {
    refresh = refresh || null;
    idbSet(REFRESH_TOKEN, refresh);
    tokens.refreshToken = refresh;
  }
}

export async function _awaitData<T>(
  url: string,
  options?: RequestInit,
  type?: FetchResponse["type"] | "none"
) {
  let data: {data: T; error?: string};
  let response: Response;
  try {
    options.headers = Object_assign(
      options.headers,
      await getAuthenticationHeaders()
    );
    const request_fetch = fetch(url, options);
    response = await request_fetch;
    const responseHeaders = response.headers;

    updateTokens(
      responseHeaders.get("x-access-token"),
      responseHeaders.get("x-refresh-token")
    );

    data = type === "none" ? {data: null} : await response[type]();
  } catch (e) {
    if (e instanceof DOMException) return {data: {}};
    console.log(e);
    data = {
      error: "A network error occured.",
      data: null,
    };
  }

  return {data, headers: response && response.headers};
}

//https://javascript.info/fetch-progress
export async function _streamData<T>(
  url: string,
  options?: RequestInit,
  type?: Exclude<FetchResponse["type"] | "none", "json">,
  onRead?: ({}: {chunk: Uint8Array; received: number; total: number}) => void
) {
  let data: {data: T; error?: string};
  let response: Response;
  try {
    options.headers = Object_assign(
      options.headers,
      await getAuthenticationHeaders()
    );
    const request_fetch = fetch(url, options);
    response = await request_fetch;
    const responseHeaders = response.headers;
    const len = +responseHeaders.get("content-length");
    const reader = response.body.getReader();

    let receivedLength = 0;
    let chunks = [];
    while (true) {
      const {done, value} = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      receivedLength += value.length;
      if (onRead) {
        onRead({
          chunk: value,
          received: receivedLength,
          total: len ? len : null,
        });
      }
    }
    let chunksAll = new Uint8Array(receivedLength);
    let position = 0;
    for (let chunk of chunks) {
      chunksAll.set(chunk, position);
      position += chunk.length;
    }

    updateTokens(
      responseHeaders.get("x-access-token"),
      responseHeaders.get("x-refresh-token")
    );

    data = type === "none" ? {data: null} : (chunksAll.buffer as any);
    // data = type === "none" ? {data: null} : await response[type]();
  } catch (e) {
    if (e instanceof DOMException) return {data: {}};
    console.log(e);
    data = {
      error: "A network error occured.",
      data: null,
    };
  }

  return {data, headers: response && response.headers};
}
