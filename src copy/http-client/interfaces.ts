export interface AuthenticationTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AbortableFetchResponse<T> {
  result: Promise<{data: T; error?: string}>;
  controller: AbortController;
  headers: Promise<Headers>;
}

export interface FetchResponse {
  type: "json" | "arrayBuffer";
}

export interface Routes {
  loginRoute: string;
  refreshTokenRoute: string;
  initialAuthCheckRoute: string;
}

export {};
