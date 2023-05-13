export interface Session<T> {
  auth: T;
  accessToken: string;
  refreshToken: string;
}
export interface AppAuthState<T> {
  _activeUserIndex: number;
  _users: Array<Session<T>>;
}
export interface Routes {
  loginRoute: string;
  refreshTokenRoute: string;
  initialAuthCheckRoute: string;
}

export interface AuthTokenInjectable {
  getAuthenticationHeaders(): {
    Authorization?: string;
    "X-Access-Token"?: string;
    "X-Refresh-Token"?: string;
  };
  updateAuthenticationHeaders(accessToken: string, refreshToken: string): void;

  refreshTokenRoute: string;
}

export interface AbortableFetchResponse<T> {
  result: Promise<{data: T; error?: string}>;
  controller: AbortController;
  headers: Promise<Headers>;
  did_refresh: boolean;
}
