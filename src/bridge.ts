import {
  State,
  StateUpdater,
  createState,
  get,
  set,
  subscribe,
  useSharedState,
} from "statedrive";

import {IDBAuthStorage} from "./IDBAuthStorage";
import {NoHTTPClient, NoLoginRoute, NoSessionExists} from "./exceptions";
import {HttpClient} from "./http-client";
import {
  AppAuthState,
  AuthStorage,
  AuthTokenInjectable,
  Routes,
  Session,
} from "./types";

function cloneCurrentState<T>(x: AppAuthState<T> | null | undefined) {
  if (!x) return x;
  const curr: Required<AppAuthState<T>> = {
    activeUserIndex: x?.activeUserIndex ?? -1,
    users: x.users?.slice() || [],
  };
  return curr;
}
export class AuthBridge<T extends {user: string}>
  implements AuthTokenInjectable
{
  private _state: State<AppAuthState<T> | null>;
  public routes: Routes;
  public onLogout: (fn: AppAuthState<T> | null) => void;
  private _client: HttpClient;
  public onAuthUserSwitch: Function;
  private _backingStore: AuthStorage<T>;

  public withBackingStore(s: AuthStorage<T>) {
    this._backingStore = s;
    this._syncWithBackingStore();
    return this;
  }
  public withDefaultBackingStore() {
    return this.withBackingStore(new IDBAuthStorage());
  }
  public get refreshTokenRoute() {
    return this.routes.refreshTokenRoute;
  }
  private _getCurrentAuth() {
    const state = this.getState();
    return (
      state && state.users?.[state.activeUserIndex ?? -1]
    ); /* -1 == undefined == needs to select */
  }

  constructor() {
    this._state = createState<AppAuthState<T>>({
      initialValue: {activeUserIndex: 0, users: []},
    });
    subscribe(this._state, (old, n) => {
      const backingStore = this._backingStore;
      if (!backingStore || old == n) return;
      backingStore.onAuthStateChange(n);
    });
  }

  public getState() {
    return get(this._state);
  }
  public getCurrentAuthenticationScope() {
    try {
      return this._getCurrentAuth();
    } catch (e) {
      return null;
    }
  }
  public getCurrentAuthenticatedUser() {
    return this.getCurrentAuthenticationScope()?.auth;
  }
  private _headers(tokens: Session<T> | undefined | null) {
    if (!tokens || !tokens.accessToken) return {};
    return {
      Authorization: `Bearer ${tokens.accessToken}`,
      "X-Access-Token": tokens.accessToken as string,
      "X-Refresh-Token": tokens.refreshToken as string,
    };
  }

  public getAuthenticationHeaders() {
    return this._headers(this.getCurrentAuthenticationScope());
  }
  public updateCurrentUserAuthHeaders(
    accessToken: string | null,
    refreshToken: string | null
  ) {
    this.setState((_curr) => {
      const state = cloneCurrentState(_curr);
      if (!state?.users || state.activeUserIndex == null)
        throw new Error("Current user does not exist!");
      if (!state.users[state.activeUserIndex]) {
        return state;
      }
      const newState: Session<T> = {...state.users[state.activeUserIndex]};
      if (accessToken != null) newState.accessToken = accessToken || null;
      if (refreshToken != null) newState.refreshToken = refreshToken || null;
      state.users[state.activeUserIndex] = newState;
      return state;
    });
  }
  public updateCurrentUser(updater: StateUpdater<T>) {
    this.setState((_state) => {
      const state = cloneCurrentState(_state);
      if (!state?.users || state.activeUserIndex == null)
        throw new Error("Current user does not exist!");
      const newState: Session<T> = {...state.users[state.activeUserIndex]};
      newState.auth =
        typeof updater === "function" ? updater(newState.auth) : updater;
      state.users[state.activeUserIndex] = newState;
      return state;
    });
  }
  public setState(v: StateUpdater<AppAuthState<T> | null>) {
    return set(this._state, v);
  }
  public switchAuthenticatedUser(index: number) {
    this.setState((curr) => {
      const current = cloneCurrentState(curr);
      if (
        current == null ||
        current.users?.length == null ||
        current.users.length <= index
      )
        throw new NoSessionExists("No such session exists!");

      return {activeUserIndex: index, users: [...current.users]};
    });
    this.onAuthUserSwitch();
  }
  public logoutAll() {
    this.setState(null);
    this.onLogout?.(null);
  }
  public logoutCurrent() {
    this.setState((_curr) => {
      const curr = cloneCurrentState(_curr);
      if (
        !curr?.users ||
        curr.activeUserIndex == null ||
        curr.activeUserIndex == -1
      )
        return {users: [], activeUserIndex: -1};
      curr.users.splice(curr.activeUserIndex, 1);
      curr.activeUserIndex = -1;
      this.onLogout?.(curr);
      return curr;
    });
  }

  public login(user: string, password: string) {
    if (!this._client) throw new NoHTTPClient("No HTTP Client created!");
    if (!this.routes || !this.routes.loginRoute)
      throw new NoLoginRoute("No login route found!");

    const obj = {user, password};

    const request = HttpClient.unauthenticatedClient.postJSON<
      Session<T>["auth"]
    >(this.routes.loginRoute, obj);
    const {controller, result, headers} = request;
    return {
      controller,
      result: result.then(async (resp) => {
        const js: any = resp.data;
        const data = (resp as any).user_data || (js && js.user_data);
        if (data) {
          const h = await headers;
          const accessToken = h.get("x-access-token");
          const refreshToken = h.get("x-refresh-token");
          this.setState((_curr) => {
            const curr = cloneCurrentState(_curr)!;

            if (curr!.users!.find((x) => x.auth.user == data.user)) {
              return curr;
            }
            curr.users!.push({accessToken, refreshToken, auth: data});
            curr.activeUserIndex = curr.users!.length - 1;
            return curr;
          });
        }
        return resp;
      }),
      headers,
    };
  }

  public getHooks() {
    const useAllAuthState = () => {
      return useSharedState(this._state);
    };
    const useCurrentAuthState = () => {
      const [state] = useAllAuthState();
      return [
        state?.users ? state.users[state!.activeUserIndex!] || null : null,
        (args: T) => this.updateCurrentUser(args),
      ] as const;
    };
    const useIsLoggedIn = () => {
      const [curr] = useCurrentAuthState();
      return Boolean(curr && curr.auth && curr.auth.user);
    };
    return {
      useAllAuthState,
      useCurrentAuthState,
      useIsLoggedIn,
    };
  }
  getHttpClient() {
    if (this._client) return this._client;
    if (!this.routes || !this.routes.refreshTokenRoute)
      throw new Error("No refresh token route found!");
    this._client = new HttpClient(this, () => this.onLogout?.(this.getState()));
    return this._client;
  }
  private async _syncWithBackingStore() {
    if (this._backingStore)
      this.setState(await this._backingStore.retrieveAuth());
  }
  async syncWithServer() {
    if (!this.routes || !this.routes.initialAuthCheckRoute) {
      throw new Error("Auth check route not found!");
    }
    if (this._backingStore) await this._backingStore.wait();
    const headers: any = this.getAuthenticationHeaders();
    if (!headers.Authorization) return;
    const cl = this.getHttpClient();

    const {result} = cl.get<{user_data: T}>(this.routes.initialAuthCheckRoute);
    return result.then((js) => {
      this.updateCurrentUser(js.data.user_data || (js.data as any));
    });
  }
}
