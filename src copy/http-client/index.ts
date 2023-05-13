import {AbortableFetchResponse} from "./interfaces";
import {
  _del,
  _get,
  _getBinary,
  _getBinaryStream,
  _head,
  _patchJSON,
  _postBinary,
  _postJSON,
  _putJSON,
} from "./methods";
import {_awaitData, _headers} from "./util";

export function createClient(
  refreshAuthToken: string,
  onAuthError: () => void
) {
  const wrap = <T extends Array<any>, U>(fn: (...args: T) => U) => {
    function wrapped(...args: T): U;
    function wrapped(): U {
      const args = [].slice.call(arguments);
      const res: AbortableFetchResponse<unknown> = fn.apply(null, args);
      const resp = {
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
      } as unknown as U;

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
  const head = wrap(_head);
  const getBinaryStram = wrap(_getBinaryStream);
  return {
    get,
    head,
    postJSON,
    getBinary,
    getBinaryStram,
    postBinary,
    patchJSON,
    putJSON,
    del,
  };
}
