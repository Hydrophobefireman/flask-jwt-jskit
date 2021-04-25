import { _awaitData, _headers } from "./util";
import {
  _del,
  _get,
  _getBinary,
  _patchJSON,
  _postBinary,
  _postJSON,
  _putJSON,
} from "./methods";

import { AbortableFetchResponse } from "./interfaces";

export function createClient(
  refreshAuthToken: string,
  onAuthError: () => void
) {
  const wrap = <T extends Array<any>, U>(fn: (...args: T) => U) => {
    function wrapped(...args: T): U;
    function wrapped(): U {
      const args = [].slice.call(arguments);
      const res: AbortableFetchResponse<unknown> = fn.apply(null, args);
      const resp = ({
        controller: res.controller,

        result: res.result.then((js) => {
          if (js.error == "refresh") {
            return _get(refreshAuthToken).result.then((x) =>
              x.error ? x : fn.apply(null, args).result
            );
          }
          if (js.error == "re-auth") {
            return onAuthError();
          }
          return js;
        }),

        headers: res.headers,
      } as unknown) as U;

      return resp;
    }
    return wrapped;
  };

  const get = wrap(_get);
  const postJSON = wrap(_postJSON);
  const patchJSON = wrap(_patchJSON);
  const putJSON = wrap(_putJSON);
  const del = wrap(_del);
  const getBinary = wrap(_getBinary);
  const postBinary = wrap(_postBinary);
  return {
    get,
    postJSON,
    getBinary,
    postBinary,
    patchJSON,
    putJSON,
    del,
  };
}
