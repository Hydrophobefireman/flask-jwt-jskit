import {get, set} from "./idb";
import {AppAuthState, AuthStorage} from "./types";

export class IDBAuthStorage<T> implements AuthStorage<T> {
  static STORAGE_KEY = "jskit::auth_state";
  constructor() {
    this.state = "WAIT";
  }
  state: "READY" | "WAIT";
  private _prom: Promise<unknown>;
  public onAuthStateChange(newAuth: AppAuthState<T> | null) {
    set(IDBAuthStorage.STORAGE_KEY, newAuth);
  }
  public wait() {
    return this._prom || Promise.resolve(null);
  }
  public async retrieveAuth(): Promise<AppAuthState<T>> {
    this.state = "WAIT";
    this._prom = get<AppAuthState<T>>(IDBAuthStorage.STORAGE_KEY);
    this._prom.then(() => {
      this.state = "READY";
    });
    return this._prom as any;
  }
}
