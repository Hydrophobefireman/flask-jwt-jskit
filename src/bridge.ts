import {
  State,
  StateUpdater,
  createState,
  get,
  set,
  useSharedState,
} from "statedrive";

import {NoHTTPClient, NoLoginRoute, NoSessionExists} from "./exceptions";
import {HttpClient} from "./http-client";
import {AppAuthState, AuthTokenInjectable, Routes, Session} from "./types";

class AuthContext<T extends {user: string}> implements AuthTokenInjectable {
  private _state: State<AppAuthState<T>>;
  public routes: Routes;
  public onLogout: Function;
  private _client: HttpClient;
  public onAuthUserSwitch: Function;

  public get refreshTokenRoute() {
    return this.routes.refreshTokenRoute;
  }
  private _getCurrentAuth() {
    const state = this.getState();
    return state._users[
      state._activeUserIndex
    ]; /* -1 == undefined == needs to select */
  }

  constructor() {
    this._state = createState<AppAuthState<T>>({
      initialValue: {_activeUserIndex: 0, _users: []},
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
  private _headers(tokens: Session<T>) {
    if (!tokens) return {};
    return {
      Authorization: `Bearer ${tokens.accessToken}`,
      "X-Access-Token": tokens.accessToken,
      "X-Refresh-Token": tokens.refreshToken,
    };
  }

  public getAuthenticationHeaders() {
    return this._headers(this.getCurrentAuthenticationScope());
  }
  public updateAuthenticationHeaders(
    accessToken: string,
    refreshToken: string
  ) {
    this.setState((state) => {
      const newState: Session<T> = {...state._users[state._activeUserIndex]};
      if (accessToken != null) newState.accessToken = accessToken || null;
      if (refreshToken != null) newState.refreshToken = refreshToken || null;
      state._users[state._activeUserIndex] = newState;
      return state;
    });
  }

  public setState(v: StateUpdater<AppAuthState<T>>) {
    return set(this._state, v);
  }
  public switchAuthenticatedUser(index: number) {
    const current = this.getState();
    if (current == null || current._users?.length <= index)
      throw new NoSessionExists("No such session exists!");

    this.setState({_activeUserIndex: index, _users: [...current._users]});
  }
  public logoutAll() {
    this.setState(null);
    this.onLogout?.();
  }
  public logoutCurrent() {
    this.setState((curr) => {
      curr._users.splice(curr._activeUserIndex, 1);
      curr._activeUserIndex = -1;
      return curr;
    });
  }

  public login(user: string, password: string) {
    if (!this._client) throw new NoHTTPClient("No HTTP Client created!");
    if (!this.routes || !this.routes.loginRoute)
      throw new NoLoginRoute("No login route found!");

    const obj = {user, password};

    const request = this._client.postJSON<Session<T>["auth"]>(
      this.routes.loginRoute,
      obj
    );
    const {controller, result, headers} = request;
    return {
      controller,
      result: result.then((resp) => {
        const js: any = resp.data;
        const data = (resp as any).user_data || (js && js.user_data);
        if (data) {
          this.setState((curr) => {
            if (curr._users.find((x) => x.auth.user == data.user)) {
              return curr;
            }
            curr._users.push(data);
            curr._activeUserIndex = curr._users.length - 1;
            return curr;
          });
        }
        return resp;
      }),
      headers,
    };
  }

  public getHooks() {
    const useAuthState = () => {
      return useSharedState(this._state);
    };
    const useCurrentAuthState = () => {
      const [state] = useAuthState();
      return state._users ? state._users[state._activeUserIndex] || null : null;
    };
    const useIsLoggedIn = () => {
      const curr = useCurrentAuthState();
      return Boolean(curr && curr.auth && curr.auth.user);
    };
    return {
      useAuthState,
      useCurrentAuthState,
      useIsLoggedIn,
    };
  }
  getHttpClient() {
    if (this._client) return this._client;
    if (!this.routes || !this.routes.refreshTokenRoute)
      throw new Error("No refresh token route found!");
    this._client = new HttpClient(this, () => this.onLogout?.());
    return this._client;
  }

  async syncWithServer() {
    if (!this._routes || !this._routes.initialAuthCheckRoute) {
      throw new Error("Auth check route not found!");
    }
    const headers: any = await getAuthenticationHeaders();
    if (!headers.Authorization) return;
    const cl = this.getHttpClient();

    const {result} = cl.get<{user_data: T}>(this._routes.initialAuthCheckRoute);
    return result.then((js) => {
      if (js.data && js.data.user_data) {
        this.updateState(js.data.user_data);
      }
    });
  }
}
