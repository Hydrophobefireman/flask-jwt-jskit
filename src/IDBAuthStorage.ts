import {get, set} from "./idb";
import {AppAuthState, AuthStorage} from "./types";

export class IDBAuthStorage<T> implements AuthStorage<T> {
  static STORAGE_KEY = "jskit::auth_state";
  constructor() {}
  public onAuthStateChange(newAuth: AppAuthState<T> | null) {
    set(IDBAuthStorage.STORAGE_KEY, newAuth);
  }
  public retrieveAuth(): Promise<AppAuthState<T>> {
    return get<AppAuthState<T>>(IDBAuthStorage.STORAGE_KEY);
  }
}
