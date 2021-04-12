import {
  createState,
  set,
  State,
  useSharedState,
  useSharedStateValue,
} from "statedrive";
import { createClient } from "./http-client";
import { Routes } from "./http-client/interfaces";
import { clear } from "./idb";

export class Bridge<T extends { user: string }> {
  private readonly _state: State<T>;
  private _client: ReturnType<typeof createClient>;
  private _loginRoute: string;
  private _refreshTokenRoute: string;
  private _onLogout: () => void;

  constructor(authType: T) {
    this._state = createState({ initialValue: authType });
  }
  setRoutes({ loginRoute, refreshTokenRoute }: Routes) {
    this._loginRoute = loginRoute;
    this._refreshTokenRoute = refreshTokenRoute;
  }

  onLogout(cb: () => void) {
    this._onLogout = cb;
  }

  login(user: string, password: string) {
    if (!this._client) throw new Error("No HTTP Client created!");
    if (!this._loginRoute) throw new Error("No login route found!");
    const obj = { user, password };
    const request = this._client.postJSON(this._loginRoute, obj);
    const { controller, result, headers } = request;
    return {
      controller,
      result: result.then((resp) => {
        const js: any = resp.data;
        const data = js && js.user_data;
        if (data) {
          set(this._state, data);
        }
        return resp;
      }),
      headers,
    };
  }

  logout() {
    clear();
    set(this._state, null);
    this._onLogout && this._onLogout();
  }

  getHooks() {
    return {
      useAuthState: () => {
        return useSharedState(this._state);
      },
      useIsLoggedIn: () => {
        const data = useSharedStateValue(this._state);
        return !!(data && data.user);
      },
    };
  }

  getHttpClient() {
    if (!this._refreshTokenRoute)
      throw new Error("No refresh token route found!");
    this._client = createClient(this._refreshTokenRoute);
    return this._client;
  }
}
