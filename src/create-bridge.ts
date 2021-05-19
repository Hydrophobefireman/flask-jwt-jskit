import {
  State,
  createState,
  get,
  set,
  useSharedState,
  useSharedStateValue,
} from "statedrive";

import { Routes } from "./http-client/interfaces";
import { clear } from "./idb";
import { createClient } from "./http-client";
import {
  clearAuthenticationHeaders,
  getAuthenticationHeaders,
} from "./http-client/util";

export class Bridge<T extends { user: string }> {
  private readonly _state: State<T>;
  private _client: ReturnType<typeof createClient>;

  _routes: Routes;
  private _onLogout: () => void;

  constructor(authType: T) {
    this._state = createState({ initialValue: authType });
  }
  setRoutes(r: Routes) {
    this._routes = r;
  }

  onLogout(cb: () => void) {
    this._onLogout = cb;
  }

  updateState(s: T) {
    set(this._state, s);
  }
  getState(): T {
    return get(this._state);
  }
  login(user: string, password: string) {
    if (!this._client) throw new Error("No HTTP Client created!");
    if (!this._routes || !this._routes.loginRoute)
      throw new Error("No login route found!");
    const obj = { user, password };
    const request = this._client.postJSON(this._routes.loginRoute, obj);
    const { controller, result, headers } = request;
    return {
      controller,
      result: result.then((resp) => {
        const js: any = resp.data;
        const data = (resp as any).user_data || (js && js.user_data);
        if (data) {
          set(this._state, data);
        }
        return resp;
      }),
      headers,
    };
  }

  async syncWithServer() {
    if (!this._routes || !this._routes.initialAuthCheckRoute) {
      throw new Error("Auth check route not found!");
    }
    const headers: any = await getAuthenticationHeaders();
    if (!headers.Authorization) return;
    const cl = this.getHttpClient();

    const { result } = cl.get<{ user_data: T }>(
      this._routes.initialAuthCheckRoute
    );
    return result.then((js) => {
      if (js.data && js.data.user_data) {
        this.updateState(js.data.user_data);
      }
    });
  }

  logout() {
    clear();
    set(this._state, null);
    clearAuthenticationHeaders();
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
    if (this._client) return this._client;
    if (!this._routes || !this._routes.refreshTokenRoute)
      throw new Error("No refresh token route found!");
    this._client = createClient(
      this._routes.refreshTokenRoute,
      this.logout.bind(this)
    );
    return this._client;
  }
}
