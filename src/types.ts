export interface Session<T> {
  auth: T;
  accessToken: string | null;
  refreshToken: string | null;
}
export interface AppAuthState<T> {
  activeUserIndex?: number;
  users?: Array<Session<T>>;
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
  updateCurrentUserAuthHeaders(
    accessToken: string | null,
    refreshToken: string | null
  ): void;

  refreshTokenRoute: string;
}

export interface AbortableFetchResponse<T> {
  result: Promise<{data: T; error?: string}>;
  controller: AbortController;
  headers: Promise<Headers>;
  did_refresh: boolean;
}

export interface AuthStorage<T> {
  state: "READY" | "WAIT";
  onAuthStateChange(newAuth: AppAuthState<T> | null): any;
  wait(): Promise<unknown>;
  retrieveAuth(): Promise<AppAuthState<T> | null>;
}
