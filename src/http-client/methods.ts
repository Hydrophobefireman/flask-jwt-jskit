import {Object_assign} from "@hydrophobefireman/j-utils";

import {AbortableFetchResponse, FetchResponse} from "./interfaces";
import {_awaitData, _streamData} from "./util";

function _prepareFetch<T = {}>(
  url: string,
  options?: RequestInit,
  type: FetchResponse["type"] | "none" = "json",
  mode: "stream" | "await" = "await",
  onRead?: ({}: {chunk: Uint8Array; received: number; total: number}) => void
) {
  const controller = new AbortController();
  const signal = controller.signal;
  options.signal = signal;
  const prom =
    mode === "await"
      ? _awaitData(url, options, type)
      : _streamData(url, options, type as any, onRead);
  const data = prom.then(({data}) => data);
  const headers = prom.then(({headers}) => headers);
  return {result: data, controller, headers} as AbortableFetchResponse<T>;
}

function __bodyless(mode: "HEAD" | "GET" | "DELETE") {
  return function <T = {}>(
    url: string,
    headers?: Record<string, string>,
    options?: RequestInit
  ) {
    options = Object_assign({}, options || {}, {
      method: mode,
      headers: headers || (options && (options.headers as object)) || {},
    });
    const response = _prepareFetch<T>(
      url,
      options,
      mode === "HEAD" ? "none" : "json"
    );

    return response;
  };
}

export const _get = __bodyless("GET");

export const _head = __bodyless("HEAD");

export const _del = __bodyless("DELETE");

function _sendJSON(method: "POST" | "PATCH" | "PUT") {
  return function <T = {}>(
    url: string,
    body: object,
    headers?: Record<string, string>,
    options?: RequestInit
  ) {
    options = Object_assign({}, options || {}, {
      body: JSON.stringify(body),
      method,
      headers: Object_assign(
        {"content-type": "application/json"},
        headers || (options && (options.headers as object)) || {}
      ),
    });
    return _prepareFetch<T>(url, options);
  };
}
export const _postJSON = _sendJSON("POST");
export const _patchJSON = _sendJSON("PATCH");
export const _putJSON = _sendJSON("PUT");

export function _getBinary(
  url: string,
  headers?: Record<string, string>,
  options?: RequestInit
) {
  options = Object_assign({}, options || {}, {
    method: "get",
    headers: headers || (options && (options.headers as object)) || {},
  });
  return _prepareFetch<ArrayBuffer>(url, options, "arrayBuffer") as {
    result: Promise<ArrayBuffer | {error?: string}>;
    controller: AbortController;
    headers: Promise<Headers>;
  };
}

export function _getBinaryStream(
  url: string,
  headers?: Record<string, string>,
  options?: RequestInit,
  onRead?: ({}: {chunk: Uint8Array; received: number; total: number}) => void
) {
  options = Object_assign({}, options || {}, {
    method: "get",
    headers: headers || (options && (options.headers as object)) || {},
  });
  return _prepareFetch<ArrayBuffer>(
    url,
    options,
    "arrayBuffer",
    "stream",
    onRead
  ) as {
    result: Promise<ArrayBuffer | {error?: string}>;
    controller: AbortController;
    headers: Promise<Headers>;
  };
}

export function _postBinary<T>(
  url: string,
  body: ArrayBuffer,
  headers?: Record<string, string>,
  options?: RequestInit
) {
  options = Object_assign({}, options || {}, {
    method: "post",
    body,
    headers: headers || (options && (options.headers as object)) || {},
  });
  return _prepareFetch<T>(url, options);
}
