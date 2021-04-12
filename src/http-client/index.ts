import { AbortableFetchResponse } from "./interfaces";
import { _awaitData, _headers } from "./util";
import { _get, _getBinary, _postBinary, _postJSON } from "./methods";

export function createClient(refreshAuthToken: string) {
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
  const getBinary = wrap(_getBinary);
  const postBinary = wrap(_postBinary);
  return { get, postJSON, getBinary, postBinary };
}
