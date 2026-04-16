
import {Buffer} from "node:buffer";
globalThis.Buffer = Buffer;

import {AsyncLocalStorage} from "node:async_hooks";
globalThis.AsyncLocalStorage = AsyncLocalStorage;


const defaultDefineProperty = Object.defineProperty;
Object.defineProperty = function(o, p, a) {
  if(p=== '__import_unsupported' && Boolean(globalThis.__import_unsupported)) {
    return;
  }
  return defaultDefineProperty(o, p, a);
};

  
  
  globalThis.openNextDebug = false;globalThis.openNextVersion = "3.10.1";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/@opennextjs/aws/dist/utils/error.js
function isOpenNextError(e) {
  try {
    return "__openNextInternal" in e;
  } catch {
    return false;
  }
}
var init_error = __esm({
  "node_modules/@opennextjs/aws/dist/utils/error.js"() {
  }
});

// node_modules/@opennextjs/aws/dist/adapters/logger.js
function debug(...args) {
  if (globalThis.openNextDebug) {
    console.log(...args);
  }
}
function warn(...args) {
  console.warn(...args);
}
function error(...args) {
  if (args.some((arg) => isDownplayedErrorLog(arg))) {
    return debug(...args);
  }
  if (args.some((arg) => isOpenNextError(arg))) {
    const error2 = args.find((arg) => isOpenNextError(arg));
    if (error2.logLevel < getOpenNextErrorLogLevel()) {
      return;
    }
    if (error2.logLevel === 0) {
      return console.log(...args.map((arg) => isOpenNextError(arg) ? `${arg.name}: ${arg.message}` : arg));
    }
    if (error2.logLevel === 1) {
      return warn(...args.map((arg) => isOpenNextError(arg) ? `${arg.name}: ${arg.message}` : arg));
    }
    return console.error(...args);
  }
  console.error(...args);
}
function getOpenNextErrorLogLevel() {
  const strLevel = process.env.OPEN_NEXT_ERROR_LOG_LEVEL ?? "1";
  switch (strLevel.toLowerCase()) {
    case "debug":
    case "0":
      return 0;
    case "error":
    case "2":
      return 2;
    default:
      return 1;
  }
}
var DOWNPLAYED_ERROR_LOGS, isDownplayedErrorLog;
var init_logger = __esm({
  "node_modules/@opennextjs/aws/dist/adapters/logger.js"() {
    init_error();
    DOWNPLAYED_ERROR_LOGS = [
      {
        clientName: "S3Client",
        commandName: "GetObjectCommand",
        errorName: "NoSuchKey"
      }
    ];
    isDownplayedErrorLog = (errorLog) => DOWNPLAYED_ERROR_LOGS.some((downplayedInput) => downplayedInput.clientName === errorLog?.clientName && downplayedInput.commandName === errorLog?.commandName && (downplayedInput.errorName === errorLog?.error?.name || downplayedInput.errorName === errorLog?.error?.Code));
  }
});

// node_modules/cookie/dist/index.js
var require_dist = __commonJS({
  "node_modules/cookie/dist/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parseCookie = parseCookie;
    exports.parse = parseCookie;
    exports.stringifyCookie = stringifyCookie;
    exports.stringifySetCookie = stringifySetCookie;
    exports.serialize = stringifySetCookie;
    exports.parseSetCookie = parseSetCookie;
    exports.stringifySetCookie = stringifySetCookie;
    exports.serialize = stringifySetCookie;
    var cookieNameRegExp = /^[\u0021-\u003A\u003C\u003E-\u007E]+$/;
    var cookieValueRegExp = /^[\u0021-\u003A\u003C-\u007E]*$/;
    var domainValueRegExp = /^([.]?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    var pathValueRegExp = /^[\u0020-\u003A\u003D-\u007E]*$/;
    var maxAgeRegExp = /^-?\d+$/;
    var __toString = Object.prototype.toString;
    var NullObject = /* @__PURE__ */ (() => {
      const C = function() {
      };
      C.prototype = /* @__PURE__ */ Object.create(null);
      return C;
    })();
    function parseCookie(str, options) {
      const obj = new NullObject();
      const len = str.length;
      if (len < 2)
        return obj;
      const dec = options?.decode || decode;
      let index = 0;
      do {
        const eqIdx = eqIndex(str, index, len);
        if (eqIdx === -1)
          break;
        const endIdx = endIndex(str, index, len);
        if (eqIdx > endIdx) {
          index = str.lastIndexOf(";", eqIdx - 1) + 1;
          continue;
        }
        const key = valueSlice(str, index, eqIdx);
        if (obj[key] === void 0) {
          obj[key] = dec(valueSlice(str, eqIdx + 1, endIdx));
        }
        index = endIdx + 1;
      } while (index < len);
      return obj;
    }
    function stringifyCookie(cookie, options) {
      const enc = options?.encode || encodeURIComponent;
      const cookieStrings = [];
      for (const name of Object.keys(cookie)) {
        const val = cookie[name];
        if (val === void 0)
          continue;
        if (!cookieNameRegExp.test(name)) {
          throw new TypeError(`cookie name is invalid: ${name}`);
        }
        const value = enc(val);
        if (!cookieValueRegExp.test(value)) {
          throw new TypeError(`cookie val is invalid: ${val}`);
        }
        cookieStrings.push(`${name}=${value}`);
      }
      return cookieStrings.join("; ");
    }
    function stringifySetCookie(_name, _val, _opts) {
      const cookie = typeof _name === "object" ? _name : { ..._opts, name: _name, value: String(_val) };
      const options = typeof _val === "object" ? _val : _opts;
      const enc = options?.encode || encodeURIComponent;
      if (!cookieNameRegExp.test(cookie.name)) {
        throw new TypeError(`argument name is invalid: ${cookie.name}`);
      }
      const value = cookie.value ? enc(cookie.value) : "";
      if (!cookieValueRegExp.test(value)) {
        throw new TypeError(`argument val is invalid: ${cookie.value}`);
      }
      let str = cookie.name + "=" + value;
      if (cookie.maxAge !== void 0) {
        if (!Number.isInteger(cookie.maxAge)) {
          throw new TypeError(`option maxAge is invalid: ${cookie.maxAge}`);
        }
        str += "; Max-Age=" + cookie.maxAge;
      }
      if (cookie.domain) {
        if (!domainValueRegExp.test(cookie.domain)) {
          throw new TypeError(`option domain is invalid: ${cookie.domain}`);
        }
        str += "; Domain=" + cookie.domain;
      }
      if (cookie.path) {
        if (!pathValueRegExp.test(cookie.path)) {
          throw new TypeError(`option path is invalid: ${cookie.path}`);
        }
        str += "; Path=" + cookie.path;
      }
      if (cookie.expires) {
        if (!isDate(cookie.expires) || !Number.isFinite(cookie.expires.valueOf())) {
          throw new TypeError(`option expires is invalid: ${cookie.expires}`);
        }
        str += "; Expires=" + cookie.expires.toUTCString();
      }
      if (cookie.httpOnly) {
        str += "; HttpOnly";
      }
      if (cookie.secure) {
        str += "; Secure";
      }
      if (cookie.partitioned) {
        str += "; Partitioned";
      }
      if (cookie.priority) {
        const priority = typeof cookie.priority === "string" ? cookie.priority.toLowerCase() : void 0;
        switch (priority) {
          case "low":
            str += "; Priority=Low";
            break;
          case "medium":
            str += "; Priority=Medium";
            break;
          case "high":
            str += "; Priority=High";
            break;
          default:
            throw new TypeError(`option priority is invalid: ${cookie.priority}`);
        }
      }
      if (cookie.sameSite) {
        const sameSite = typeof cookie.sameSite === "string" ? cookie.sameSite.toLowerCase() : cookie.sameSite;
        switch (sameSite) {
          case true:
          case "strict":
            str += "; SameSite=Strict";
            break;
          case "lax":
            str += "; SameSite=Lax";
            break;
          case "none":
            str += "; SameSite=None";
            break;
          default:
            throw new TypeError(`option sameSite is invalid: ${cookie.sameSite}`);
        }
      }
      return str;
    }
    function parseSetCookie(str, options) {
      const dec = options?.decode || decode;
      const len = str.length;
      const endIdx = endIndex(str, 0, len);
      const eqIdx = eqIndex(str, 0, endIdx);
      const setCookie = eqIdx === -1 ? { name: "", value: dec(valueSlice(str, 0, endIdx)) } : {
        name: valueSlice(str, 0, eqIdx),
        value: dec(valueSlice(str, eqIdx + 1, endIdx))
      };
      let index = endIdx + 1;
      while (index < len) {
        const endIdx2 = endIndex(str, index, len);
        const eqIdx2 = eqIndex(str, index, endIdx2);
        const attr = eqIdx2 === -1 ? valueSlice(str, index, endIdx2) : valueSlice(str, index, eqIdx2);
        const val = eqIdx2 === -1 ? void 0 : valueSlice(str, eqIdx2 + 1, endIdx2);
        switch (attr.toLowerCase()) {
          case "httponly":
            setCookie.httpOnly = true;
            break;
          case "secure":
            setCookie.secure = true;
            break;
          case "partitioned":
            setCookie.partitioned = true;
            break;
          case "domain":
            setCookie.domain = val;
            break;
          case "path":
            setCookie.path = val;
            break;
          case "max-age":
            if (val && maxAgeRegExp.test(val))
              setCookie.maxAge = Number(val);
            break;
          case "expires":
            if (!val)
              break;
            const date = new Date(val);
            if (Number.isFinite(date.valueOf()))
              setCookie.expires = date;
            break;
          case "priority":
            if (!val)
              break;
            const priority = val.toLowerCase();
            if (priority === "low" || priority === "medium" || priority === "high") {
              setCookie.priority = priority;
            }
            break;
          case "samesite":
            if (!val)
              break;
            const sameSite = val.toLowerCase();
            if (sameSite === "lax" || sameSite === "strict" || sameSite === "none") {
              setCookie.sameSite = sameSite;
            }
            break;
        }
        index = endIdx2 + 1;
      }
      return setCookie;
    }
    function endIndex(str, min, len) {
      const index = str.indexOf(";", min);
      return index === -1 ? len : index;
    }
    function eqIndex(str, min, max) {
      const index = str.indexOf("=", min);
      return index < max ? index : -1;
    }
    function valueSlice(str, min, max) {
      let start = min;
      let end = max;
      do {
        const code = str.charCodeAt(start);
        if (code !== 32 && code !== 9)
          break;
      } while (++start < end);
      while (end > start) {
        const code = str.charCodeAt(end - 1);
        if (code !== 32 && code !== 9)
          break;
        end--;
      }
      return str.slice(start, end);
    }
    function decode(str) {
      if (str.indexOf("%") === -1)
        return str;
      try {
        return decodeURIComponent(str);
      } catch (e) {
        return str;
      }
    }
    function isDate(val) {
      return __toString.call(val) === "[object Date]";
    }
  }
});

// node_modules/@opennextjs/aws/dist/http/util.js
function parseSetCookieHeader(cookies) {
  if (!cookies) {
    return [];
  }
  if (typeof cookies === "string") {
    return cookies.split(/(?<!Expires=\w+),/i).map((c) => c.trim());
  }
  return cookies;
}
function getQueryFromIterator(it) {
  const query = {};
  for (const [key, value] of it) {
    if (key in query) {
      if (Array.isArray(query[key])) {
        query[key].push(value);
      } else {
        query[key] = [query[key], value];
      }
    } else {
      query[key] = value;
    }
  }
  return query;
}
var init_util = __esm({
  "node_modules/@opennextjs/aws/dist/http/util.js"() {
    init_logger();
  }
});

// node_modules/@opennextjs/aws/dist/overrides/converters/utils.js
function getQueryFromSearchParams(searchParams) {
  return getQueryFromIterator(searchParams.entries());
}
var init_utils = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/converters/utils.js"() {
    init_util();
  }
});

// node_modules/@opennextjs/aws/dist/overrides/converters/edge.js
var edge_exports = {};
__export(edge_exports, {
  default: () => edge_default
});
import { Buffer as Buffer2 } from "node:buffer";
var import_cookie, NULL_BODY_STATUSES, converter, edge_default;
var init_edge = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/converters/edge.js"() {
    import_cookie = __toESM(require_dist(), 1);
    init_util();
    init_utils();
    NULL_BODY_STATUSES = /* @__PURE__ */ new Set([101, 103, 204, 205, 304]);
    converter = {
      convertFrom: async (event) => {
        const url = new URL(event.url);
        const searchParams = url.searchParams;
        const query = getQueryFromSearchParams(searchParams);
        const headers = {};
        event.headers.forEach((value, key) => {
          headers[key] = value;
        });
        const rawPath = url.pathname;
        const method = event.method;
        const shouldHaveBody = method !== "GET" && method !== "HEAD";
        const body = shouldHaveBody ? Buffer2.from(await event.arrayBuffer()) : void 0;
        const cookieHeader = event.headers.get("cookie");
        const cookies = cookieHeader ? import_cookie.default.parse(cookieHeader) : {};
        return {
          type: "core",
          method,
          rawPath,
          url: event.url,
          body,
          headers,
          remoteAddress: event.headers.get("x-forwarded-for") ?? "::1",
          query,
          cookies
        };
      },
      convertTo: async (result) => {
        if ("internalEvent" in result) {
          const request = new Request(result.internalEvent.url, {
            body: result.internalEvent.body,
            method: result.internalEvent.method,
            headers: {
              ...result.internalEvent.headers,
              "x-forwarded-host": result.internalEvent.headers.host
            }
          });
          if (globalThis.__dangerous_ON_edge_converter_returns_request === true) {
            return request;
          }
          const cfCache = (result.isISR || result.internalEvent.rawPath.startsWith("/_next/image")) && process.env.DISABLE_CACHE !== "true" ? { cacheEverything: true } : {};
          return fetch(request, {
            // This is a hack to make sure that the response is cached by Cloudflare
            // See https://developers.cloudflare.com/workers/examples/cache-using-fetch/#caching-html-resources
            // @ts-expect-error - This is a Cloudflare specific option
            cf: cfCache
          });
        }
        const headers = new Headers();
        for (const [key, value] of Object.entries(result.headers)) {
          if (key === "set-cookie" && typeof value === "string") {
            const cookies = parseSetCookieHeader(value);
            for (const cookie of cookies) {
              headers.append(key, cookie);
            }
            continue;
          }
          if (Array.isArray(value)) {
            for (const v of value) {
              headers.append(key, v);
            }
          } else {
            headers.set(key, value);
          }
        }
        const body = NULL_BODY_STATUSES.has(result.statusCode) ? null : result.body;
        return new Response(body, {
          status: result.statusCode,
          headers
        });
      },
      name: "edge"
    };
    edge_default = converter;
  }
});

// node_modules/@opennextjs/aws/dist/overrides/wrappers/cloudflare-edge.js
var cloudflare_edge_exports = {};
__export(cloudflare_edge_exports, {
  default: () => cloudflare_edge_default
});
var cfPropNameMapping, handler, cloudflare_edge_default;
var init_cloudflare_edge = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/wrappers/cloudflare-edge.js"() {
    cfPropNameMapping = {
      // The city name is percent-encoded.
      // See https://github.com/vercel/vercel/blob/4cb6143/packages/functions/src/headers.ts#L94C19-L94C37
      city: [encodeURIComponent, "x-open-next-city"],
      country: "x-open-next-country",
      regionCode: "x-open-next-region",
      latitude: "x-open-next-latitude",
      longitude: "x-open-next-longitude"
    };
    handler = async (handler3, converter2) => async (request, env, ctx) => {
      globalThis.process = process;
      for (const [key, value] of Object.entries(env)) {
        if (typeof value === "string") {
          process.env[key] = value;
        }
      }
      const internalEvent = await converter2.convertFrom(request);
      const cfProperties = request.cf;
      for (const [propName, mapping] of Object.entries(cfPropNameMapping)) {
        const propValue = cfProperties?.[propName];
        if (propValue != null) {
          const [encode, headerName] = Array.isArray(mapping) ? mapping : [null, mapping];
          internalEvent.headers[headerName] = encode ? encode(propValue) : propValue;
        }
      }
      const response = await handler3(internalEvent, {
        waitUntil: ctx.waitUntil.bind(ctx)
      });
      const result = await converter2.convertTo(response);
      return result;
    };
    cloudflare_edge_default = {
      wrapper: handler,
      name: "cloudflare-edge",
      supportStreaming: true,
      edgeRuntime: true
    };
  }
});

// node_modules/@opennextjs/aws/dist/overrides/originResolver/pattern-env.js
var pattern_env_exports = {};
__export(pattern_env_exports, {
  default: () => pattern_env_default
});
function initializeOnce() {
  if (initialized)
    return;
  cachedOrigins = JSON.parse(process.env.OPEN_NEXT_ORIGIN ?? "{}");
  const functions = globalThis.openNextConfig.functions ?? {};
  for (const key in functions) {
    if (key !== "default") {
      const value = functions[key];
      const regexes = [];
      for (const pattern of value.patterns) {
        const regexPattern = `/${pattern.replace(/\*\*/g, "(.*)").replace(/\*/g, "([^/]*)").replace(/\//g, "\\/").replace(/\?/g, ".")}`;
        regexes.push(new RegExp(regexPattern));
      }
      cachedPatterns.push({
        key,
        patterns: value.patterns,
        regexes
      });
    }
  }
  initialized = true;
}
var cachedOrigins, cachedPatterns, initialized, envLoader, pattern_env_default;
var init_pattern_env = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/originResolver/pattern-env.js"() {
    init_logger();
    cachedPatterns = [];
    initialized = false;
    envLoader = {
      name: "env",
      resolve: async (_path) => {
        try {
          initializeOnce();
          for (const { key, patterns, regexes } of cachedPatterns) {
            for (const regex of regexes) {
              if (regex.test(_path)) {
                debug("Using origin", key, patterns);
                return cachedOrigins[key];
              }
            }
          }
          if (_path.startsWith("/_next/image") && cachedOrigins.imageOptimizer) {
            debug("Using origin", "imageOptimizer", _path);
            return cachedOrigins.imageOptimizer;
          }
          if (cachedOrigins.default) {
            debug("Using default origin", cachedOrigins.default, _path);
            return cachedOrigins.default;
          }
          return false;
        } catch (e) {
          error("Error while resolving origin", e);
          return false;
        }
      }
    };
    pattern_env_default = envLoader;
  }
});

// node_modules/@opennextjs/aws/dist/overrides/assetResolver/dummy.js
var dummy_exports = {};
__export(dummy_exports, {
  default: () => dummy_default
});
var resolver, dummy_default;
var init_dummy = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/assetResolver/dummy.js"() {
    resolver = {
      name: "dummy"
    };
    dummy_default = resolver;
  }
});

// node_modules/@opennextjs/aws/dist/utils/stream.js
import { ReadableStream as ReadableStream2 } from "node:stream/web";
function toReadableStream(value, isBase64) {
  return new ReadableStream2({
    pull(controller) {
      controller.enqueue(Buffer.from(value, isBase64 ? "base64" : "utf8"));
      controller.close();
    }
  }, { highWaterMark: 0 });
}
function emptyReadableStream() {
  if (process.env.OPEN_NEXT_FORCE_NON_EMPTY_RESPONSE === "true") {
    return new ReadableStream2({
      pull(controller) {
        maybeSomethingBuffer ??= Buffer.from("SOMETHING");
        controller.enqueue(maybeSomethingBuffer);
        controller.close();
      }
    }, { highWaterMark: 0 });
  }
  return new ReadableStream2({
    start(controller) {
      controller.close();
    }
  });
}
var maybeSomethingBuffer;
var init_stream = __esm({
  "node_modules/@opennextjs/aws/dist/utils/stream.js"() {
  }
});

// node_modules/@opennextjs/aws/dist/overrides/proxyExternalRequest/fetch.js
var fetch_exports = {};
__export(fetch_exports, {
  default: () => fetch_default
});
var fetchProxy, fetch_default;
var init_fetch = __esm({
  "node_modules/@opennextjs/aws/dist/overrides/proxyExternalRequest/fetch.js"() {
    init_stream();
    fetchProxy = {
      name: "fetch-proxy",
      // @ts-ignore
      proxy: async (internalEvent) => {
        const { url, headers: eventHeaders, method, body } = internalEvent;
        const headers = Object.fromEntries(Object.entries(eventHeaders).filter(([key]) => key.toLowerCase() !== "cf-connecting-ip"));
        const response = await fetch(url, {
          method,
          headers,
          body
        });
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
          const cur = responseHeaders[key];
          if (cur === void 0) {
            responseHeaders[key] = value;
          } else if (Array.isArray(cur)) {
            cur.push(value);
          } else {
            responseHeaders[key] = [cur, value];
          }
        });
        return {
          type: "core",
          headers: responseHeaders,
          statusCode: response.status,
          isBase64Encoded: true,
          body: response.body ?? emptyReadableStream()
        };
      }
    };
    fetch_default = fetchProxy;
  }
});

// .next/server/edge-runtime-webpack.js
var require_edge_runtime_webpack = __commonJS({
  ".next/server/edge-runtime-webpack.js"() {
    "use strict";
    (() => {
      "use strict";
      var a, b, c, d, e = {}, f = {};
      function g(a2) {
        var b2 = f[a2];
        if (void 0 !== b2) return b2.exports;
        var c2 = f[a2] = { exports: {} }, d2 = true;
        try {
          e[a2](c2, c2.exports, g), d2 = false;
        } finally {
          d2 && delete f[a2];
        }
        return c2.exports;
      }
      g.m = e, g.amdO = {}, a = [], g.O = (b2, c2, d2, e2) => {
        if (c2) {
          e2 = e2 || 0;
          for (var f2 = a.length; f2 > 0 && a[f2 - 1][2] > e2; f2--) a[f2] = a[f2 - 1];
          a[f2] = [c2, d2, e2];
          return;
        }
        for (var h = 1 / 0, f2 = 0; f2 < a.length; f2++) {
          for (var [c2, d2, e2] = a[f2], i = true, j = 0; j < c2.length; j++) (false & e2 || h >= e2) && Object.keys(g.O).every((a2) => g.O[a2](c2[j])) ? c2.splice(j--, 1) : (i = false, e2 < h && (h = e2));
          if (i) {
            a.splice(f2--, 1);
            var k = d2();
            void 0 !== k && (b2 = k);
          }
        }
        return b2;
      }, g.n = (a2) => {
        var b2 = a2 && a2.__esModule ? () => a2.default : () => a2;
        return g.d(b2, { a: b2 }), b2;
      }, g.d = (a2, b2) => {
        for (var c2 in b2) g.o(b2, c2) && !g.o(a2, c2) && Object.defineProperty(a2, c2, { enumerable: true, get: b2[c2] });
      }, g.g = function() {
        if ("object" == typeof globalThis) return globalThis;
        try {
          return this || Function("return this")();
        } catch (a2) {
          if ("object" == typeof window) return window;
        }
      }(), g.o = (a2, b2) => Object.prototype.hasOwnProperty.call(a2, b2), g.r = (a2) => {
        "u" > typeof Symbol && Symbol.toStringTag && Object.defineProperty(a2, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(a2, "__esModule", { value: true });
      }, b = { 149: 0 }, g.O.j = (a2) => 0 === b[a2], c = (a2, c2) => {
        var d2, e2, [f2, h, i] = c2, j = 0;
        if (f2.some((a3) => 0 !== b[a3])) {
          for (d2 in h) g.o(h, d2) && (g.m[d2] = h[d2]);
          if (i) var k = i(g);
        }
        for (a2 && a2(c2); j < f2.length; j++) e2 = f2[j], g.o(b, e2) && b[e2] && b[e2][0](), b[e2] = 0;
        return g.O(k);
      }, (d = self.webpackChunk_N_E = self.webpackChunk_N_E || []).forEach(c.bind(null, 0)), d.push = c.bind(null, d.push.bind(d));
    })();
  }
});

// node-built-in-modules:node:buffer
var node_buffer_exports = {};
import * as node_buffer_star from "node:buffer";
var init_node_buffer = __esm({
  "node-built-in-modules:node:buffer"() {
    __reExport(node_buffer_exports, node_buffer_star);
  }
});

// node-built-in-modules:node:async_hooks
var node_async_hooks_exports = {};
import * as node_async_hooks_star from "node:async_hooks";
var init_node_async_hooks = __esm({
  "node-built-in-modules:node:async_hooks"() {
    __reExport(node_async_hooks_exports, node_async_hooks_star);
  }
});

// .next/server/middleware.js
var require_middleware = __commonJS({
  ".next/server/middleware.js"() {
    "use strict";
    (self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([[751], { 42: (a) => {
      !function() {
        "use strict";
        var b = { 114: function(a2) {
          function b2(a3) {
            if ("string" != typeof a3) throw TypeError("Path must be a string. Received " + JSON.stringify(a3));
          }
          function c2(a3, b3) {
            for (var c3, d3 = "", e = 0, f = -1, g = 0, h = 0; h <= a3.length; ++h) {
              if (h < a3.length) c3 = a3.charCodeAt(h);
              else if (47 === c3) break;
              else c3 = 47;
              if (47 === c3) {
                if (f === h - 1 || 1 === g) ;
                else if (f !== h - 1 && 2 === g) {
                  if (d3.length < 2 || 2 !== e || 46 !== d3.charCodeAt(d3.length - 1) || 46 !== d3.charCodeAt(d3.length - 2)) {
                    if (d3.length > 2) {
                      var i = d3.lastIndexOf("/");
                      if (i !== d3.length - 1) {
                        -1 === i ? (d3 = "", e = 0) : e = (d3 = d3.slice(0, i)).length - 1 - d3.lastIndexOf("/"), f = h, g = 0;
                        continue;
                      }
                    } else if (2 === d3.length || 1 === d3.length) {
                      d3 = "", e = 0, f = h, g = 0;
                      continue;
                    }
                  }
                  b3 && (d3.length > 0 ? d3 += "/.." : d3 = "..", e = 2);
                } else d3.length > 0 ? d3 += "/" + a3.slice(f + 1, h) : d3 = a3.slice(f + 1, h), e = h - f - 1;
                f = h, g = 0;
              } else 46 === c3 && -1 !== g ? ++g : g = -1;
            }
            return d3;
          }
          var d2 = { resolve: function() {
            for (var a3, d3, e = "", f = false, g = arguments.length - 1; g >= -1 && !f; g--) g >= 0 ? d3 = arguments[g] : (void 0 === a3 && (a3 = ""), d3 = a3), b2(d3), 0 !== d3.length && (e = d3 + "/" + e, f = 47 === d3.charCodeAt(0));
            if (e = c2(e, !f), f) if (e.length > 0) return "/" + e;
            else return "/";
            return e.length > 0 ? e : ".";
          }, normalize: function(a3) {
            if (b2(a3), 0 === a3.length) return ".";
            var d3 = 47 === a3.charCodeAt(0), e = 47 === a3.charCodeAt(a3.length - 1);
            return (0 !== (a3 = c2(a3, !d3)).length || d3 || (a3 = "."), a3.length > 0 && e && (a3 += "/"), d3) ? "/" + a3 : a3;
          }, isAbsolute: function(a3) {
            return b2(a3), a3.length > 0 && 47 === a3.charCodeAt(0);
          }, join: function() {
            if (0 == arguments.length) return ".";
            for (var a3, c3 = 0; c3 < arguments.length; ++c3) {
              var e = arguments[c3];
              b2(e), e.length > 0 && (void 0 === a3 ? a3 = e : a3 += "/" + e);
            }
            return void 0 === a3 ? "." : d2.normalize(a3);
          }, relative: function(a3, c3) {
            if (b2(a3), b2(c3), a3 === c3 || (a3 = d2.resolve(a3)) === (c3 = d2.resolve(c3))) return "";
            for (var e = 1; e < a3.length && 47 === a3.charCodeAt(e); ++e) ;
            for (var f = a3.length, g = f - e, h = 1; h < c3.length && 47 === c3.charCodeAt(h); ++h) ;
            for (var i = c3.length - h, j = g < i ? g : i, k = -1, l = 0; l <= j; ++l) {
              if (l === j) {
                if (i > j) {
                  if (47 === c3.charCodeAt(h + l)) return c3.slice(h + l + 1);
                  else if (0 === l) return c3.slice(h + l);
                } else g > j && (47 === a3.charCodeAt(e + l) ? k = l : 0 === l && (k = 0));
                break;
              }
              var m = a3.charCodeAt(e + l);
              if (m !== c3.charCodeAt(h + l)) break;
              47 === m && (k = l);
            }
            var n = "";
            for (l = e + k + 1; l <= f; ++l) (l === f || 47 === a3.charCodeAt(l)) && (0 === n.length ? n += ".." : n += "/..");
            return n.length > 0 ? n + c3.slice(h + k) : (h += k, 47 === c3.charCodeAt(h) && ++h, c3.slice(h));
          }, _makeLong: function(a3) {
            return a3;
          }, dirname: function(a3) {
            if (b2(a3), 0 === a3.length) return ".";
            for (var c3 = a3.charCodeAt(0), d3 = 47 === c3, e = -1, f = true, g = a3.length - 1; g >= 1; --g) if (47 === (c3 = a3.charCodeAt(g))) {
              if (!f) {
                e = g;
                break;
              }
            } else f = false;
            return -1 === e ? d3 ? "/" : "." : d3 && 1 === e ? "//" : a3.slice(0, e);
          }, basename: function(a3, c3) {
            if (void 0 !== c3 && "string" != typeof c3) throw TypeError('"ext" argument must be a string');
            b2(a3);
            var d3, e = 0, f = -1, g = true;
            if (void 0 !== c3 && c3.length > 0 && c3.length <= a3.length) {
              if (c3.length === a3.length && c3 === a3) return "";
              var h = c3.length - 1, i = -1;
              for (d3 = a3.length - 1; d3 >= 0; --d3) {
                var j = a3.charCodeAt(d3);
                if (47 === j) {
                  if (!g) {
                    e = d3 + 1;
                    break;
                  }
                } else -1 === i && (g = false, i = d3 + 1), h >= 0 && (j === c3.charCodeAt(h) ? -1 == --h && (f = d3) : (h = -1, f = i));
              }
              return e === f ? f = i : -1 === f && (f = a3.length), a3.slice(e, f);
            }
            for (d3 = a3.length - 1; d3 >= 0; --d3) if (47 === a3.charCodeAt(d3)) {
              if (!g) {
                e = d3 + 1;
                break;
              }
            } else -1 === f && (g = false, f = d3 + 1);
            return -1 === f ? "" : a3.slice(e, f);
          }, extname: function(a3) {
            b2(a3);
            for (var c3 = -1, d3 = 0, e = -1, f = true, g = 0, h = a3.length - 1; h >= 0; --h) {
              var i = a3.charCodeAt(h);
              if (47 === i) {
                if (!f) {
                  d3 = h + 1;
                  break;
                }
                continue;
              }
              -1 === e && (f = false, e = h + 1), 46 === i ? -1 === c3 ? c3 = h : 1 !== g && (g = 1) : -1 !== c3 && (g = -1);
            }
            return -1 === c3 || -1 === e || 0 === g || 1 === g && c3 === e - 1 && c3 === d3 + 1 ? "" : a3.slice(c3, e);
          }, format: function(a3) {
            var b3, c3;
            if (null === a3 || "object" != typeof a3) throw TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof a3);
            return b3 = a3.dir || a3.root, c3 = a3.base || (a3.name || "") + (a3.ext || ""), b3 ? b3 === a3.root ? b3 + c3 : b3 + "/" + c3 : c3;
          }, parse: function(a3) {
            b2(a3);
            var c3, d3 = { root: "", dir: "", base: "", ext: "", name: "" };
            if (0 === a3.length) return d3;
            var e = a3.charCodeAt(0), f = 47 === e;
            f ? (d3.root = "/", c3 = 1) : c3 = 0;
            for (var g = -1, h = 0, i = -1, j = true, k = a3.length - 1, l = 0; k >= c3; --k) {
              if (47 === (e = a3.charCodeAt(k))) {
                if (!j) {
                  h = k + 1;
                  break;
                }
                continue;
              }
              -1 === i && (j = false, i = k + 1), 46 === e ? -1 === g ? g = k : 1 !== l && (l = 1) : -1 !== g && (l = -1);
            }
            return -1 === g || -1 === i || 0 === l || 1 === l && g === i - 1 && g === h + 1 ? -1 !== i && (0 === h && f ? d3.base = d3.name = a3.slice(1, i) : d3.base = d3.name = a3.slice(h, i)) : (0 === h && f ? (d3.name = a3.slice(1, g), d3.base = a3.slice(1, i)) : (d3.name = a3.slice(h, g), d3.base = a3.slice(h, i)), d3.ext = a3.slice(g, i)), h > 0 ? d3.dir = a3.slice(0, h - 1) : f && (d3.dir = "/"), d3;
          }, sep: "/", delimiter: ":", win32: null, posix: null };
          d2.posix = d2, a2.exports = d2;
        } }, c = {};
        function d(a2) {
          var e = c[a2];
          if (void 0 !== e) return e.exports;
          var f = c[a2] = { exports: {} }, g = true;
          try {
            b[a2](f, f.exports, d), g = false;
          } finally {
            g && delete c[a2];
          }
          return f.exports;
        }
        d.ab = "//", a.exports = d(114);
      }();
    }, 232: (a) => {
      (() => {
        "use strict";
        var b = { 993: (a2) => {
          var b2 = Object.prototype.hasOwnProperty, c2 = "~";
          function d2() {
          }
          function e2(a3, b3, c3) {
            this.fn = a3, this.context = b3, this.once = c3 || false;
          }
          function f(a3, b3, d3, f2, g2) {
            if ("function" != typeof d3) throw TypeError("The listener must be a function");
            var h2 = new e2(d3, f2 || a3, g2), i = c2 ? c2 + b3 : b3;
            return a3._events[i] ? a3._events[i].fn ? a3._events[i] = [a3._events[i], h2] : a3._events[i].push(h2) : (a3._events[i] = h2, a3._eventsCount++), a3;
          }
          function g(a3, b3) {
            0 == --a3._eventsCount ? a3._events = new d2() : delete a3._events[b3];
          }
          function h() {
            this._events = new d2(), this._eventsCount = 0;
          }
          Object.create && (d2.prototype = /* @__PURE__ */ Object.create(null), new d2().__proto__ || (c2 = false)), h.prototype.eventNames = function() {
            var a3, d3, e3 = [];
            if (0 === this._eventsCount) return e3;
            for (d3 in a3 = this._events) b2.call(a3, d3) && e3.push(c2 ? d3.slice(1) : d3);
            return Object.getOwnPropertySymbols ? e3.concat(Object.getOwnPropertySymbols(a3)) : e3;
          }, h.prototype.listeners = function(a3) {
            var b3 = c2 ? c2 + a3 : a3, d3 = this._events[b3];
            if (!d3) return [];
            if (d3.fn) return [d3.fn];
            for (var e3 = 0, f2 = d3.length, g2 = Array(f2); e3 < f2; e3++) g2[e3] = d3[e3].fn;
            return g2;
          }, h.prototype.listenerCount = function(a3) {
            var b3 = c2 ? c2 + a3 : a3, d3 = this._events[b3];
            return d3 ? d3.fn ? 1 : d3.length : 0;
          }, h.prototype.emit = function(a3, b3, d3, e3, f2, g2) {
            var h2 = c2 ? c2 + a3 : a3;
            if (!this._events[h2]) return false;
            var i, j, k = this._events[h2], l = arguments.length;
            if (k.fn) {
              switch (k.once && this.removeListener(a3, k.fn, void 0, true), l) {
                case 1:
                  return k.fn.call(k.context), true;
                case 2:
                  return k.fn.call(k.context, b3), true;
                case 3:
                  return k.fn.call(k.context, b3, d3), true;
                case 4:
                  return k.fn.call(k.context, b3, d3, e3), true;
                case 5:
                  return k.fn.call(k.context, b3, d3, e3, f2), true;
                case 6:
                  return k.fn.call(k.context, b3, d3, e3, f2, g2), true;
              }
              for (j = 1, i = Array(l - 1); j < l; j++) i[j - 1] = arguments[j];
              k.fn.apply(k.context, i);
            } else {
              var m, n = k.length;
              for (j = 0; j < n; j++) switch (k[j].once && this.removeListener(a3, k[j].fn, void 0, true), l) {
                case 1:
                  k[j].fn.call(k[j].context);
                  break;
                case 2:
                  k[j].fn.call(k[j].context, b3);
                  break;
                case 3:
                  k[j].fn.call(k[j].context, b3, d3);
                  break;
                case 4:
                  k[j].fn.call(k[j].context, b3, d3, e3);
                  break;
                default:
                  if (!i) for (m = 1, i = Array(l - 1); m < l; m++) i[m - 1] = arguments[m];
                  k[j].fn.apply(k[j].context, i);
              }
            }
            return true;
          }, h.prototype.on = function(a3, b3, c3) {
            return f(this, a3, b3, c3, false);
          }, h.prototype.once = function(a3, b3, c3) {
            return f(this, a3, b3, c3, true);
          }, h.prototype.removeListener = function(a3, b3, d3, e3) {
            var f2 = c2 ? c2 + a3 : a3;
            if (!this._events[f2]) return this;
            if (!b3) return g(this, f2), this;
            var h2 = this._events[f2];
            if (h2.fn) h2.fn !== b3 || e3 && !h2.once || d3 && h2.context !== d3 || g(this, f2);
            else {
              for (var i = 0, j = [], k = h2.length; i < k; i++) (h2[i].fn !== b3 || e3 && !h2[i].once || d3 && h2[i].context !== d3) && j.push(h2[i]);
              j.length ? this._events[f2] = 1 === j.length ? j[0] : j : g(this, f2);
            }
            return this;
          }, h.prototype.removeAllListeners = function(a3) {
            var b3;
            return a3 ? (b3 = c2 ? c2 + a3 : a3, this._events[b3] && g(this, b3)) : (this._events = new d2(), this._eventsCount = 0), this;
          }, h.prototype.off = h.prototype.removeListener, h.prototype.addListener = h.prototype.on, h.prefixed = c2, h.EventEmitter = h, a2.exports = h;
        }, 213: (a2) => {
          a2.exports = (a3, b2) => (b2 = b2 || (() => {
          }), a3.then((a4) => new Promise((a5) => {
            a5(b2());
          }).then(() => a4), (a4) => new Promise((a5) => {
            a5(b2());
          }).then(() => {
            throw a4;
          })));
        }, 574: (a2, b2) => {
          Object.defineProperty(b2, "__esModule", { value: true }), b2.default = function(a3, b3, c2) {
            let d2 = 0, e2 = a3.length;
            for (; e2 > 0; ) {
              let f = e2 / 2 | 0, g = d2 + f;
              0 >= c2(a3[g], b3) ? (d2 = ++g, e2 -= f + 1) : e2 = f;
            }
            return d2;
          };
        }, 821: (a2, b2, c2) => {
          Object.defineProperty(b2, "__esModule", { value: true });
          let d2 = c2(574);
          class e2 {
            constructor() {
              this._queue = [];
            }
            enqueue(a3, b3) {
              let c3 = { priority: (b3 = Object.assign({ priority: 0 }, b3)).priority, run: a3 };
              if (this.size && this._queue[this.size - 1].priority >= b3.priority) return void this._queue.push(c3);
              let e3 = d2.default(this._queue, c3, (a4, b4) => b4.priority - a4.priority);
              this._queue.splice(e3, 0, c3);
            }
            dequeue() {
              let a3 = this._queue.shift();
              return null == a3 ? void 0 : a3.run;
            }
            filter(a3) {
              return this._queue.filter((b3) => b3.priority === a3.priority).map((a4) => a4.run);
            }
            get size() {
              return this._queue.length;
            }
          }
          b2.default = e2;
        }, 816: (a2, b2, c2) => {
          let d2 = c2(213);
          class e2 extends Error {
            constructor(a3) {
              super(a3), this.name = "TimeoutError";
            }
          }
          let f = (a3, b3, c3) => new Promise((f2, g) => {
            if ("number" != typeof b3 || b3 < 0) throw TypeError("Expected `milliseconds` to be a positive number");
            if (b3 === 1 / 0) return void f2(a3);
            let h = setTimeout(() => {
              if ("function" == typeof c3) {
                try {
                  f2(c3());
                } catch (a4) {
                  g(a4);
                }
                return;
              }
              let d3 = "string" == typeof c3 ? c3 : `Promise timed out after ${b3} milliseconds`, h2 = c3 instanceof Error ? c3 : new e2(d3);
              "function" == typeof a3.cancel && a3.cancel(), g(h2);
            }, b3);
            d2(a3.then(f2, g), () => {
              clearTimeout(h);
            });
          });
          a2.exports = f, a2.exports.default = f, a2.exports.TimeoutError = e2;
        } }, c = {};
        function d(a2) {
          var e2 = c[a2];
          if (void 0 !== e2) return e2.exports;
          var f = c[a2] = { exports: {} }, g = true;
          try {
            b[a2](f, f.exports, d), g = false;
          } finally {
            g && delete c[a2];
          }
          return f.exports;
        }
        d.ab = "//";
        var e = {};
        (() => {
          Object.defineProperty(e, "__esModule", { value: true });
          let a2 = d(993), b2 = d(816), c2 = d(821), f = () => {
          }, g = new b2.TimeoutError();
          class h extends a2 {
            constructor(a3) {
              var b3, d2, e2, g2;
              if (super(), this._intervalCount = 0, this._intervalEnd = 0, this._pendingCount = 0, this._resolveEmpty = f, this._resolveIdle = f, !("number" == typeof (a3 = Object.assign({ carryoverConcurrencyCount: false, intervalCap: 1 / 0, interval: 0, concurrency: 1 / 0, autoStart: true, queueClass: c2.default }, a3)).intervalCap && a3.intervalCap >= 1)) throw TypeError(`Expected \`intervalCap\` to be a number from 1 and up, got \`${null != (d2 = null == (b3 = a3.intervalCap) ? void 0 : b3.toString()) ? d2 : ""}\` (${typeof a3.intervalCap})`);
              if (void 0 === a3.interval || !(Number.isFinite(a3.interval) && a3.interval >= 0)) throw TypeError(`Expected \`interval\` to be a finite number >= 0, got \`${null != (g2 = null == (e2 = a3.interval) ? void 0 : e2.toString()) ? g2 : ""}\` (${typeof a3.interval})`);
              this._carryoverConcurrencyCount = a3.carryoverConcurrencyCount, this._isIntervalIgnored = a3.intervalCap === 1 / 0 || 0 === a3.interval, this._intervalCap = a3.intervalCap, this._interval = a3.interval, this._queue = new a3.queueClass(), this._queueClass = a3.queueClass, this.concurrency = a3.concurrency, this._timeout = a3.timeout, this._throwOnTimeout = true === a3.throwOnTimeout, this._isPaused = false === a3.autoStart;
            }
            get _doesIntervalAllowAnother() {
              return this._isIntervalIgnored || this._intervalCount < this._intervalCap;
            }
            get _doesConcurrentAllowAnother() {
              return this._pendingCount < this._concurrency;
            }
            _next() {
              this._pendingCount--, this._tryToStartAnother(), this.emit("next");
            }
            _resolvePromises() {
              this._resolveEmpty(), this._resolveEmpty = f, 0 === this._pendingCount && (this._resolveIdle(), this._resolveIdle = f, this.emit("idle"));
            }
            _onResumeInterval() {
              this._onInterval(), this._initializeIntervalIfNeeded(), this._timeoutId = void 0;
            }
            _isIntervalPaused() {
              let a3 = Date.now();
              if (void 0 === this._intervalId) {
                let b3 = this._intervalEnd - a3;
                if (!(b3 < 0)) return void 0 === this._timeoutId && (this._timeoutId = setTimeout(() => {
                  this._onResumeInterval();
                }, b3)), true;
                this._intervalCount = this._carryoverConcurrencyCount ? this._pendingCount : 0;
              }
              return false;
            }
            _tryToStartAnother() {
              if (0 === this._queue.size) return this._intervalId && clearInterval(this._intervalId), this._intervalId = void 0, this._resolvePromises(), false;
              if (!this._isPaused) {
                let a3 = !this._isIntervalPaused();
                if (this._doesIntervalAllowAnother && this._doesConcurrentAllowAnother) {
                  let b3 = this._queue.dequeue();
                  return !!b3 && (this.emit("active"), b3(), a3 && this._initializeIntervalIfNeeded(), true);
                }
              }
              return false;
            }
            _initializeIntervalIfNeeded() {
              this._isIntervalIgnored || void 0 !== this._intervalId || (this._intervalId = setInterval(() => {
                this._onInterval();
              }, this._interval), this._intervalEnd = Date.now() + this._interval);
            }
            _onInterval() {
              0 === this._intervalCount && 0 === this._pendingCount && this._intervalId && (clearInterval(this._intervalId), this._intervalId = void 0), this._intervalCount = this._carryoverConcurrencyCount ? this._pendingCount : 0, this._processQueue();
            }
            _processQueue() {
              for (; this._tryToStartAnother(); ) ;
            }
            get concurrency() {
              return this._concurrency;
            }
            set concurrency(a3) {
              if (!("number" == typeof a3 && a3 >= 1)) throw TypeError(`Expected \`concurrency\` to be a number from 1 and up, got \`${a3}\` (${typeof a3})`);
              this._concurrency = a3, this._processQueue();
            }
            async add(a3, c3 = {}) {
              return new Promise((d2, e2) => {
                let f2 = async () => {
                  this._pendingCount++, this._intervalCount++;
                  try {
                    let f3 = void 0 === this._timeout && void 0 === c3.timeout ? a3() : b2.default(Promise.resolve(a3()), void 0 === c3.timeout ? this._timeout : c3.timeout, () => {
                      (void 0 === c3.throwOnTimeout ? this._throwOnTimeout : c3.throwOnTimeout) && e2(g);
                    });
                    d2(await f3);
                  } catch (a4) {
                    e2(a4);
                  }
                  this._next();
                };
                this._queue.enqueue(f2, c3), this._tryToStartAnother(), this.emit("add");
              });
            }
            async addAll(a3, b3) {
              return Promise.all(a3.map(async (a4) => this.add(a4, b3)));
            }
            start() {
              return this._isPaused && (this._isPaused = false, this._processQueue()), this;
            }
            pause() {
              this._isPaused = true;
            }
            clear() {
              this._queue = new this._queueClass();
            }
            async onEmpty() {
              if (0 !== this._queue.size) return new Promise((a3) => {
                let b3 = this._resolveEmpty;
                this._resolveEmpty = () => {
                  b3(), a3();
                };
              });
            }
            async onIdle() {
              if (0 !== this._pendingCount || 0 !== this._queue.size) return new Promise((a3) => {
                let b3 = this._resolveIdle;
                this._resolveIdle = () => {
                  b3(), a3();
                };
              });
            }
            get size() {
              return this._queue.size;
            }
            sizeBy(a3) {
              return this._queue.filter(a3).length;
            }
            get pending() {
              return this._pendingCount;
            }
            get isPaused() {
              return this._isPaused;
            }
            get timeout() {
              return this._timeout;
            }
            set timeout(a3) {
              this._timeout = a3;
            }
          }
          e.default = h;
        })(), a.exports = e;
      })();
    }, 259: (a) => {
      (() => {
        "use strict";
        "u" > typeof __nccwpck_require__ && (__nccwpck_require__.ab = "//");
        var b = {};
        (() => {
          function a2(a3, b2) {
            void 0 === b2 && (b2 = {});
            for (var c2 = function(a4) {
              for (var b3 = [], c3 = 0; c3 < a4.length; ) {
                var d3 = a4[c3];
                if ("*" === d3 || "+" === d3 || "?" === d3) {
                  b3.push({ type: "MODIFIER", index: c3, value: a4[c3++] });
                  continue;
                }
                if ("\\" === d3) {
                  b3.push({ type: "ESCAPED_CHAR", index: c3++, value: a4[c3++] });
                  continue;
                }
                if ("{" === d3) {
                  b3.push({ type: "OPEN", index: c3, value: a4[c3++] });
                  continue;
                }
                if ("}" === d3) {
                  b3.push({ type: "CLOSE", index: c3, value: a4[c3++] });
                  continue;
                }
                if (":" === d3) {
                  for (var e2 = "", f3 = c3 + 1; f3 < a4.length; ) {
                    var g3 = a4.charCodeAt(f3);
                    if (g3 >= 48 && g3 <= 57 || g3 >= 65 && g3 <= 90 || g3 >= 97 && g3 <= 122 || 95 === g3) {
                      e2 += a4[f3++];
                      continue;
                    }
                    break;
                  }
                  if (!e2) throw TypeError("Missing parameter name at ".concat(c3));
                  b3.push({ type: "NAME", index: c3, value: e2 }), c3 = f3;
                  continue;
                }
                if ("(" === d3) {
                  var h3 = 1, i2 = "", f3 = c3 + 1;
                  if ("?" === a4[f3]) throw TypeError('Pattern cannot start with "?" at '.concat(f3));
                  for (; f3 < a4.length; ) {
                    if ("\\" === a4[f3]) {
                      i2 += a4[f3++] + a4[f3++];
                      continue;
                    }
                    if (")" === a4[f3]) {
                      if (0 == --h3) {
                        f3++;
                        break;
                      }
                    } else if ("(" === a4[f3] && (h3++, "?" !== a4[f3 + 1])) throw TypeError("Capturing groups are not allowed at ".concat(f3));
                    i2 += a4[f3++];
                  }
                  if (h3) throw TypeError("Unbalanced pattern at ".concat(c3));
                  if (!i2) throw TypeError("Missing pattern at ".concat(c3));
                  b3.push({ type: "PATTERN", index: c3, value: i2 }), c3 = f3;
                  continue;
                }
                b3.push({ type: "CHAR", index: c3, value: a4[c3++] });
              }
              return b3.push({ type: "END", index: c3, value: "" }), b3;
            }(a3), d2 = b2.prefixes, f2 = void 0 === d2 ? "./" : d2, g2 = b2.delimiter, h2 = void 0 === g2 ? "/#?" : g2, i = [], j = 0, k = 0, l = "", m = function(a4) {
              if (k < c2.length && c2[k].type === a4) return c2[k++].value;
            }, n = function(a4) {
              var b3 = m(a4);
              if (void 0 !== b3) return b3;
              var d3 = c2[k], e2 = d3.type, f3 = d3.index;
              throw TypeError("Unexpected ".concat(e2, " at ").concat(f3, ", expected ").concat(a4));
            }, o = function() {
              for (var a4, b3 = ""; a4 = m("CHAR") || m("ESCAPED_CHAR"); ) b3 += a4;
              return b3;
            }, p = function(a4) {
              for (var b3 = 0; b3 < h2.length; b3++) {
                var c3 = h2[b3];
                if (a4.indexOf(c3) > -1) return true;
              }
              return false;
            }, q = function(a4) {
              var b3 = i[i.length - 1], c3 = a4 || (b3 && "string" == typeof b3 ? b3 : "");
              if (b3 && !c3) throw TypeError('Must have text between two parameters, missing text after "'.concat(b3.name, '"'));
              return !c3 || p(c3) ? "[^".concat(e(h2), "]+?") : "(?:(?!".concat(e(c3), ")[^").concat(e(h2), "])+?");
            }; k < c2.length; ) {
              var r = m("CHAR"), s = m("NAME"), t = m("PATTERN");
              if (s || t) {
                var u = r || "";
                -1 === f2.indexOf(u) && (l += u, u = ""), l && (i.push(l), l = ""), i.push({ name: s || j++, prefix: u, suffix: "", pattern: t || q(u), modifier: m("MODIFIER") || "" });
                continue;
              }
              var v = r || m("ESCAPED_CHAR");
              if (v) {
                l += v;
                continue;
              }
              if (l && (i.push(l), l = ""), m("OPEN")) {
                var u = o(), w = m("NAME") || "", x = m("PATTERN") || "", y = o();
                n("CLOSE"), i.push({ name: w || (x ? j++ : ""), pattern: w && !x ? q(u) : x, prefix: u, suffix: y, modifier: m("MODIFIER") || "" });
                continue;
              }
              n("END");
            }
            return i;
          }
          function c(a3, b2) {
            void 0 === b2 && (b2 = {});
            var c2 = f(b2), d2 = b2.encode, e2 = void 0 === d2 ? function(a4) {
              return a4;
            } : d2, g2 = b2.validate, h2 = void 0 === g2 || g2, i = a3.map(function(a4) {
              if ("object" == typeof a4) return new RegExp("^(?:".concat(a4.pattern, ")$"), c2);
            });
            return function(b3) {
              for (var c3 = "", d3 = 0; d3 < a3.length; d3++) {
                var f2 = a3[d3];
                if ("string" == typeof f2) {
                  c3 += f2;
                  continue;
                }
                var g3 = b3 ? b3[f2.name] : void 0, j = "?" === f2.modifier || "*" === f2.modifier, k = "*" === f2.modifier || "+" === f2.modifier;
                if (Array.isArray(g3)) {
                  if (!k) throw TypeError('Expected "'.concat(f2.name, '" to not repeat, but got an array'));
                  if (0 === g3.length) {
                    if (j) continue;
                    throw TypeError('Expected "'.concat(f2.name, '" to not be empty'));
                  }
                  for (var l = 0; l < g3.length; l++) {
                    var m = e2(g3[l], f2);
                    if (h2 && !i[d3].test(m)) throw TypeError('Expected all "'.concat(f2.name, '" to match "').concat(f2.pattern, '", but got "').concat(m, '"'));
                    c3 += f2.prefix + m + f2.suffix;
                  }
                  continue;
                }
                if ("string" == typeof g3 || "number" == typeof g3) {
                  var m = e2(String(g3), f2);
                  if (h2 && !i[d3].test(m)) throw TypeError('Expected "'.concat(f2.name, '" to match "').concat(f2.pattern, '", but got "').concat(m, '"'));
                  c3 += f2.prefix + m + f2.suffix;
                  continue;
                }
                if (!j) {
                  var n = k ? "an array" : "a string";
                  throw TypeError('Expected "'.concat(f2.name, '" to be ').concat(n));
                }
              }
              return c3;
            };
          }
          function d(a3, b2, c2) {
            void 0 === c2 && (c2 = {});
            var d2 = c2.decode, e2 = void 0 === d2 ? function(a4) {
              return a4;
            } : d2;
            return function(c3) {
              var d3 = a3.exec(c3);
              if (!d3) return false;
              for (var f2 = d3[0], g2 = d3.index, h2 = /* @__PURE__ */ Object.create(null), i = 1; i < d3.length; i++) !function(a4) {
                if (void 0 !== d3[a4]) {
                  var c4 = b2[a4 - 1];
                  "*" === c4.modifier || "+" === c4.modifier ? h2[c4.name] = d3[a4].split(c4.prefix + c4.suffix).map(function(a5) {
                    return e2(a5, c4);
                  }) : h2[c4.name] = e2(d3[a4], c4);
                }
              }(i);
              return { path: f2, index: g2, params: h2 };
            };
          }
          function e(a3) {
            return a3.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
          }
          function f(a3) {
            return a3 && a3.sensitive ? "" : "i";
          }
          function g(a3, b2, c2) {
            void 0 === c2 && (c2 = {});
            for (var d2 = c2.strict, g2 = void 0 !== d2 && d2, h2 = c2.start, i = c2.end, j = c2.encode, k = void 0 === j ? function(a4) {
              return a4;
            } : j, l = c2.delimiter, m = c2.endsWith, n = "[".concat(e(void 0 === m ? "" : m), "]|$"), o = "[".concat(e(void 0 === l ? "/#?" : l), "]"), p = void 0 === h2 || h2 ? "^" : "", q = 0; q < a3.length; q++) {
              var r = a3[q];
              if ("string" == typeof r) p += e(k(r));
              else {
                var s = e(k(r.prefix)), t = e(k(r.suffix));
                if (r.pattern) if (b2 && b2.push(r), s || t) if ("+" === r.modifier || "*" === r.modifier) {
                  var u = "*" === r.modifier ? "?" : "";
                  p += "(?:".concat(s, "((?:").concat(r.pattern, ")(?:").concat(t).concat(s, "(?:").concat(r.pattern, "))*)").concat(t, ")").concat(u);
                } else p += "(?:".concat(s, "(").concat(r.pattern, ")").concat(t, ")").concat(r.modifier);
                else {
                  if ("+" === r.modifier || "*" === r.modifier) throw TypeError('Can not repeat "'.concat(r.name, '" without a prefix and suffix'));
                  p += "(".concat(r.pattern, ")").concat(r.modifier);
                }
                else p += "(?:".concat(s).concat(t, ")").concat(r.modifier);
              }
            }
            if (void 0 === i || i) g2 || (p += "".concat(o, "?")), p += c2.endsWith ? "(?=".concat(n, ")") : "$";
            else {
              var v = a3[a3.length - 1], w = "string" == typeof v ? o.indexOf(v[v.length - 1]) > -1 : void 0 === v;
              g2 || (p += "(?:".concat(o, "(?=").concat(n, "))?")), w || (p += "(?=".concat(o, "|").concat(n, ")"));
            }
            return new RegExp(p, f(c2));
          }
          function h(b2, c2, d2) {
            if (b2 instanceof RegExp) {
              var e2;
              if (!c2) return b2;
              for (var i = /\((?:\?<(.*?)>)?(?!\?)/g, j = 0, k = i.exec(b2.source); k; ) c2.push({ name: k[1] || j++, prefix: "", suffix: "", modifier: "", pattern: "" }), k = i.exec(b2.source);
              return b2;
            }
            return Array.isArray(b2) ? (e2 = b2.map(function(a3) {
              return h(a3, c2, d2).source;
            }), new RegExp("(?:".concat(e2.join("|"), ")"), f(d2))) : g(a2(b2, d2), c2, d2);
          }
          Object.defineProperty(b, "__esModule", { value: true }), b.pathToRegexp = b.tokensToRegexp = b.regexpToFunction = b.match = b.tokensToFunction = b.compile = b.parse = void 0, b.parse = a2, b.compile = function(b2, d2) {
            return c(a2(b2, d2), d2);
          }, b.tokensToFunction = c, b.match = function(a3, b2) {
            var c2 = [];
            return d(h(a3, c2, b2), c2, b2);
          }, b.regexpToFunction = d, b.tokensToRegexp = g, b.pathToRegexp = h;
        })(), a.exports = b;
      })();
    }, 286: (a, b, c) => {
      "use strict";
      var d = Object.defineProperty, e = Object.getOwnPropertyDescriptor, f = Object.getOwnPropertyNames, g = Object.prototype.hasOwnProperty, h = (a2, b2) => {
        for (var c2 in b2) d(a2, c2, { get: b2[c2], enumerable: true });
      }, i = {};
      h(i, { Analytics: () => k, IpDenyList: () => x, MultiRegionRatelimit: () => G, Ratelimit: () => H }), a.exports = ((a2, b2, c2, h2) => {
        if (b2 && "object" == typeof b2 || "function" == typeof b2) for (let i2 of f(b2)) g.call(a2, i2) || i2 === c2 || d(a2, i2, { get: () => b2[i2], enumerable: !(h2 = e(b2, i2)) || h2.enumerable });
        return a2;
      })(d({}, "__esModule", { value: true }), i);
      var j = c(709), k = class {
        analytics;
        table = "events";
        constructor(a2) {
          this.analytics = new j.Analytics({ redis: a2.redis, window: "1h", prefix: a2.prefix ?? "@upstash/ratelimit", retention: "90d" });
        }
        extractGeo(a2) {
          return void 0 !== a2.geo ? a2.geo : void 0 !== a2.cf ? a2.cf : {};
        }
        async record(a2) {
          await this.analytics.ingest(this.table, a2);
        }
        async series(a2, b2) {
          let c2 = Math.min((this.analytics.getBucket(Date.now()) - this.analytics.getBucket(b2)) / 36e5, 256);
          return this.analytics.aggregateBucketsWithPipeline(this.table, a2, c2);
        }
        async getUsage(a2 = 0) {
          let b2 = Math.min((this.analytics.getBucket(Date.now()) - this.analytics.getBucket(a2)) / 36e5, 256);
          return await this.analytics.getAllowedBlocked(this.table, b2);
        }
        async getUsageOverTime(a2, b2) {
          return await this.analytics.aggregateBucketsWithPipeline(this.table, b2, a2);
        }
        async getMostAllowedBlocked(a2, b2, c2) {
          return b2 = b2 ?? 5, this.analytics.getMostAllowedBlocked(this.table, a2, b2, void 0, c2);
        }
      }, l = class {
        cache;
        constructor(a2) {
          this.cache = a2;
        }
        isBlocked(a2) {
          if (!this.cache.has(a2)) return { blocked: false, reset: 0 };
          let b2 = this.cache.get(a2);
          return b2 < Date.now() ? (this.cache.delete(a2), { blocked: false, reset: 0 }) : { blocked: true, reset: b2 };
        }
        blockUntil(a2, b2) {
          this.cache.set(a2, b2);
        }
        set(a2, b2) {
          this.cache.set(a2, b2);
        }
        get(a2) {
          return this.cache.get(a2) || null;
        }
        incr(a2, b2 = 1) {
          let c2 = this.cache.get(a2) ?? 0;
          return c2 += b2, this.cache.set(a2, c2), c2;
        }
        pop(a2) {
          this.cache.delete(a2);
        }
        empty() {
          this.cache.clear();
        }
        size() {
          return this.cache.size;
        }
      }, m = ":dynamic:global", n = "@upstash/ratelimit";
      function o(a2) {
        let b2 = a2.match(/^(\d+)\s?(ms|s|m|h|d)$/);
        if (!b2) throw Error(`Unable to parse window size: ${a2}`);
        let c2 = Number.parseInt(b2[1]);
        switch (b2[2]) {
          case "ms":
            return c2;
          case "s":
            return 1e3 * c2;
          case "m":
            return 1e3 * c2 * 60;
          case "h":
            return 1e3 * c2 * 3600;
          case "d":
            return 1e3 * c2 * 86400;
          default:
            throw Error(`Unable to parse window size: ${a2}`);
        }
      }
      var p = async (a2, b2, c2, d2) => {
        try {
          return await a2.redis.evalsha(b2.hash, c2, d2);
        } catch (e2) {
          if (`${e2}`.includes("NOSCRIPT")) return await a2.redis.eval(b2.script, c2, d2);
          throw e2;
        }
      }, q = { fixedWindow: { limit: { script: `
  local key           = KEYS[1]
  local dynamicLimitKey = KEYS[2]  -- optional: key for dynamic limit in redis
  local tokens        = tonumber(ARGV[1])  -- default limit
  local window        = ARGV[2]
  local incrementBy   = ARGV[3] -- increment rate per request at a given value, default is 1

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local r = redis.call("INCRBY", key, incrementBy)
  if r == tonumber(incrementBy) then
  -- The first time this key is set, the value will be equal to incrementBy.
  -- So we only need the expire command once
  redis.call("PEXPIRE", key, window)
  end

  return {r, effectiveLimit}
`, hash: "472e55443b62f60d0991028456c57815a387066d" }, getRemaining: { script: `
  local key = KEYS[1]
  local dynamicLimitKey = KEYS[2]  -- optional: key for dynamic limit in redis
  local tokens = tonumber(ARGV[1])  -- default limit

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local value = redis.call('GET', key)
  local usedTokens = 0
  if value then
    usedTokens = tonumber(value)
  end
  
  return {effectiveLimit - usedTokens, effectiveLimit}
`, hash: "40515c9dd0a08f8584f5f9b593935f6a87c1c1c3" } }, slidingWindow: { limit: { script: `
  local currentKey  = KEYS[1]           -- identifier including prefixes
  local previousKey = KEYS[2]           -- key of the previous bucket
  local dynamicLimitKey = KEYS[3]       -- optional: key for dynamic limit in redis
  local tokens      = tonumber(ARGV[1]) -- default tokens per window
  local now         = ARGV[2]           -- current timestamp in milliseconds
  local window      = ARGV[3]           -- interval in milliseconds
  local incrementBy = tonumber(ARGV[4]) -- increment rate per request at a given value, default is 1

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local requestsInCurrentWindow = redis.call("GET", currentKey)
  if requestsInCurrentWindow == false then
    requestsInCurrentWindow = 0
  end

  local requestsInPreviousWindow = redis.call("GET", previousKey)
  if requestsInPreviousWindow == false then
    requestsInPreviousWindow = 0
  end
  local percentageInCurrent = ( now % window ) / window
  -- weighted requests to consider from the previous window
  requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)

  -- Only check limit if not refunding (negative rate)
  if incrementBy > 0 and requestsInPreviousWindow + requestsInCurrentWindow >= effectiveLimit then
    return {-1, effectiveLimit}
  end

  local newValue = redis.call("INCRBY", currentKey, incrementBy)
  if newValue == incrementBy then
    -- The first time this key is set, the value will be equal to incrementBy.
    -- So we only need the expire command once
    redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
  end
  return {effectiveLimit - ( newValue + requestsInPreviousWindow ), effectiveLimit}
`, hash: "977fb636fb5ceb7e98a96d1b3a1272ba018efdae" }, getRemaining: { script: `
  local currentKey  = KEYS[1]           -- identifier including prefixes
  local previousKey = KEYS[2]           -- key of the previous bucket
  local dynamicLimitKey = KEYS[3]       -- optional: key for dynamic limit in redis
  local tokens      = tonumber(ARGV[1]) -- default tokens per window
  local now         = ARGV[2]           -- current timestamp in milliseconds
  local window      = ARGV[3]           -- interval in milliseconds

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local requestsInCurrentWindow = redis.call("GET", currentKey)
  if requestsInCurrentWindow == false then
    requestsInCurrentWindow = 0
  end

  local requestsInPreviousWindow = redis.call("GET", previousKey)
  if requestsInPreviousWindow == false then
    requestsInPreviousWindow = 0
  end

  local percentageInCurrent = ( now % window ) / window
  -- weighted requests to consider from the previous window
  requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)

  local usedTokens = requestsInPreviousWindow + requestsInCurrentWindow
  return {effectiveLimit - usedTokens, effectiveLimit}
`, hash: "ee3a3265fad822f83acad23f8a1e2f5c0b156b03" } }, tokenBucket: { limit: { script: `
  local key         = KEYS[1]           -- identifier including prefixes
  local dynamicLimitKey = KEYS[2]       -- optional: key for dynamic limit in redis
  local maxTokens   = tonumber(ARGV[1]) -- default maximum number of tokens
  local interval    = tonumber(ARGV[2]) -- size of the window in milliseconds
  local refillRate  = tonumber(ARGV[3]) -- how many tokens are refilled after each interval
  local now         = tonumber(ARGV[4]) -- current timestamp in milliseconds
  local incrementBy = tonumber(ARGV[5]) -- how many tokens to consume, default is 1

  -- Check for dynamic limit
  local effectiveLimit = maxTokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end
        
  local bucket = redis.call("HMGET", key, "refilledAt", "tokens")
        
  local refilledAt
  local tokens

  if bucket[1] == false then
    refilledAt = now
    tokens = effectiveLimit
  else
    refilledAt = tonumber(bucket[1])
    tokens = tonumber(bucket[2])
  end
        
  if now >= refilledAt + interval then
    local numRefills = math.floor((now - refilledAt) / interval)
    tokens = math.min(effectiveLimit, tokens + numRefills * refillRate)

    refilledAt = refilledAt + numRefills * interval
  end

  -- Only reject if tokens are 0 and we're consuming (not refunding)
  if tokens == 0 and incrementBy > 0 then
    return {-1, refilledAt + interval, effectiveLimit}
  end

  local remaining = tokens - incrementBy
  local expireAt = math.ceil(((effectiveLimit - remaining) / refillRate)) * interval
        
  redis.call("HSET", key, "refilledAt", refilledAt, "tokens", remaining)

  if (expireAt > 0) then
    redis.call("PEXPIRE", key, expireAt)
  end
  return {remaining, refilledAt + interval, effectiveLimit}
`, hash: "b35c5bc0b7fdae7dd0573d4529911cabaf9d1d89" }, getRemaining: { script: `
  local key         = KEYS[1]
  local dynamicLimitKey = KEYS[2]       -- optional: key for dynamic limit in redis
  local maxTokens   = tonumber(ARGV[1]) -- default maximum number of tokens

  -- Check for dynamic limit
  local effectiveLimit = maxTokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end
        
  local bucket = redis.call("HMGET", key, "refilledAt", "tokens")

  if bucket[1] == false then
    return {effectiveLimit, -1, effectiveLimit}
  end
        
  return {tonumber(bucket[2]), tonumber(bucket[1]), effectiveLimit}
`, hash: "deb03663e8af5a968deee895dd081be553d2611b" } }, cachedFixedWindow: { limit: { script: `
  local key     = KEYS[1]
  local window  = ARGV[1]
  local incrementBy   = ARGV[2] -- increment rate per request at a given value, default is 1

  local r = redis.call("INCRBY", key, incrementBy)
  if r == incrementBy then
  -- The first time this key is set, the value will be equal to incrementBy.
  -- So we only need the expire command once
  redis.call("PEXPIRE", key, window)
  end
      
  return r
`, hash: "c26b12703dd137939b9a69a3a9b18e906a2d940f" }, getRemaining: { script: `
  local key = KEYS[1]
  local tokens = 0

  local value = redis.call('GET', key)
  if value then
      tokens = value
  end
  return tokens
`, hash: "8e8f222ccae68b595ee6e3f3bf2199629a62b91a" } } }, r = { fixedWindow: { limit: { script: `
	local key           = KEYS[1]
	local id            = ARGV[1]
	local window        = ARGV[2]
	local incrementBy   = tonumber(ARGV[3])

	redis.call("HSET", key, id, incrementBy)
	local fields = redis.call("HGETALL", key)
	if #fields == 2 and tonumber(fields[2])==incrementBy then
	-- The first time this key is set, and the value will be equal to incrementBy.
	-- So we only need the expire command once
	  redis.call("PEXPIRE", key, window)
	end

	return fields
`, hash: "a8c14f3835aa87bd70e5e2116081b81664abcf5c" }, getRemaining: { script: `
      local key = KEYS[1]
      local tokens = 0

      local fields = redis.call("HGETALL", key)

      return fields
    `, hash: "8ab8322d0ed5fe5ac8eb08f0c2e4557f1b4816fd" } }, slidingWindow: { limit: { script: `
	local currentKey    = KEYS[1]           -- identifier including prefixes
	local previousKey   = KEYS[2]           -- key of the previous bucket
	local tokens        = tonumber(ARGV[1]) -- tokens per window
	local now           = ARGV[2]           -- current timestamp in milliseconds
	local window        = ARGV[3]           -- interval in milliseconds
	local requestId     = ARGV[4]           -- uuid for this request
	local incrementBy   = tonumber(ARGV[5]) -- custom rate, default is  1

	local currentFields = redis.call("HGETALL", currentKey)
	local requestsInCurrentWindow = 0
	for i = 2, #currentFields, 2 do
	requestsInCurrentWindow = requestsInCurrentWindow + tonumber(currentFields[i])
	end

	local previousFields = redis.call("HGETALL", previousKey)
	local requestsInPreviousWindow = 0
	for i = 2, #previousFields, 2 do
	requestsInPreviousWindow = requestsInPreviousWindow + tonumber(previousFields[i])
	end

	local percentageInCurrent = ( now % window) / window

	-- Only check limit if not refunding (negative rate)
	if incrementBy > 0 and requestsInPreviousWindow * (1 - percentageInCurrent ) + requestsInCurrentWindow + incrementBy > tokens then
	  return {currentFields, previousFields, false}
	end

	redis.call("HSET", currentKey, requestId, incrementBy)

	if requestsInCurrentWindow == 0 then 
	  -- The first time this key is set, the value will be equal to incrementBy.
	  -- So we only need the expire command once
	  redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
	end
	return {currentFields, previousFields, true}
`, hash: "1e7ca8dcd2d600a6d0124a67a57ea225ed62921b" }, getRemaining: { script: `
	local currentKey    = KEYS[1]           -- identifier including prefixes
	local previousKey   = KEYS[2]           -- key of the previous bucket
	local now         	= ARGV[1]           -- current timestamp in milliseconds
  	local window      	= ARGV[2]           -- interval in milliseconds

	local currentFields = redis.call("HGETALL", currentKey)
	local requestsInCurrentWindow = 0
	for i = 2, #currentFields, 2 do
	requestsInCurrentWindow = requestsInCurrentWindow + tonumber(currentFields[i])
	end

	local previousFields = redis.call("HGETALL", previousKey)
	local requestsInPreviousWindow = 0
	for i = 2, #previousFields, 2 do
	requestsInPreviousWindow = requestsInPreviousWindow + tonumber(previousFields[i])
	end

	local percentageInCurrent = ( now % window) / window
  	requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)
	
	return requestsInCurrentWindow + requestsInPreviousWindow
`, hash: "558c9306b7ec54abb50747fe0b17e5d44bd24868" } } }, s = { script: `
      local pattern = KEYS[1]

      -- Initialize cursor to start from 0
      local cursor = "0"

      repeat
          -- Scan for keys matching the pattern
          local scan_result = redis.call('SCAN', cursor, 'MATCH', pattern)

          -- Extract cursor for the next iteration
          cursor = scan_result[1]

          -- Extract keys from the scan result
          local keys = scan_result[2]

          for i=1, #keys do
          redis.call('DEL', keys[i])
          end

      -- Continue scanning until cursor is 0 (end of keyspace)
      until cursor == "0"
    `, hash: "54bd274ddc59fb3be0f42deee2f64322a10e2b50" }, t = "denyList", u = "ipDenyList", v = "ipDenyListStatus", w = `
  -- Checks if values provideed in ARGV are present in the deny lists.
  -- This is done using the allDenyListsKey below.

  -- Additionally, checks the status of the ip deny list using the
  -- ipDenyListStatusKey below. Here are the possible states of the
  -- ipDenyListStatusKey key:
  -- * status == -1: set to "disabled" with no TTL
  -- * status == -2: not set, meaning that is was set before but expired
  -- * status  >  0: set to "valid", with a TTL
  --
  -- In the case of status == -2, we set the status to "pending" with
  -- 30 second ttl. During this time, the process which got status == -2
  -- will update the ip deny list.

  local allDenyListsKey     = KEYS[1]
  local ipDenyListStatusKey = KEYS[2]

  local results = redis.call('SMISMEMBER', allDenyListsKey, unpack(ARGV))
  local status  = redis.call('TTL', ipDenyListStatusKey)
  if status == -2 then
    redis.call('SETEX', ipDenyListStatusKey, 30, "pending")
  end

  return { results, status }
`, x = {};
      h(x, { ThresholdError: () => y, disableIpDenyList: () => B, updateIpDenyList: () => A });
      var y = class extends Error {
        constructor(a2) {
          super(`Allowed threshold values are from 1 to 8, 1 and 8 included. Received: ${a2}`), this.name = "ThresholdError";
        }
      }, z = async (a2) => {
        if ("number" != typeof a2 || a2 < 1 || a2 > 8) throw new y(a2);
        try {
          let b2 = await fetch(`https://raw.githubusercontent.com/stamparm/ipsum/master/levels/${a2}.txt`);
          if (!b2.ok) throw Error(`Error fetching data: ${b2.statusText}`);
          return (await b2.text()).split("\n").filter((a3) => a3.length > 0);
        } catch (a3) {
          throw Error(`Failed to fetch ip deny list: ${a3}`);
        }
      }, A = async (a2, b2, c2, d2) => {
        var e2;
        let f2 = await z(c2), g2 = [b2, t, "all"].join(":"), h2 = [b2, t, u].join(":"), i2 = [b2, v].join(":"), j2 = a2.multi();
        return j2.sdiffstore(g2, g2, h2), j2.del(h2), j2.sadd(h2, f2.at(0), ...f2.slice(1)), j2.sdiffstore(h2, h2, g2), j2.sunionstore(g2, g2, h2), j2.set(i2, "valid", { px: d2 ?? 864e5 - ((e2 || Date.now()) - 72e5) % 864e5 }), await j2.exec();
      }, B = async (a2, b2) => {
        let c2 = [b2, t, "all"].join(":"), d2 = [b2, t, u].join(":"), e2 = [b2, v].join(":"), f2 = a2.multi();
        return f2.sdiffstore(c2, c2, d2), f2.del(d2), f2.set(e2, "disabled"), await f2.exec();
      }, C = new l(/* @__PURE__ */ new Map()), D = async (a2, b2, c2) => {
        let d2, [e2, f2] = await a2.eval(w, [[b2, t, "all"].join(":"), [b2, v].join(":")], c2);
        return e2.map((a3, b3) => {
          if (a3) {
            var e3;
            e3 = c2[b3], C.size() > 1e3 && C.empty(), C.blockUntil(e3, Date.now() + 6e4), d2 = c2[b3];
          }
        }), { deniedValue: d2, invalidIpDenyList: -2 === f2 };
      }, E = class {
        limiter;
        ctx;
        prefix;
        timeout;
        primaryRedis;
        analytics;
        enableProtection;
        denyListThreshold;
        dynamicLimits;
        constructor(a2) {
          this.ctx = a2.ctx, this.limiter = a2.limiter, this.timeout = a2.timeout ?? 5e3, this.prefix = a2.prefix ?? n, this.dynamicLimits = a2.dynamicLimits ?? false, this.enableProtection = a2.enableProtection ?? false, this.denyListThreshold = a2.denyListThreshold ?? 6, this.primaryRedis = "redis" in this.ctx ? this.ctx.redis : this.ctx.regionContexts[0].redis, "redis" in this.ctx && (this.ctx.dynamicLimits = this.dynamicLimits, this.ctx.prefix = this.prefix), this.analytics = a2.analytics ? new k({ redis: this.primaryRedis, prefix: this.prefix }) : void 0, a2.ephemeralCache instanceof Map ? this.ctx.cache = new l(a2.ephemeralCache) : void 0 === a2.ephemeralCache && (this.ctx.cache = new l(/* @__PURE__ */ new Map()));
        }
        limit = async (a2, b2) => {
          let c2 = null;
          try {
            let d2 = this.getRatelimitResponse(a2, b2), { responseArray: e2, newTimeoutId: f2 } = this.applyTimeout(d2);
            c2 = f2;
            let g2 = await Promise.race(e2);
            return this.submitAnalytics(g2, a2, b2);
          } finally {
            c2 && clearTimeout(c2);
          }
        };
        blockUntilReady = async (a2, b2) => {
          let c2;
          if (b2 <= 0) throw Error("timeout must be positive");
          let d2 = Date.now() + b2;
          for (; !(c2 = await this.limit(a2)).success; ) {
            if (0 === c2.reset) throw Error("This should not happen");
            let a3 = Math.min(c2.reset, d2) - Date.now();
            if (await new Promise((b3) => setTimeout(b3, a3)), Date.now() > d2) break;
          }
          return c2;
        };
        resetUsedTokens = async (a2) => {
          let b2 = [this.prefix, a2].join(":");
          await this.limiter().resetTokens(this.ctx, b2);
        };
        getRemaining = async (a2) => {
          let b2 = [this.prefix, a2].join(":");
          return await this.limiter().getRemaining(this.ctx, b2);
        };
        getRatelimitResponse = async (a2, b2) => {
          let c2 = this.getKey(a2), d2 = this.getDefinedMembers(a2, b2), e2 = d2.find((a3) => C.isBlocked(a3).blocked), f2 = e2 ? [{ success: false, limit: 0, remaining: 0, reset: 0, pending: Promise.resolve(), reason: "denyList", deniedValue: e2 }, { deniedValue: e2, invalidIpDenyList: false }] : await Promise.all([this.limiter().limit(this.ctx, c2, b2?.rate), this.enableProtection ? D(this.primaryRedis, this.prefix, d2) : { deniedValue: void 0, invalidIpDenyList: false }]);
          return ((a3, b3, [c3, d3], e3) => {
            if (d3.deniedValue && (c3.success = false, c3.remaining = 0, c3.reason = "denyList", c3.deniedValue = d3.deniedValue), d3.invalidIpDenyList) {
              let d4 = A(a3, b3, e3);
              c3.pending = Promise.all([c3.pending, d4]);
            }
            return c3;
          })(this.primaryRedis, this.prefix, f2, this.denyListThreshold);
        };
        applyTimeout = (a2) => {
          let b2 = null, c2 = [a2];
          if (this.timeout > 0) {
            let a3 = new Promise((a4) => {
              b2 = setTimeout(() => {
                a4({ success: true, limit: 0, remaining: 0, reset: 0, pending: Promise.resolve(), reason: "timeout" });
              }, this.timeout);
            });
            c2.push(a3);
          }
          return { responseArray: c2, newTimeoutId: b2 };
        };
        submitAnalytics = (a2, b2, c2) => {
          if (this.analytics) try {
            let d2 = c2 ? this.analytics.extractGeo(c2) : void 0, e2 = this.analytics.record({ identifier: "denyList" === a2.reason ? a2.deniedValue : b2, time: Date.now(), success: "denyList" === a2.reason ? "denied" : a2.success, ...d2 }).catch((a3) => {
              let b3 = "Failed to record analytics";
              `${a3}`.includes("WRONGTYPE") && (b3 = `
    Failed to record analytics. See the information below:

    This can occur when you uprade to Ratelimit version 1.1.2
    or later from an earlier version.

    This occurs simply because the way we store analytics data
    has changed. To avoid getting this error, disable analytics
    for *an hour*, then simply enable it back.

    `), console.warn(b3, a3);
            });
            a2.pending = Promise.all([a2.pending, e2]);
          } catch (a3) {
            console.warn("Failed to record analytics", a3);
          }
          return a2;
        };
        getKey = (a2) => [this.prefix, a2].join(":");
        getDefinedMembers = (a2, b2) => [a2, b2?.ip, b2?.userAgent, b2?.country].filter(Boolean);
        setDynamicLimit = async (a2) => {
          if (!this.dynamicLimits) throw Error("dynamicLimits must be enabled in the Ratelimit constructor to use setDynamicLimit()");
          let b2 = `${this.prefix}${m}`;
          await (false === a2.limit ? this.primaryRedis.del(b2) : this.primaryRedis.set(b2, a2.limit));
        };
        getDynamicLimit = async () => {
          if (!this.dynamicLimits) throw Error("dynamicLimits must be enabled in the Ratelimit constructor to use getDynamicLimit()");
          let a2 = `${this.prefix}${m}`, b2 = await this.primaryRedis.get(a2);
          return { dynamicLimit: null === b2 ? null : Number(b2) };
        };
      };
      function F() {
        let a2 = "", b2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", c2 = b2.length;
        for (let d2 = 0; d2 < 16; d2++) a2 += b2.charAt(Math.floor(Math.random() * c2));
        return a2;
      }
      var G = class extends E {
        constructor(a2) {
          super({ prefix: a2.prefix, limiter: a2.limiter, timeout: a2.timeout, analytics: a2.analytics, dynamicLimits: a2.dynamicLimits, ctx: { regionContexts: a2.redis.map((b2) => ({ redis: b2, prefix: a2.prefix ?? n })), cache: a2.ephemeralCache ? new l(a2.ephemeralCache) : void 0 } }), a2.dynamicLimits && console.warn("Warning: Dynamic limits are not yet supported for multi-region rate limiters. The dynamicLimits option will be ignored.");
        }
        static fixedWindow(a2, b2) {
          let c2 = o(b2);
          return () => ({ async limit(b3, d2, e2) {
            let f2 = F(), g2 = Math.floor(Date.now() / c2), h2 = [d2, g2].join(":"), i2 = e2 ?? 1;
            if (b3.cache && i2 > 0) {
              let { blocked: c3, reset: e3 } = b3.cache.isBlocked(d2);
              if (c3) return { success: false, limit: a2, remaining: 0, reset: e3, pending: Promise.resolve(), reason: "cacheBlock" };
            }
            let j2 = b3.regionContexts.map((a3) => ({ redis: a3.redis, request: p(a3, r.fixedWindow.limit, [h2], [f2, c2, i2]) })), k2 = a2 - (await Promise.any(j2.map((a3) => a3.request))).reduce((a3, b4, c3) => {
              let d3 = 0;
              return c3 % 2 && (d3 = Number.parseInt(b4)), a3 + d3;
            }, 0);
            async function l2() {
              let b4 = [...new Set((await Promise.all(j2.map((a3) => a3.request))).flat().reduce((a3, b5, c3) => (c3 % 2 == 0 && a3.push(b5), a3), [])).values()];
              for (let c3 of j2) {
                let d3 = (await c3.request).reduce((a3, b5, c4) => {
                  let d4 = 0;
                  return c4 % 2 && (d4 = Number.parseInt(b5)), a3 + d4;
                }, 0), e3 = (await c3.request).reduce((a3, b5, c4) => (c4 % 2 == 0 && a3.push(b5), a3), []);
                if (d3 >= a2) continue;
                let f3 = b4.filter((a3) => !e3.includes(a3));
                if (0 !== f3.length) for (let a3 of f3) await c3.redis.hset(h2, { [a3]: i2 });
              }
            }
            let m2 = k2 >= 0, n2 = (g2 + 1) * c2;
            return b3.cache && (m2 ? i2 < 0 && b3.cache.pop(d2) : b3.cache.blockUntil(d2, n2)), { success: m2, limit: a2, remaining: k2, reset: n2, pending: l2() };
          }, async getRemaining(b3, d2) {
            let e2 = Math.floor(Date.now() / c2), f2 = [d2, e2].join(":"), g2 = b3.regionContexts.map((a3) => ({ redis: a3.redis, request: p(a3, r.fixedWindow.getRemaining, [f2], [null]) }));
            return { remaining: Math.max(0, a2 - (await Promise.any(g2.map((a3) => a3.request))).reduce((a3, b4, c3) => {
              let d3 = 0;
              return c3 % 2 && (d3 = Number.parseInt(b4)), a3 + d3;
            }, 0)), reset: (e2 + 1) * c2, limit: a2 };
          }, async resetTokens(a3, b3) {
            let c3 = [b3, "*"].join(":");
            a3.cache && a3.cache.pop(b3), await Promise.all(a3.regionContexts.map((a4) => {
              p(a4, s, [c3], [null]);
            }));
          } });
        }
        static slidingWindow(a2, b2) {
          let c2 = o(b2), d2 = o(b2);
          return () => ({ async limit(b3, e2, f2) {
            let g2 = F(), h2 = Date.now(), i2 = Math.floor(h2 / c2), j2 = [e2, i2].join(":"), k2 = [e2, i2 - 1].join(":"), l2 = f2 ?? 1;
            if (b3.cache && l2 > 0) {
              let { blocked: c3, reset: d3 } = b3.cache.isBlocked(e2);
              if (c3) return { success: false, limit: a2, remaining: 0, reset: d3, pending: Promise.resolve(), reason: "cacheBlock" };
            }
            let m2 = b3.regionContexts.map((b4) => ({ redis: b4.redis, request: p(b4, r.slidingWindow.limit, [j2, k2], [a2, h2, d2, g2, l2]) })), n2 = h2 % d2 / d2, [o2, q2, s2] = await Promise.any(m2.map((a3) => a3.request));
            s2 && o2.push(g2, l2.toString());
            let t2 = a2 - (Math.ceil(q2.reduce((a3, b4, c3) => {
              let d3 = 0;
              return c3 % 2 && (d3 = Number.parseInt(b4)), a3 + d3;
            }, 0) * (1 - n2)) + o2.reduce((a3, b4, c3) => {
              let d3 = 0;
              return c3 % 2 && (d3 = Number.parseInt(b4)), a3 + d3;
            }, 0));
            async function u2() {
              let b4 = [...new Set((await Promise.all(m2.map((a3) => a3.request))).flatMap(([a3]) => a3).reduce((a3, b5, c3) => (c3 % 2 == 0 && a3.push(b5), a3), [])).values()];
              for (let c3 of m2) {
                let [d3, e3, f3] = await c3.request, g3 = d3.reduce((a3, b5, c4) => (c4 % 2 == 0 && a3.push(b5), a3), []);
                if (d3.reduce((a3, b5, c4) => {
                  let d4 = 0;
                  return c4 % 2 && (d4 = Number.parseInt(b5)), a3 + d4;
                }, 0) >= a2) continue;
                let h3 = b4.filter((a3) => !g3.includes(a3));
                if (0 !== h3.length) for (let a3 of h3) await c3.redis.hset(j2, { [a3]: l2 });
              }
            }
            let v2 = (i2 + 1) * d2;
            return b3.cache && (s2 ? l2 < 0 && b3.cache.pop(e2) : b3.cache.blockUntil(e2, v2)), { success: !!s2, limit: a2, remaining: Math.max(0, t2), reset: v2, pending: u2() };
          }, async getRemaining(b3, d3) {
            let e2 = Date.now(), f2 = Math.floor(e2 / c2), g2 = [d3, f2].join(":"), h2 = [d3, f2 - 1].join(":"), i2 = b3.regionContexts.map((a3) => ({ redis: a3.redis, request: p(a3, r.slidingWindow.getRemaining, [g2, h2], [e2, c2]) }));
            return { remaining: Math.max(0, a2 - await Promise.any(i2.map((a3) => a3.request))), reset: (f2 + 1) * c2, limit: a2 };
          }, async resetTokens(a3, b3) {
            let c3 = [b3, "*"].join(":");
            a3.cache && a3.cache.pop(b3), await Promise.all(a3.regionContexts.map((a4) => {
              p(a4, s, [c3], [null]);
            }));
          } });
        }
      }, H = class extends E {
        constructor(a2) {
          super({ prefix: a2.prefix, limiter: a2.limiter, timeout: a2.timeout, analytics: a2.analytics, ctx: { redis: a2.redis, prefix: a2.prefix ?? n }, ephemeralCache: a2.ephemeralCache, enableProtection: a2.enableProtection, denyListThreshold: a2.denyListThreshold, dynamicLimits: a2.dynamicLimits });
        }
        static fixedWindow(a2, b2) {
          let c2 = o(b2);
          return () => ({ async limit(b3, d2, e2) {
            let f2 = Math.floor(Date.now() / c2), g2 = [d2, f2].join(":"), h2 = e2 ?? 1;
            if (b3.cache && h2 > 0) {
              let { blocked: c3, reset: e3 } = b3.cache.isBlocked(d2);
              if (c3) return { success: false, limit: a2, remaining: 0, reset: e3, pending: Promise.resolve(), reason: "cacheBlock" };
            }
            let i2 = b3.dynamicLimits ? `${b3.prefix}${m}` : "", [j2, k2] = await p(b3, q.fixedWindow.limit, [g2, i2], [a2, c2, h2]), l2 = j2 <= k2, n2 = Math.max(0, k2 - j2), o2 = (f2 + 1) * c2;
            return b3.cache && (l2 ? h2 < 0 && b3.cache.pop(d2) : b3.cache.blockUntil(d2, o2)), { success: l2, limit: k2, remaining: n2, reset: o2, pending: Promise.resolve() };
          }, async getRemaining(b3, d2) {
            let e2 = Math.floor(Date.now() / c2), f2 = [d2, e2].join(":"), g2 = b3.dynamicLimits ? `${b3.prefix}${m}` : "", [h2, i2] = await p(b3, q.fixedWindow.getRemaining, [f2, g2], [a2]);
            return { remaining: Math.max(0, h2), reset: (e2 + 1) * c2, limit: i2 };
          }, async resetTokens(a3, b3) {
            let c3 = [b3, "*"].join(":");
            a3.cache && a3.cache.pop(b3), await p(a3, s, [c3], [null]);
          } });
        }
        static slidingWindow(a2, b2) {
          let c2 = o(b2);
          return () => ({ async limit(b3, d2, e2) {
            let f2 = Date.now(), g2 = Math.floor(f2 / c2), h2 = [d2, g2].join(":"), i2 = [d2, g2 - 1].join(":"), j2 = e2 ?? 1;
            if (b3.cache && j2 > 0) {
              let { blocked: c3, reset: e3 } = b3.cache.isBlocked(d2);
              if (c3) return { success: false, limit: a2, remaining: 0, reset: e3, pending: Promise.resolve(), reason: "cacheBlock" };
            }
            let k2 = b3.dynamicLimits ? `${b3.prefix}${m}` : "", [l2, n2] = await p(b3, q.slidingWindow.limit, [h2, i2, k2], [a2, f2, c2, j2]), o2 = l2 >= 0, r2 = (g2 + 1) * c2;
            return b3.cache && (o2 ? j2 < 0 && b3.cache.pop(d2) : b3.cache.blockUntil(d2, r2)), { success: o2, limit: n2, remaining: Math.max(0, l2), reset: r2, pending: Promise.resolve() };
          }, async getRemaining(b3, d2) {
            let e2 = Date.now(), f2 = Math.floor(e2 / c2), g2 = [d2, f2].join(":"), h2 = [d2, f2 - 1].join(":"), i2 = b3.dynamicLimits ? `${b3.prefix}${m}` : "", [j2, k2] = await p(b3, q.slidingWindow.getRemaining, [g2, h2, i2], [a2, e2, c2]);
            return { remaining: Math.max(0, j2), reset: (f2 + 1) * c2, limit: k2 };
          }, async resetTokens(a3, b3) {
            let c3 = [b3, "*"].join(":");
            a3.cache && a3.cache.pop(b3), await p(a3, s, [c3], [null]);
          } });
        }
        static tokenBucket(a2, b2, c2) {
          let d2 = o(b2);
          return () => ({ async limit(b3, e2, f2) {
            let g2 = Date.now(), h2 = f2 ?? 1;
            if (b3.cache && h2 > 0) {
              let { blocked: a3, reset: d3 } = b3.cache.isBlocked(e2);
              if (a3) return { success: false, limit: c2, remaining: 0, reset: d3, pending: Promise.resolve(), reason: "cacheBlock" };
            }
            let i2 = b3.dynamicLimits ? `${b3.prefix}${m}` : "", [j2, k2, l2] = await p(b3, q.tokenBucket.limit, [e2, i2], [c2, d2, a2, g2, h2]), n2 = j2 >= 0;
            return b3.cache && (n2 ? h2 < 0 && b3.cache.pop(e2) : b3.cache.blockUntil(e2, k2)), { success: n2, limit: l2, remaining: Math.max(0, j2), reset: k2, pending: Promise.resolve() };
          }, async getRemaining(a3, b3) {
            let e2 = a3.dynamicLimits ? `${a3.prefix}${m}` : "", [f2, g2, h2] = await p(a3, q.tokenBucket.getRemaining, [b3, e2], [c2]), i2 = Date.now() + d2, j2 = g2 + d2;
            return { remaining: Math.max(0, f2), reset: -1 === g2 ? i2 : j2, limit: h2 };
          }, async resetTokens(a3, b3) {
            a3.cache && a3.cache.pop(b3), await p(a3, s, [b3], [null]);
          } });
        }
        static cachedFixedWindow(a2, b2) {
          let c2 = o(b2);
          return () => ({ async limit(b3, d2, e2) {
            if (!b3.cache) throw Error("This algorithm requires a cache");
            b3.dynamicLimits && console.warn("Warning: Dynamic limits are not yet supported for cachedFixedWindow algorithm. The dynamicLimits option will be ignored.");
            let f2 = Math.floor(Date.now() / c2), g2 = [d2, f2].join(":"), h2 = (f2 + 1) * c2, i2 = e2 ?? 1;
            if ("number" == typeof b3.cache.get(g2)) {
              let d3 = b3.cache.incr(g2, i2), e3 = d3 < a2, f3 = e3 ? p(b3, q.cachedFixedWindow.limit, [g2], [c2, i2]) : Promise.resolve();
              return { success: e3, limit: a2, remaining: a2 - d3, reset: h2, pending: f3 };
            }
            let j2 = await p(b3, q.cachedFixedWindow.limit, [g2], [c2, i2]);
            b3.cache.set(g2, j2);
            let k2 = a2 - j2;
            return { success: k2 >= 0, limit: a2, remaining: k2, reset: h2, pending: Promise.resolve() };
          }, async getRemaining(b3, d2) {
            if (!b3.cache) throw Error("This algorithm requires a cache");
            let e2 = Math.floor(Date.now() / c2), f2 = [d2, e2].join(":");
            return "number" == typeof b3.cache.get(f2) ? { remaining: Math.max(0, a2 - (b3.cache.get(f2) ?? 0)), reset: (e2 + 1) * c2, limit: a2 } : { remaining: Math.max(0, a2 - await p(b3, q.cachedFixedWindow.getRemaining, [f2], [null])), reset: (e2 + 1) * c2, limit: a2 };
          }, async resetTokens(a3, b3) {
            if (!a3.cache) throw Error("This algorithm requires a cache");
            let d2 = [b3, Math.floor(Date.now() / c2)].join(":");
            a3.cache.pop(d2);
            let e2 = [b3, "*"].join(":");
            await p(a3, s, [e2], [null]);
          } });
        }
      };
    }, 318: (a, b, c) => {
      "use strict";
      var d = c(356).Buffer;
      Object.defineProperty(b, "__esModule", { value: true });
      var e = { handleFetch: function() {
        return j;
      }, interceptFetch: function() {
        return k;
      }, reader: function() {
        return h;
      } };
      for (var f in e) Object.defineProperty(b, f, { enumerable: true, get: e[f] });
      let g = c(643), h = { url: (a2) => a2.url, header: (a2, b2) => a2.headers.get(b2) };
      async function i(a2, b2) {
        let { url: c2, method: e2, headers: f2, body: g2, cache: h2, credentials: i2, integrity: j2, mode: k2, redirect: l, referrer: m, referrerPolicy: n } = b2;
        return { testData: a2, api: "fetch", request: { url: c2, method: e2, headers: [...Array.from(f2), ["next-test-stack", function() {
          let a3 = (Error().stack ?? "").split("\n");
          for (let b3 = 1; b3 < a3.length; b3++) if (a3[b3].length > 0) {
            a3 = a3.slice(b3);
            break;
          }
          return (a3 = (a3 = (a3 = a3.filter((a4) => !a4.includes("/next/dist/"))).slice(0, 5)).map((a4) => a4.replace("webpack-internal:///(rsc)/", "").trim())).join("    ");
        }()]], body: g2 ? d.from(await b2.arrayBuffer()).toString("base64") : null, cache: h2, credentials: i2, integrity: j2, mode: k2, redirect: l, referrer: m, referrerPolicy: n } };
      }
      async function j(a2, b2) {
        let c2 = (0, g.getTestReqInfo)(b2, h);
        if (!c2) return a2(b2);
        let { testData: e2, proxyPort: f2 } = c2, j2 = await i(e2, b2), k2 = await a2(`http://localhost:${f2}`, { method: "POST", body: JSON.stringify(j2), next: { internal: true } });
        if (!k2.ok) throw Object.defineProperty(Error(`Proxy request failed: ${k2.status}`), "__NEXT_ERROR_CODE", { value: "E146", enumerable: false, configurable: true });
        let l = await k2.json(), { api: m } = l;
        switch (m) {
          case "continue":
            return a2(b2);
          case "abort":
          case "unhandled":
            throw Object.defineProperty(Error(`Proxy request aborted [${b2.method} ${b2.url}]`), "__NEXT_ERROR_CODE", { value: "E145", enumerable: false, configurable: true });
          case "fetch":
            return function(a3) {
              let { status: b3, headers: c3, body: e3 } = a3.response;
              return new Response(e3 ? d.from(e3, "base64") : null, { status: b3, headers: new Headers(c3) });
            }(l);
          default:
            return m;
        }
      }
      function k(a2) {
        return c.g.fetch = function(b2, c2) {
          var d2;
          return (null == c2 || null == (d2 = c2.next) ? void 0 : d2.internal) ? a2(b2, c2) : j(a2, new Request(b2, c2));
        }, () => {
          c.g.fetch = a2;
        };
      }
    }, 345: (a, b, c) => {
      "use strict";
      a.exports = c(417);
    }, 356: (a) => {
      "use strict";
      a.exports = (init_node_buffer(), __toCommonJS(node_buffer_exports));
    }, 417: (a, b) => {
      "use strict";
      Symbol.for("react.transitional.element"), Symbol.for("react.portal"), Symbol.for("react.fragment"), Symbol.for("react.strict_mode"), Symbol.for("react.profiler"), Symbol.for("react.forward_ref"), Symbol.for("react.suspense"), Symbol.for("react.memo"), Symbol.for("react.lazy"), Symbol.for("react.activity"), Symbol.for("react.view_transition"), Symbol.iterator;
      Object.prototype.hasOwnProperty;
    }, 446: (a, b, c) => {
      (() => {
        "use strict";
        let b2, d, e, f, g;
        var h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x = { 491: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.ContextAPI = void 0;
          let d2 = c2(223), e2 = c2(172), f2 = c2(930), g2 = "context", h2 = new d2.NoopContextManager();
          class i2 {
            static getInstance() {
              return this._instance || (this._instance = new i2()), this._instance;
            }
            setGlobalContextManager(a3) {
              return (0, e2.registerGlobal)(g2, a3, f2.DiagAPI.instance());
            }
            active() {
              return this._getContextManager().active();
            }
            with(a3, b4, c3, ...d3) {
              return this._getContextManager().with(a3, b4, c3, ...d3);
            }
            bind(a3, b4) {
              return this._getContextManager().bind(a3, b4);
            }
            _getContextManager() {
              return (0, e2.getGlobal)(g2) || h2;
            }
            disable() {
              this._getContextManager().disable(), (0, e2.unregisterGlobal)(g2, f2.DiagAPI.instance());
            }
          }
          b3.ContextAPI = i2;
        }, 930: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.DiagAPI = void 0;
          let d2 = c2(56), e2 = c2(912), f2 = c2(957), g2 = c2(172);
          class h2 {
            constructor() {
              function a3(a4) {
                return function(...b5) {
                  let c3 = (0, g2.getGlobal)("diag");
                  if (c3) return c3[a4](...b5);
                };
              }
              const b4 = this;
              b4.setLogger = (a4, c3 = { logLevel: f2.DiagLogLevel.INFO }) => {
                var d3, h3, i2;
                if (a4 === b4) {
                  let a5 = Error("Cannot use diag as the logger for itself. Please use a DiagLogger implementation like ConsoleDiagLogger or a custom implementation");
                  return b4.error(null != (d3 = a5.stack) ? d3 : a5.message), false;
                }
                "number" == typeof c3 && (c3 = { logLevel: c3 });
                let j2 = (0, g2.getGlobal)("diag"), k2 = (0, e2.createLogLevelDiagLogger)(null != (h3 = c3.logLevel) ? h3 : f2.DiagLogLevel.INFO, a4);
                if (j2 && !c3.suppressOverrideMessage) {
                  let a5 = null != (i2 = Error().stack) ? i2 : "<failed to generate stacktrace>";
                  j2.warn(`Current logger will be overwritten from ${a5}`), k2.warn(`Current logger will overwrite one already registered from ${a5}`);
                }
                return (0, g2.registerGlobal)("diag", k2, b4, true);
              }, b4.disable = () => {
                (0, g2.unregisterGlobal)("diag", b4);
              }, b4.createComponentLogger = (a4) => new d2.DiagComponentLogger(a4), b4.verbose = a3("verbose"), b4.debug = a3("debug"), b4.info = a3("info"), b4.warn = a3("warn"), b4.error = a3("error");
            }
            static instance() {
              return this._instance || (this._instance = new h2()), this._instance;
            }
          }
          b3.DiagAPI = h2;
        }, 653: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.MetricsAPI = void 0;
          let d2 = c2(660), e2 = c2(172), f2 = c2(930), g2 = "metrics";
          class h2 {
            static getInstance() {
              return this._instance || (this._instance = new h2()), this._instance;
            }
            setGlobalMeterProvider(a3) {
              return (0, e2.registerGlobal)(g2, a3, f2.DiagAPI.instance());
            }
            getMeterProvider() {
              return (0, e2.getGlobal)(g2) || d2.NOOP_METER_PROVIDER;
            }
            getMeter(a3, b4, c3) {
              return this.getMeterProvider().getMeter(a3, b4, c3);
            }
            disable() {
              (0, e2.unregisterGlobal)(g2, f2.DiagAPI.instance());
            }
          }
          b3.MetricsAPI = h2;
        }, 181: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.PropagationAPI = void 0;
          let d2 = c2(172), e2 = c2(874), f2 = c2(194), g2 = c2(277), h2 = c2(369), i2 = c2(930), j2 = "propagation", k2 = new e2.NoopTextMapPropagator();
          class l2 {
            constructor() {
              this.createBaggage = h2.createBaggage, this.getBaggage = g2.getBaggage, this.getActiveBaggage = g2.getActiveBaggage, this.setBaggage = g2.setBaggage, this.deleteBaggage = g2.deleteBaggage;
            }
            static getInstance() {
              return this._instance || (this._instance = new l2()), this._instance;
            }
            setGlobalPropagator(a3) {
              return (0, d2.registerGlobal)(j2, a3, i2.DiagAPI.instance());
            }
            inject(a3, b4, c3 = f2.defaultTextMapSetter) {
              return this._getGlobalPropagator().inject(a3, b4, c3);
            }
            extract(a3, b4, c3 = f2.defaultTextMapGetter) {
              return this._getGlobalPropagator().extract(a3, b4, c3);
            }
            fields() {
              return this._getGlobalPropagator().fields();
            }
            disable() {
              (0, d2.unregisterGlobal)(j2, i2.DiagAPI.instance());
            }
            _getGlobalPropagator() {
              return (0, d2.getGlobal)(j2) || k2;
            }
          }
          b3.PropagationAPI = l2;
        }, 997: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.TraceAPI = void 0;
          let d2 = c2(172), e2 = c2(846), f2 = c2(139), g2 = c2(607), h2 = c2(930), i2 = "trace";
          class j2 {
            constructor() {
              this._proxyTracerProvider = new e2.ProxyTracerProvider(), this.wrapSpanContext = f2.wrapSpanContext, this.isSpanContextValid = f2.isSpanContextValid, this.deleteSpan = g2.deleteSpan, this.getSpan = g2.getSpan, this.getActiveSpan = g2.getActiveSpan, this.getSpanContext = g2.getSpanContext, this.setSpan = g2.setSpan, this.setSpanContext = g2.setSpanContext;
            }
            static getInstance() {
              return this._instance || (this._instance = new j2()), this._instance;
            }
            setGlobalTracerProvider(a3) {
              let b4 = (0, d2.registerGlobal)(i2, this._proxyTracerProvider, h2.DiagAPI.instance());
              return b4 && this._proxyTracerProvider.setDelegate(a3), b4;
            }
            getTracerProvider() {
              return (0, d2.getGlobal)(i2) || this._proxyTracerProvider;
            }
            getTracer(a3, b4) {
              return this.getTracerProvider().getTracer(a3, b4);
            }
            disable() {
              (0, d2.unregisterGlobal)(i2, h2.DiagAPI.instance()), this._proxyTracerProvider = new e2.ProxyTracerProvider();
            }
          }
          b3.TraceAPI = j2;
        }, 277: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.deleteBaggage = b3.setBaggage = b3.getActiveBaggage = b3.getBaggage = void 0;
          let d2 = c2(491), e2 = (0, c2(780).createContextKey)("OpenTelemetry Baggage Key");
          function f2(a3) {
            return a3.getValue(e2) || void 0;
          }
          b3.getBaggage = f2, b3.getActiveBaggage = function() {
            return f2(d2.ContextAPI.getInstance().active());
          }, b3.setBaggage = function(a3, b4) {
            return a3.setValue(e2, b4);
          }, b3.deleteBaggage = function(a3) {
            return a3.deleteValue(e2);
          };
        }, 993: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.BaggageImpl = void 0;
          class c2 {
            constructor(a3) {
              this._entries = a3 ? new Map(a3) : /* @__PURE__ */ new Map();
            }
            getEntry(a3) {
              let b4 = this._entries.get(a3);
              if (b4) return Object.assign({}, b4);
            }
            getAllEntries() {
              return Array.from(this._entries.entries()).map(([a3, b4]) => [a3, b4]);
            }
            setEntry(a3, b4) {
              let d2 = new c2(this._entries);
              return d2._entries.set(a3, b4), d2;
            }
            removeEntry(a3) {
              let b4 = new c2(this._entries);
              return b4._entries.delete(a3), b4;
            }
            removeEntries(...a3) {
              let b4 = new c2(this._entries);
              for (let c3 of a3) b4._entries.delete(c3);
              return b4;
            }
            clear() {
              return new c2();
            }
          }
          b3.BaggageImpl = c2;
        }, 830: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.baggageEntryMetadataSymbol = void 0, b3.baggageEntryMetadataSymbol = Symbol("BaggageEntryMetadata");
        }, 369: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.baggageEntryMetadataFromString = b3.createBaggage = void 0;
          let d2 = c2(930), e2 = c2(993), f2 = c2(830), g2 = d2.DiagAPI.instance();
          b3.createBaggage = function(a3 = {}) {
            return new e2.BaggageImpl(new Map(Object.entries(a3)));
          }, b3.baggageEntryMetadataFromString = function(a3) {
            return "string" != typeof a3 && (g2.error(`Cannot create baggage metadata from unknown type: ${typeof a3}`), a3 = ""), { __TYPE__: f2.baggageEntryMetadataSymbol, toString: () => a3 };
          };
        }, 67: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.context = void 0, b3.context = c2(491).ContextAPI.getInstance();
        }, 223: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.NoopContextManager = void 0;
          let d2 = c2(780);
          class e2 {
            active() {
              return d2.ROOT_CONTEXT;
            }
            with(a3, b4, c3, ...d3) {
              return b4.call(c3, ...d3);
            }
            bind(a3, b4) {
              return b4;
            }
            enable() {
              return this;
            }
            disable() {
              return this;
            }
          }
          b3.NoopContextManager = e2;
        }, 780: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.ROOT_CONTEXT = b3.createContextKey = void 0, b3.createContextKey = function(a3) {
            return Symbol.for(a3);
          };
          class c2 {
            constructor(a3) {
              const b4 = this;
              b4._currentContext = a3 ? new Map(a3) : /* @__PURE__ */ new Map(), b4.getValue = (a4) => b4._currentContext.get(a4), b4.setValue = (a4, d2) => {
                let e2 = new c2(b4._currentContext);
                return e2._currentContext.set(a4, d2), e2;
              }, b4.deleteValue = (a4) => {
                let d2 = new c2(b4._currentContext);
                return d2._currentContext.delete(a4), d2;
              };
            }
          }
          b3.ROOT_CONTEXT = new c2();
        }, 506: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.diag = void 0, b3.diag = c2(930).DiagAPI.instance();
        }, 56: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.DiagComponentLogger = void 0;
          let d2 = c2(172);
          class e2 {
            constructor(a3) {
              this._namespace = a3.namespace || "DiagComponentLogger";
            }
            debug(...a3) {
              return f2("debug", this._namespace, a3);
            }
            error(...a3) {
              return f2("error", this._namespace, a3);
            }
            info(...a3) {
              return f2("info", this._namespace, a3);
            }
            warn(...a3) {
              return f2("warn", this._namespace, a3);
            }
            verbose(...a3) {
              return f2("verbose", this._namespace, a3);
            }
          }
          function f2(a3, b4, c3) {
            let e3 = (0, d2.getGlobal)("diag");
            if (e3) return c3.unshift(b4), e3[a3](...c3);
          }
          b3.DiagComponentLogger = e2;
        }, 972: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.DiagConsoleLogger = void 0;
          let c2 = [{ n: "error", c: "error" }, { n: "warn", c: "warn" }, { n: "info", c: "info" }, { n: "debug", c: "debug" }, { n: "verbose", c: "trace" }];
          class d2 {
            constructor() {
              for (let a3 = 0; a3 < c2.length; a3++) this[c2[a3].n] = /* @__PURE__ */ function(a4) {
                return function(...b4) {
                  if (console) {
                    let c3 = console[a4];
                    if ("function" != typeof c3 && (c3 = console.log), "function" == typeof c3) return c3.apply(console, b4);
                  }
                };
              }(c2[a3].c);
            }
          }
          b3.DiagConsoleLogger = d2;
        }, 912: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.createLogLevelDiagLogger = void 0;
          let d2 = c2(957);
          b3.createLogLevelDiagLogger = function(a3, b4) {
            function c3(c4, d3) {
              let e2 = b4[c4];
              return "function" == typeof e2 && a3 >= d3 ? e2.bind(b4) : function() {
              };
            }
            return a3 < d2.DiagLogLevel.NONE ? a3 = d2.DiagLogLevel.NONE : a3 > d2.DiagLogLevel.ALL && (a3 = d2.DiagLogLevel.ALL), b4 = b4 || {}, { error: c3("error", d2.DiagLogLevel.ERROR), warn: c3("warn", d2.DiagLogLevel.WARN), info: c3("info", d2.DiagLogLevel.INFO), debug: c3("debug", d2.DiagLogLevel.DEBUG), verbose: c3("verbose", d2.DiagLogLevel.VERBOSE) };
          };
        }, 957: (a2, b3) => {
          var c2;
          Object.defineProperty(b3, "__esModule", { value: true }), b3.DiagLogLevel = void 0, (c2 = b3.DiagLogLevel || (b3.DiagLogLevel = {}))[c2.NONE = 0] = "NONE", c2[c2.ERROR = 30] = "ERROR", c2[c2.WARN = 50] = "WARN", c2[c2.INFO = 60] = "INFO", c2[c2.DEBUG = 70] = "DEBUG", c2[c2.VERBOSE = 80] = "VERBOSE", c2[c2.ALL = 9999] = "ALL";
        }, 172: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.unregisterGlobal = b3.getGlobal = b3.registerGlobal = void 0;
          let d2 = c2(200), e2 = c2(521), f2 = c2(130), g2 = e2.VERSION.split(".")[0], h2 = Symbol.for(`opentelemetry.js.api.${g2}`), i2 = d2._globalThis;
          b3.registerGlobal = function(a3, b4, c3, d3 = false) {
            var f3;
            let g3 = i2[h2] = null != (f3 = i2[h2]) ? f3 : { version: e2.VERSION };
            if (!d3 && g3[a3]) {
              let b5 = Error(`@opentelemetry/api: Attempted duplicate registration of API: ${a3}`);
              return c3.error(b5.stack || b5.message), false;
            }
            if (g3.version !== e2.VERSION) {
              let b5 = Error(`@opentelemetry/api: Registration of version v${g3.version} for ${a3} does not match previously registered API v${e2.VERSION}`);
              return c3.error(b5.stack || b5.message), false;
            }
            return g3[a3] = b4, c3.debug(`@opentelemetry/api: Registered a global for ${a3} v${e2.VERSION}.`), true;
          }, b3.getGlobal = function(a3) {
            var b4, c3;
            let d3 = null == (b4 = i2[h2]) ? void 0 : b4.version;
            if (d3 && (0, f2.isCompatible)(d3)) return null == (c3 = i2[h2]) ? void 0 : c3[a3];
          }, b3.unregisterGlobal = function(a3, b4) {
            b4.debug(`@opentelemetry/api: Unregistering a global for ${a3} v${e2.VERSION}.`);
            let c3 = i2[h2];
            c3 && delete c3[a3];
          };
        }, 130: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.isCompatible = b3._makeCompatibilityCheck = void 0;
          let d2 = c2(521), e2 = /^(\d+)\.(\d+)\.(\d+)(-(.+))?$/;
          function f2(a3) {
            let b4 = /* @__PURE__ */ new Set([a3]), c3 = /* @__PURE__ */ new Set(), d3 = a3.match(e2);
            if (!d3) return () => false;
            let f3 = { major: +d3[1], minor: +d3[2], patch: +d3[3], prerelease: d3[4] };
            if (null != f3.prerelease) return function(b5) {
              return b5 === a3;
            };
            function g2(a4) {
              return c3.add(a4), false;
            }
            return function(a4) {
              if (b4.has(a4)) return true;
              if (c3.has(a4)) return false;
              let d4 = a4.match(e2);
              if (!d4) return g2(a4);
              let h2 = { major: +d4[1], minor: +d4[2], patch: +d4[3], prerelease: d4[4] };
              if (null != h2.prerelease || f3.major !== h2.major) return g2(a4);
              if (0 === f3.major) return f3.minor === h2.minor && f3.patch <= h2.patch ? (b4.add(a4), true) : g2(a4);
              return f3.minor <= h2.minor ? (b4.add(a4), true) : g2(a4);
            };
          }
          b3._makeCompatibilityCheck = f2, b3.isCompatible = f2(d2.VERSION);
        }, 886: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.metrics = void 0, b3.metrics = c2(653).MetricsAPI.getInstance();
        }, 901: (a2, b3) => {
          var c2;
          Object.defineProperty(b3, "__esModule", { value: true }), b3.ValueType = void 0, (c2 = b3.ValueType || (b3.ValueType = {}))[c2.INT = 0] = "INT", c2[c2.DOUBLE = 1] = "DOUBLE";
        }, 102: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.createNoopMeter = b3.NOOP_OBSERVABLE_UP_DOWN_COUNTER_METRIC = b3.NOOP_OBSERVABLE_GAUGE_METRIC = b3.NOOP_OBSERVABLE_COUNTER_METRIC = b3.NOOP_UP_DOWN_COUNTER_METRIC = b3.NOOP_HISTOGRAM_METRIC = b3.NOOP_COUNTER_METRIC = b3.NOOP_METER = b3.NoopObservableUpDownCounterMetric = b3.NoopObservableGaugeMetric = b3.NoopObservableCounterMetric = b3.NoopObservableMetric = b3.NoopHistogramMetric = b3.NoopUpDownCounterMetric = b3.NoopCounterMetric = b3.NoopMetric = b3.NoopMeter = void 0;
          class c2 {
            createHistogram(a3, c3) {
              return b3.NOOP_HISTOGRAM_METRIC;
            }
            createCounter(a3, c3) {
              return b3.NOOP_COUNTER_METRIC;
            }
            createUpDownCounter(a3, c3) {
              return b3.NOOP_UP_DOWN_COUNTER_METRIC;
            }
            createObservableGauge(a3, c3) {
              return b3.NOOP_OBSERVABLE_GAUGE_METRIC;
            }
            createObservableCounter(a3, c3) {
              return b3.NOOP_OBSERVABLE_COUNTER_METRIC;
            }
            createObservableUpDownCounter(a3, c3) {
              return b3.NOOP_OBSERVABLE_UP_DOWN_COUNTER_METRIC;
            }
            addBatchObservableCallback(a3, b4) {
            }
            removeBatchObservableCallback(a3) {
            }
          }
          b3.NoopMeter = c2;
          class d2 {
          }
          b3.NoopMetric = d2;
          class e2 extends d2 {
            add(a3, b4) {
            }
          }
          b3.NoopCounterMetric = e2;
          class f2 extends d2 {
            add(a3, b4) {
            }
          }
          b3.NoopUpDownCounterMetric = f2;
          class g2 extends d2 {
            record(a3, b4) {
            }
          }
          b3.NoopHistogramMetric = g2;
          class h2 {
            addCallback(a3) {
            }
            removeCallback(a3) {
            }
          }
          b3.NoopObservableMetric = h2;
          class i2 extends h2 {
          }
          b3.NoopObservableCounterMetric = i2;
          class j2 extends h2 {
          }
          b3.NoopObservableGaugeMetric = j2;
          class k2 extends h2 {
          }
          b3.NoopObservableUpDownCounterMetric = k2, b3.NOOP_METER = new c2(), b3.NOOP_COUNTER_METRIC = new e2(), b3.NOOP_HISTOGRAM_METRIC = new g2(), b3.NOOP_UP_DOWN_COUNTER_METRIC = new f2(), b3.NOOP_OBSERVABLE_COUNTER_METRIC = new i2(), b3.NOOP_OBSERVABLE_GAUGE_METRIC = new j2(), b3.NOOP_OBSERVABLE_UP_DOWN_COUNTER_METRIC = new k2(), b3.createNoopMeter = function() {
            return b3.NOOP_METER;
          };
        }, 660: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.NOOP_METER_PROVIDER = b3.NoopMeterProvider = void 0;
          let d2 = c2(102);
          class e2 {
            getMeter(a3, b4, c3) {
              return d2.NOOP_METER;
            }
          }
          b3.NoopMeterProvider = e2, b3.NOOP_METER_PROVIDER = new e2();
        }, 200: function(a2, b3, c2) {
          var d2 = this && this.__createBinding || (Object.create ? function(a3, b4, c3, d3) {
            void 0 === d3 && (d3 = c3), Object.defineProperty(a3, d3, { enumerable: true, get: function() {
              return b4[c3];
            } });
          } : function(a3, b4, c3, d3) {
            void 0 === d3 && (d3 = c3), a3[d3] = b4[c3];
          }), e2 = this && this.__exportStar || function(a3, b4) {
            for (var c3 in a3) "default" === c3 || Object.prototype.hasOwnProperty.call(b4, c3) || d2(b4, a3, c3);
          };
          Object.defineProperty(b3, "__esModule", { value: true }), e2(c2(46), b3);
        }, 651: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3._globalThis = void 0, b3._globalThis = "object" == typeof globalThis ? globalThis : c.g;
        }, 46: function(a2, b3, c2) {
          var d2 = this && this.__createBinding || (Object.create ? function(a3, b4, c3, d3) {
            void 0 === d3 && (d3 = c3), Object.defineProperty(a3, d3, { enumerable: true, get: function() {
              return b4[c3];
            } });
          } : function(a3, b4, c3, d3) {
            void 0 === d3 && (d3 = c3), a3[d3] = b4[c3];
          }), e2 = this && this.__exportStar || function(a3, b4) {
            for (var c3 in a3) "default" === c3 || Object.prototype.hasOwnProperty.call(b4, c3) || d2(b4, a3, c3);
          };
          Object.defineProperty(b3, "__esModule", { value: true }), e2(c2(651), b3);
        }, 939: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.propagation = void 0, b3.propagation = c2(181).PropagationAPI.getInstance();
        }, 874: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.NoopTextMapPropagator = void 0;
          class c2 {
            inject(a3, b4) {
            }
            extract(a3, b4) {
              return a3;
            }
            fields() {
              return [];
            }
          }
          b3.NoopTextMapPropagator = c2;
        }, 194: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.defaultTextMapSetter = b3.defaultTextMapGetter = void 0, b3.defaultTextMapGetter = { get(a3, b4) {
            if (null != a3) return a3[b4];
          }, keys: (a3) => null == a3 ? [] : Object.keys(a3) }, b3.defaultTextMapSetter = { set(a3, b4, c2) {
            null != a3 && (a3[b4] = c2);
          } };
        }, 845: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.trace = void 0, b3.trace = c2(997).TraceAPI.getInstance();
        }, 403: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.NonRecordingSpan = void 0;
          let d2 = c2(476);
          class e2 {
            constructor(a3 = d2.INVALID_SPAN_CONTEXT) {
              this._spanContext = a3;
            }
            spanContext() {
              return this._spanContext;
            }
            setAttribute(a3, b4) {
              return this;
            }
            setAttributes(a3) {
              return this;
            }
            addEvent(a3, b4) {
              return this;
            }
            setStatus(a3) {
              return this;
            }
            updateName(a3) {
              return this;
            }
            end(a3) {
            }
            isRecording() {
              return false;
            }
            recordException(a3, b4) {
            }
          }
          b3.NonRecordingSpan = e2;
        }, 614: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.NoopTracer = void 0;
          let d2 = c2(491), e2 = c2(607), f2 = c2(403), g2 = c2(139), h2 = d2.ContextAPI.getInstance();
          class i2 {
            startSpan(a3, b4, c3 = h2.active()) {
              var d3;
              if (null == b4 ? void 0 : b4.root) return new f2.NonRecordingSpan();
              let i3 = c3 && (0, e2.getSpanContext)(c3);
              return "object" == typeof (d3 = i3) && "string" == typeof d3.spanId && "string" == typeof d3.traceId && "number" == typeof d3.traceFlags && (0, g2.isSpanContextValid)(i3) ? new f2.NonRecordingSpan(i3) : new f2.NonRecordingSpan();
            }
            startActiveSpan(a3, b4, c3, d3) {
              let f3, g3, i3;
              if (arguments.length < 2) return;
              2 == arguments.length ? i3 = b4 : 3 == arguments.length ? (f3 = b4, i3 = c3) : (f3 = b4, g3 = c3, i3 = d3);
              let j2 = null != g3 ? g3 : h2.active(), k2 = this.startSpan(a3, f3, j2), l2 = (0, e2.setSpan)(j2, k2);
              return h2.with(l2, i3, void 0, k2);
            }
          }
          b3.NoopTracer = i2;
        }, 124: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.NoopTracerProvider = void 0;
          let d2 = c2(614);
          class e2 {
            getTracer(a3, b4, c3) {
              return new d2.NoopTracer();
            }
          }
          b3.NoopTracerProvider = e2;
        }, 125: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.ProxyTracer = void 0;
          let d2 = new (c2(614)).NoopTracer();
          class e2 {
            constructor(a3, b4, c3, d3) {
              this._provider = a3, this.name = b4, this.version = c3, this.options = d3;
            }
            startSpan(a3, b4, c3) {
              return this._getTracer().startSpan(a3, b4, c3);
            }
            startActiveSpan(a3, b4, c3, d3) {
              let e3 = this._getTracer();
              return Reflect.apply(e3.startActiveSpan, e3, arguments);
            }
            _getTracer() {
              if (this._delegate) return this._delegate;
              let a3 = this._provider.getDelegateTracer(this.name, this.version, this.options);
              return a3 ? (this._delegate = a3, this._delegate) : d2;
            }
          }
          b3.ProxyTracer = e2;
        }, 846: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.ProxyTracerProvider = void 0;
          let d2 = c2(125), e2 = new (c2(124)).NoopTracerProvider();
          class f2 {
            getTracer(a3, b4, c3) {
              var e3;
              return null != (e3 = this.getDelegateTracer(a3, b4, c3)) ? e3 : new d2.ProxyTracer(this, a3, b4, c3);
            }
            getDelegate() {
              var a3;
              return null != (a3 = this._delegate) ? a3 : e2;
            }
            setDelegate(a3) {
              this._delegate = a3;
            }
            getDelegateTracer(a3, b4, c3) {
              var d3;
              return null == (d3 = this._delegate) ? void 0 : d3.getTracer(a3, b4, c3);
            }
          }
          b3.ProxyTracerProvider = f2;
        }, 996: (a2, b3) => {
          var c2;
          Object.defineProperty(b3, "__esModule", { value: true }), b3.SamplingDecision = void 0, (c2 = b3.SamplingDecision || (b3.SamplingDecision = {}))[c2.NOT_RECORD = 0] = "NOT_RECORD", c2[c2.RECORD = 1] = "RECORD", c2[c2.RECORD_AND_SAMPLED = 2] = "RECORD_AND_SAMPLED";
        }, 607: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.getSpanContext = b3.setSpanContext = b3.deleteSpan = b3.setSpan = b3.getActiveSpan = b3.getSpan = void 0;
          let d2 = c2(780), e2 = c2(403), f2 = c2(491), g2 = (0, d2.createContextKey)("OpenTelemetry Context Key SPAN");
          function h2(a3) {
            return a3.getValue(g2) || void 0;
          }
          function i2(a3, b4) {
            return a3.setValue(g2, b4);
          }
          b3.getSpan = h2, b3.getActiveSpan = function() {
            return h2(f2.ContextAPI.getInstance().active());
          }, b3.setSpan = i2, b3.deleteSpan = function(a3) {
            return a3.deleteValue(g2);
          }, b3.setSpanContext = function(a3, b4) {
            return i2(a3, new e2.NonRecordingSpan(b4));
          }, b3.getSpanContext = function(a3) {
            var b4;
            return null == (b4 = h2(a3)) ? void 0 : b4.spanContext();
          };
        }, 325: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.TraceStateImpl = void 0;
          let d2 = c2(564);
          class e2 {
            constructor(a3) {
              this._internalState = /* @__PURE__ */ new Map(), a3 && this._parse(a3);
            }
            set(a3, b4) {
              let c3 = this._clone();
              return c3._internalState.has(a3) && c3._internalState.delete(a3), c3._internalState.set(a3, b4), c3;
            }
            unset(a3) {
              let b4 = this._clone();
              return b4._internalState.delete(a3), b4;
            }
            get(a3) {
              return this._internalState.get(a3);
            }
            serialize() {
              return this._keys().reduce((a3, b4) => (a3.push(b4 + "=" + this.get(b4)), a3), []).join(",");
            }
            _parse(a3) {
              !(a3.length > 512) && (this._internalState = a3.split(",").reverse().reduce((a4, b4) => {
                let c3 = b4.trim(), e3 = c3.indexOf("=");
                if (-1 !== e3) {
                  let f2 = c3.slice(0, e3), g2 = c3.slice(e3 + 1, b4.length);
                  (0, d2.validateKey)(f2) && (0, d2.validateValue)(g2) && a4.set(f2, g2);
                }
                return a4;
              }, /* @__PURE__ */ new Map()), this._internalState.size > 32 && (this._internalState = new Map(Array.from(this._internalState.entries()).reverse().slice(0, 32))));
            }
            _keys() {
              return Array.from(this._internalState.keys()).reverse();
            }
            _clone() {
              let a3 = new e2();
              return a3._internalState = new Map(this._internalState), a3;
            }
          }
          b3.TraceStateImpl = e2;
        }, 564: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.validateValue = b3.validateKey = void 0;
          let c2 = "[_0-9a-z-*/]", d2 = `[a-z]${c2}{0,255}`, e2 = `[a-z0-9]${c2}{0,240}@[a-z]${c2}{0,13}`, f2 = RegExp(`^(?:${d2}|${e2})$`), g2 = /^[ -~]{0,255}[!-~]$/, h2 = /,|=/;
          b3.validateKey = function(a3) {
            return f2.test(a3);
          }, b3.validateValue = function(a3) {
            return g2.test(a3) && !h2.test(a3);
          };
        }, 98: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.createTraceState = void 0;
          let d2 = c2(325);
          b3.createTraceState = function(a3) {
            return new d2.TraceStateImpl(a3);
          };
        }, 476: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.INVALID_SPAN_CONTEXT = b3.INVALID_TRACEID = b3.INVALID_SPANID = void 0;
          let d2 = c2(475);
          b3.INVALID_SPANID = "0000000000000000", b3.INVALID_TRACEID = "00000000000000000000000000000000", b3.INVALID_SPAN_CONTEXT = { traceId: b3.INVALID_TRACEID, spanId: b3.INVALID_SPANID, traceFlags: d2.TraceFlags.NONE };
        }, 357: (a2, b3) => {
          var c2;
          Object.defineProperty(b3, "__esModule", { value: true }), b3.SpanKind = void 0, (c2 = b3.SpanKind || (b3.SpanKind = {}))[c2.INTERNAL = 0] = "INTERNAL", c2[c2.SERVER = 1] = "SERVER", c2[c2.CLIENT = 2] = "CLIENT", c2[c2.PRODUCER = 3] = "PRODUCER", c2[c2.CONSUMER = 4] = "CONSUMER";
        }, 139: (a2, b3, c2) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.wrapSpanContext = b3.isSpanContextValid = b3.isValidSpanId = b3.isValidTraceId = void 0;
          let d2 = c2(476), e2 = c2(403), f2 = /^([0-9a-f]{32})$/i, g2 = /^[0-9a-f]{16}$/i;
          function h2(a3) {
            return f2.test(a3) && a3 !== d2.INVALID_TRACEID;
          }
          function i2(a3) {
            return g2.test(a3) && a3 !== d2.INVALID_SPANID;
          }
          b3.isValidTraceId = h2, b3.isValidSpanId = i2, b3.isSpanContextValid = function(a3) {
            return h2(a3.traceId) && i2(a3.spanId);
          }, b3.wrapSpanContext = function(a3) {
            return new e2.NonRecordingSpan(a3);
          };
        }, 847: (a2, b3) => {
          var c2;
          Object.defineProperty(b3, "__esModule", { value: true }), b3.SpanStatusCode = void 0, (c2 = b3.SpanStatusCode || (b3.SpanStatusCode = {}))[c2.UNSET = 0] = "UNSET", c2[c2.OK = 1] = "OK", c2[c2.ERROR = 2] = "ERROR";
        }, 475: (a2, b3) => {
          var c2;
          Object.defineProperty(b3, "__esModule", { value: true }), b3.TraceFlags = void 0, (c2 = b3.TraceFlags || (b3.TraceFlags = {}))[c2.NONE = 0] = "NONE", c2[c2.SAMPLED = 1] = "SAMPLED";
        }, 521: (a2, b3) => {
          Object.defineProperty(b3, "__esModule", { value: true }), b3.VERSION = void 0, b3.VERSION = "1.6.0";
        } }, y = {};
        function z(a2) {
          var b3 = y[a2];
          if (void 0 !== b3) return b3.exports;
          var c2 = y[a2] = { exports: {} }, d2 = true;
          try {
            x[a2].call(c2.exports, c2, c2.exports, z), d2 = false;
          } finally {
            d2 && delete y[a2];
          }
          return c2.exports;
        }
        z.ab = "//";
        var A = {};
        Object.defineProperty(A, "__esModule", { value: true }), A.trace = A.propagation = A.metrics = A.diag = A.context = A.INVALID_SPAN_CONTEXT = A.INVALID_TRACEID = A.INVALID_SPANID = A.isValidSpanId = A.isValidTraceId = A.isSpanContextValid = A.createTraceState = A.TraceFlags = A.SpanStatusCode = A.SpanKind = A.SamplingDecision = A.ProxyTracerProvider = A.ProxyTracer = A.defaultTextMapSetter = A.defaultTextMapGetter = A.ValueType = A.createNoopMeter = A.DiagLogLevel = A.DiagConsoleLogger = A.ROOT_CONTEXT = A.createContextKey = A.baggageEntryMetadataFromString = void 0, h = z(369), Object.defineProperty(A, "baggageEntryMetadataFromString", { enumerable: true, get: function() {
          return h.baggageEntryMetadataFromString;
        } }), i = z(780), Object.defineProperty(A, "createContextKey", { enumerable: true, get: function() {
          return i.createContextKey;
        } }), Object.defineProperty(A, "ROOT_CONTEXT", { enumerable: true, get: function() {
          return i.ROOT_CONTEXT;
        } }), j = z(972), Object.defineProperty(A, "DiagConsoleLogger", { enumerable: true, get: function() {
          return j.DiagConsoleLogger;
        } }), k = z(957), Object.defineProperty(A, "DiagLogLevel", { enumerable: true, get: function() {
          return k.DiagLogLevel;
        } }), l = z(102), Object.defineProperty(A, "createNoopMeter", { enumerable: true, get: function() {
          return l.createNoopMeter;
        } }), m = z(901), Object.defineProperty(A, "ValueType", { enumerable: true, get: function() {
          return m.ValueType;
        } }), n = z(194), Object.defineProperty(A, "defaultTextMapGetter", { enumerable: true, get: function() {
          return n.defaultTextMapGetter;
        } }), Object.defineProperty(A, "defaultTextMapSetter", { enumerable: true, get: function() {
          return n.defaultTextMapSetter;
        } }), o = z(125), Object.defineProperty(A, "ProxyTracer", { enumerable: true, get: function() {
          return o.ProxyTracer;
        } }), p = z(846), Object.defineProperty(A, "ProxyTracerProvider", { enumerable: true, get: function() {
          return p.ProxyTracerProvider;
        } }), q = z(996), Object.defineProperty(A, "SamplingDecision", { enumerable: true, get: function() {
          return q.SamplingDecision;
        } }), r = z(357), Object.defineProperty(A, "SpanKind", { enumerable: true, get: function() {
          return r.SpanKind;
        } }), s = z(847), Object.defineProperty(A, "SpanStatusCode", { enumerable: true, get: function() {
          return s.SpanStatusCode;
        } }), t = z(475), Object.defineProperty(A, "TraceFlags", { enumerable: true, get: function() {
          return t.TraceFlags;
        } }), u = z(98), Object.defineProperty(A, "createTraceState", { enumerable: true, get: function() {
          return u.createTraceState;
        } }), v = z(139), Object.defineProperty(A, "isSpanContextValid", { enumerable: true, get: function() {
          return v.isSpanContextValid;
        } }), Object.defineProperty(A, "isValidTraceId", { enumerable: true, get: function() {
          return v.isValidTraceId;
        } }), Object.defineProperty(A, "isValidSpanId", { enumerable: true, get: function() {
          return v.isValidSpanId;
        } }), w = z(476), Object.defineProperty(A, "INVALID_SPANID", { enumerable: true, get: function() {
          return w.INVALID_SPANID;
        } }), Object.defineProperty(A, "INVALID_TRACEID", { enumerable: true, get: function() {
          return w.INVALID_TRACEID;
        } }), Object.defineProperty(A, "INVALID_SPAN_CONTEXT", { enumerable: true, get: function() {
          return w.INVALID_SPAN_CONTEXT;
        } }), b2 = z(67), Object.defineProperty(A, "context", { enumerable: true, get: function() {
          return b2.context;
        } }), d = z(506), Object.defineProperty(A, "diag", { enumerable: true, get: function() {
          return d.diag;
        } }), e = z(886), Object.defineProperty(A, "metrics", { enumerable: true, get: function() {
          return e.metrics;
        } }), f = z(939), Object.defineProperty(A, "propagation", { enumerable: true, get: function() {
          return f.propagation;
        } }), g = z(845), Object.defineProperty(A, "trace", { enumerable: true, get: function() {
          return g.trace;
        } }), A.default = { context: b2.context, diag: d.diag, metrics: e.metrics, propagation: f.propagation, trace: g.trace }, a.exports = A;
      })();
    }, 521: (a) => {
      "use strict";
      a.exports = (init_node_async_hooks(), __toCommonJS(node_async_hooks_exports));
    }, 643: (a, b, c) => {
      "use strict";
      Object.defineProperty(b, "__esModule", { value: true });
      var d = { getTestReqInfo: function() {
        return i;
      }, withRequest: function() {
        return h;
      } };
      for (var e in d) Object.defineProperty(b, e, { enumerable: true, get: d[e] });
      let f = new (c(521)).AsyncLocalStorage();
      function g(a2, b2) {
        let c2 = b2.header(a2, "next-test-proxy-port");
        if (!c2) return;
        let d2 = b2.url(a2);
        return { url: d2, proxyPort: Number(c2), testData: b2.header(a2, "next-test-data") || "" };
      }
      function h(a2, b2, c2) {
        let d2 = g(a2, b2);
        return d2 ? f.run(d2, c2) : c2();
      }
      function i(a2, b2) {
        let c2 = f.getStore();
        return c2 || (a2 && b2 ? g(a2, b2) : void 0);
      }
    }, 654: (a, b, c) => {
      "use strict";
      a.exports = c(42);
    }, 691: (a, b, c) => {
      "use strict";
      let d, e, f;
      c.r(b), c.d(b, { default: () => f5, handler: () => f4 });
      var g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v = {};
      async function w() {
        return "_ENTRIES" in globalThis && _ENTRIES.middleware_instrumentation && await _ENTRIES.middleware_instrumentation;
      }
      c.r(v), c.d(v, { config: () => f$, middleware: () => fZ });
      let x = null;
      async function y() {
        if ("phase-production-build" === process.env.NEXT_PHASE) return;
        x || (x = w());
        let a10 = await x;
        if (null == a10 ? void 0 : a10.register) try {
          await a10.register();
        } catch (a11) {
          throw a11.message = `An error occurred while loading instrumentation hook: ${a11.message}`, a11;
        }
      }
      async function z(...a10) {
        let b10 = await w();
        try {
          var c10;
          await (null == b10 || null == (c10 = b10.onRequestError) ? void 0 : c10.call(b10, ...a10));
        } catch (a11) {
          console.error("Error in instrumentation.onRequestError:", a11);
        }
      }
      let A = null;
      function B() {
        return A || (A = y()), A;
      }
      function C(a10) {
        return `The edge runtime does not support Node.js '${a10}' module.
Learn More: https://nextjs.org/docs/messages/node-module-in-edge-runtime`;
      }
      process !== c.g.process && (process.env = c.g.process.env, c.g.process = process);
      try {
        Object.defineProperty(globalThis, "__import_unsupported", { value: function(a10) {
          let b10 = new Proxy(function() {
          }, { get(b11, c10) {
            if ("then" === c10) return {};
            throw Object.defineProperty(Error(C(a10)), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
          }, construct() {
            throw Object.defineProperty(Error(C(a10)), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
          }, apply(c10, d10, e10) {
            if ("function" == typeof e10[0]) return e10[0](b10);
            throw Object.defineProperty(Error(C(a10)), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
          } });
          return new Proxy({}, { get: () => b10 });
        }, enumerable: false, configurable: false });
      } catch {
      }
      B();
      class D extends Error {
        constructor({ page: a10 }) {
          super(`The middleware "${a10}" accepts an async API directly with the form:
  
  export function middleware(request, event) {
    return NextResponse.redirect('/new-location')
  }
  
  Read more: https://nextjs.org/docs/messages/middleware-new-signature
  `);
        }
      }
      class E extends Error {
        constructor() {
          super("The request.page has been deprecated in favour of `URLPattern`.\n  Read more: https://nextjs.org/docs/messages/middleware-request-page\n  ");
        }
      }
      class F extends Error {
        constructor() {
          super("The request.ua has been removed in favour of `userAgent` function.\n  Read more: https://nextjs.org/docs/messages/middleware-parse-user-agent\n  ");
        }
      }
      let G = "x-prerender-revalidate", H = ".meta", I = "x-next-cache-tags", J = "x-next-revalidated-tags", K = "_N_T_", L = { shared: "shared", reactServerComponents: "rsc", serverSideRendering: "ssr", actionBrowser: "action-browser", apiNode: "api-node", apiEdge: "api-edge", middleware: "middleware", instrument: "instrument", edgeAsset: "edge-asset", appPagesBrowser: "app-pages-browser", pagesDirBrowser: "pages-dir-browser", pagesDirEdge: "pages-dir-edge", pagesDirNode: "pages-dir-node" };
      function M(a10) {
        var b10, c10, d10, e10, f6, g2 = [], h2 = 0;
        function i2() {
          for (; h2 < a10.length && /\s/.test(a10.charAt(h2)); ) h2 += 1;
          return h2 < a10.length;
        }
        for (; h2 < a10.length; ) {
          for (b10 = h2, f6 = false; i2(); ) if ("," === (c10 = a10.charAt(h2))) {
            for (d10 = h2, h2 += 1, i2(), e10 = h2; h2 < a10.length && "=" !== (c10 = a10.charAt(h2)) && ";" !== c10 && "," !== c10; ) h2 += 1;
            h2 < a10.length && "=" === a10.charAt(h2) ? (f6 = true, h2 = e10, g2.push(a10.substring(b10, d10)), b10 = h2) : h2 = d10 + 1;
          } else h2 += 1;
          (!f6 || h2 >= a10.length) && g2.push(a10.substring(b10, a10.length));
        }
        return g2;
      }
      function N(a10) {
        let b10 = {}, c10 = [];
        if (a10) for (let [d10, e10] of a10.entries()) "set-cookie" === d10.toLowerCase() ? (c10.push(...M(e10)), b10[d10] = 1 === c10.length ? c10[0] : c10) : b10[d10] = e10;
        return b10;
      }
      function O(a10) {
        try {
          return String(new URL(String(a10)));
        } catch (b10) {
          throw Object.defineProperty(Error(`URL is malformed "${String(a10)}". Please use only absolute URLs - https://nextjs.org/docs/messages/middleware-relative-urls`, { cause: b10 }), "__NEXT_ERROR_CODE", { value: "E61", enumerable: false, configurable: true });
        }
      }
      ({ ...L, GROUP: { builtinReact: [L.reactServerComponents, L.actionBrowser], serverOnly: [L.reactServerComponents, L.actionBrowser, L.instrument, L.middleware], neutralTarget: [L.apiNode, L.apiEdge], clientOnly: [L.serverSideRendering, L.appPagesBrowser], bundled: [L.reactServerComponents, L.actionBrowser, L.serverSideRendering, L.appPagesBrowser, L.shared, L.instrument, L.middleware], appPages: [L.reactServerComponents, L.serverSideRendering, L.appPagesBrowser, L.actionBrowser] } });
      let P = Symbol("response"), Q = Symbol("passThrough"), R = Symbol("waitUntil");
      class S {
        constructor(a10, b10) {
          this[Q] = false, this[R] = b10 ? { kind: "external", function: b10 } : { kind: "internal", promises: [] };
        }
        respondWith(a10) {
          this[P] || (this[P] = Promise.resolve(a10));
        }
        passThroughOnException() {
          this[Q] = true;
        }
        waitUntil(a10) {
          if ("external" === this[R].kind) return (0, this[R].function)(a10);
          this[R].promises.push(a10);
        }
      }
      class T extends S {
        constructor(a10) {
          var b10;
          super(a10.request, null == (b10 = a10.context) ? void 0 : b10.waitUntil), this.sourcePage = a10.page;
        }
        get request() {
          throw Object.defineProperty(new D({ page: this.sourcePage }), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
        }
        respondWith() {
          throw Object.defineProperty(new D({ page: this.sourcePage }), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
        }
      }
      function U(a10) {
        return a10.replace(/\/$/, "") || "/";
      }
      function V(a10) {
        let b10 = a10.indexOf("#"), c10 = a10.indexOf("?"), d10 = c10 > -1 && (b10 < 0 || c10 < b10);
        return d10 || b10 > -1 ? { pathname: a10.substring(0, d10 ? c10 : b10), query: d10 ? a10.substring(c10, b10 > -1 ? b10 : void 0) : "", hash: b10 > -1 ? a10.slice(b10) : "" } : { pathname: a10, query: "", hash: "" };
      }
      function W(a10, b10) {
        if (!a10.startsWith("/") || !b10) return a10;
        let { pathname: c10, query: d10, hash: e10 } = V(a10);
        return `${b10}${c10}${d10}${e10}`;
      }
      function X(a10, b10) {
        if (!a10.startsWith("/") || !b10) return a10;
        let { pathname: c10, query: d10, hash: e10 } = V(a10);
        return `${c10}${b10}${d10}${e10}`;
      }
      function Y(a10, b10) {
        if ("string" != typeof a10) return false;
        let { pathname: c10 } = V(a10);
        return c10 === b10 || c10.startsWith(b10 + "/");
      }
      let Z = /* @__PURE__ */ new WeakMap();
      function $(a10, b10) {
        let c10;
        if (!b10) return { pathname: a10 };
        let d10 = Z.get(b10);
        d10 || (d10 = b10.map((a11) => a11.toLowerCase()), Z.set(b10, d10));
        let e10 = a10.split("/", 2);
        if (!e10[1]) return { pathname: a10 };
        let f6 = e10[1].toLowerCase(), g2 = d10.indexOf(f6);
        return g2 < 0 ? { pathname: a10 } : (c10 = b10[g2], { pathname: a10 = a10.slice(c10.length + 1) || "/", detectedLocale: c10 });
      }
      let _ = /^(?:127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}|\[::1\]|localhost)$/;
      function aa(a10, b10) {
        let c10 = new URL(String(a10), b10 && String(b10));
        return _.test(c10.hostname) && (c10.hostname = "localhost"), c10;
      }
      let ab = Symbol("NextURLInternal");
      class ac {
        constructor(a10, b10, c10) {
          let d10, e10;
          "object" == typeof b10 && "pathname" in b10 || "string" == typeof b10 ? (d10 = b10, e10 = c10 || {}) : e10 = c10 || b10 || {}, this[ab] = { url: aa(a10, d10 ?? e10.base), options: e10, basePath: "" }, this.analyze();
        }
        analyze() {
          var a10, b10, c10, d10, e10;
          let f6 = function(a11, b11) {
            let { basePath: c11, i18n: d11, trailingSlash: e11 } = b11.nextConfig ?? {}, f7 = { pathname: a11, trailingSlash: "/" !== a11 ? a11.endsWith("/") : e11 };
            c11 && Y(f7.pathname, c11) && (f7.pathname = function(a12, b12) {
              if (!Y(a12, b12)) return a12;
              let c12 = a12.slice(b12.length);
              return c12.startsWith("/") ? c12 : `/${c12}`;
            }(f7.pathname, c11), f7.basePath = c11);
            let g3 = f7.pathname;
            if (f7.pathname.startsWith("/_next/data/") && f7.pathname.endsWith(".json")) {
              let a12 = f7.pathname.replace(/^\/_next\/data\//, "").replace(/\.json$/, "").split("/");
              f7.buildId = a12[0], g3 = "index" !== a12[1] ? `/${a12.slice(1).join("/")}` : "/", true === b11.parseData && (f7.pathname = g3);
            }
            if (d11) {
              let a12 = b11.i18nProvider ? b11.i18nProvider.analyze(f7.pathname) : $(f7.pathname, d11.locales);
              f7.locale = a12.detectedLocale, f7.pathname = a12.pathname ?? f7.pathname, !a12.detectedLocale && f7.buildId && (a12 = b11.i18nProvider ? b11.i18nProvider.analyze(g3) : $(g3, d11.locales)).detectedLocale && (f7.locale = a12.detectedLocale);
            }
            return f7;
          }(this[ab].url.pathname, { nextConfig: this[ab].options.nextConfig, parseData: true, i18nProvider: this[ab].options.i18nProvider }), g2 = function(a11, b11) {
            let c11;
            if (b11?.host && !Array.isArray(b11.host)) c11 = b11.host.toString().split(":", 1)[0];
            else {
              if (!a11.hostname) return;
              c11 = a11.hostname;
            }
            return c11.toLowerCase();
          }(this[ab].url, this[ab].options.headers);
          this[ab].domainLocale = this[ab].options.i18nProvider ? this[ab].options.i18nProvider.detectDomainLocale(g2) : function(a11, b11, c11) {
            if (a11) {
              for (let d11 of (c11 && (c11 = c11.toLowerCase()), a11)) if (b11 === d11.domain?.split(":", 1)[0].toLowerCase() || c11 === d11.defaultLocale.toLowerCase() || d11.locales?.some((a12) => a12.toLowerCase() === c11)) return d11;
            }
          }(null == (b10 = this[ab].options.nextConfig) || null == (a10 = b10.i18n) ? void 0 : a10.domains, g2);
          let h2 = (null == (c10 = this[ab].domainLocale) ? void 0 : c10.defaultLocale) || (null == (e10 = this[ab].options.nextConfig) || null == (d10 = e10.i18n) ? void 0 : d10.defaultLocale);
          this[ab].url.pathname = f6.pathname, this[ab].defaultLocale = h2, this[ab].basePath = f6.basePath ?? "", this[ab].buildId = f6.buildId, this[ab].locale = f6.locale ?? h2, this[ab].trailingSlash = f6.trailingSlash;
        }
        formatPathname() {
          var a10;
          let b10;
          return b10 = function(a11, b11, c10, d10) {
            if (!b11 || b11 === c10) return a11;
            let e10 = a11.toLowerCase();
            return !d10 && (Y(e10, "/api") || Y(e10, `/${b11.toLowerCase()}`)) ? a11 : W(a11, `/${b11}`);
          }((a10 = { basePath: this[ab].basePath, buildId: this[ab].buildId, defaultLocale: this[ab].options.forceLocale ? void 0 : this[ab].defaultLocale, locale: this[ab].locale, pathname: this[ab].url.pathname, trailingSlash: this[ab].trailingSlash }).pathname, a10.locale, a10.buildId ? void 0 : a10.defaultLocale, a10.ignorePrefix), (a10.buildId || !a10.trailingSlash) && (b10 = U(b10)), a10.buildId && (b10 = X(W(b10, `/_next/data/${a10.buildId}`), "/" === a10.pathname ? "index.json" : ".json")), b10 = W(b10, a10.basePath), !a10.buildId && a10.trailingSlash ? b10.endsWith("/") ? b10 : X(b10, "/") : U(b10);
        }
        formatSearch() {
          return this[ab].url.search;
        }
        get buildId() {
          return this[ab].buildId;
        }
        set buildId(a10) {
          this[ab].buildId = a10;
        }
        get locale() {
          return this[ab].locale ?? "";
        }
        set locale(a10) {
          var b10, c10;
          if (!this[ab].locale || !(null == (c10 = this[ab].options.nextConfig) || null == (b10 = c10.i18n) ? void 0 : b10.locales.includes(a10))) throw Object.defineProperty(TypeError(`The NextURL configuration includes no locale "${a10}"`), "__NEXT_ERROR_CODE", { value: "E597", enumerable: false, configurable: true });
          this[ab].locale = a10;
        }
        get defaultLocale() {
          return this[ab].defaultLocale;
        }
        get domainLocale() {
          return this[ab].domainLocale;
        }
        get searchParams() {
          return this[ab].url.searchParams;
        }
        get host() {
          return this[ab].url.host;
        }
        set host(a10) {
          this[ab].url.host = a10;
        }
        get hostname() {
          return this[ab].url.hostname;
        }
        set hostname(a10) {
          this[ab].url.hostname = a10;
        }
        get port() {
          return this[ab].url.port;
        }
        set port(a10) {
          this[ab].url.port = a10;
        }
        get protocol() {
          return this[ab].url.protocol;
        }
        set protocol(a10) {
          this[ab].url.protocol = a10;
        }
        get href() {
          let a10 = this.formatPathname(), b10 = this.formatSearch();
          return `${this.protocol}//${this.host}${a10}${b10}${this.hash}`;
        }
        set href(a10) {
          this[ab].url = aa(a10), this.analyze();
        }
        get origin() {
          return this[ab].url.origin;
        }
        get pathname() {
          return this[ab].url.pathname;
        }
        set pathname(a10) {
          this[ab].url.pathname = a10;
        }
        get hash() {
          return this[ab].url.hash;
        }
        set hash(a10) {
          this[ab].url.hash = a10;
        }
        get search() {
          return this[ab].url.search;
        }
        set search(a10) {
          this[ab].url.search = a10;
        }
        get password() {
          return this[ab].url.password;
        }
        set password(a10) {
          this[ab].url.password = a10;
        }
        get username() {
          return this[ab].url.username;
        }
        set username(a10) {
          this[ab].url.username = a10;
        }
        get basePath() {
          return this[ab].basePath;
        }
        set basePath(a10) {
          this[ab].basePath = a10.startsWith("/") ? a10 : `/${a10}`;
        }
        toString() {
          return this.href;
        }
        toJSON() {
          return this.href;
        }
        [Symbol.for("edge-runtime.inspect.custom")]() {
          return { href: this.href, origin: this.origin, protocol: this.protocol, username: this.username, password: this.password, host: this.host, hostname: this.hostname, port: this.port, pathname: this.pathname, search: this.search, searchParams: this.searchParams, hash: this.hash };
        }
        clone() {
          return new ac(String(this), this[ab].options);
        }
      }
      var ad = c(918);
      let ae = Symbol("internal request");
      class af extends Request {
        constructor(a10, b10 = {}) {
          const c10 = "string" != typeof a10 && "url" in a10 ? a10.url : String(a10);
          O(c10), a10 instanceof Request ? super(a10, b10) : super(c10, b10);
          const d10 = new ac(c10, { headers: N(this.headers), nextConfig: b10.nextConfig });
          this[ae] = { cookies: new ad.RequestCookies(this.headers), nextUrl: d10, url: d10.toString() };
        }
        [Symbol.for("edge-runtime.inspect.custom")]() {
          return { cookies: this.cookies, nextUrl: this.nextUrl, url: this.url, bodyUsed: this.bodyUsed, cache: this.cache, credentials: this.credentials, destination: this.destination, headers: Object.fromEntries(this.headers), integrity: this.integrity, keepalive: this.keepalive, method: this.method, mode: this.mode, redirect: this.redirect, referrer: this.referrer, referrerPolicy: this.referrerPolicy, signal: this.signal };
        }
        get cookies() {
          return this[ae].cookies;
        }
        get nextUrl() {
          return this[ae].nextUrl;
        }
        get page() {
          throw new E();
        }
        get ua() {
          throw new F();
        }
        get url() {
          return this[ae].url;
        }
      }
      class ag {
        static get(a10, b10, c10) {
          let d10 = Reflect.get(a10, b10, c10);
          return "function" == typeof d10 ? d10.bind(a10) : d10;
        }
        static set(a10, b10, c10, d10) {
          return Reflect.set(a10, b10, c10, d10);
        }
        static has(a10, b10) {
          return Reflect.has(a10, b10);
        }
        static deleteProperty(a10, b10) {
          return Reflect.deleteProperty(a10, b10);
        }
      }
      let ah = Symbol("internal response"), ai = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
      function aj(a10, b10) {
        var c10;
        if (null == a10 || null == (c10 = a10.request) ? void 0 : c10.headers) {
          if (!(a10.request.headers instanceof Headers)) throw Object.defineProperty(Error("request.headers must be an instance of Headers"), "__NEXT_ERROR_CODE", { value: "E119", enumerable: false, configurable: true });
          let c11 = [];
          for (let [d10, e10] of a10.request.headers) b10.set("x-middleware-request-" + d10, e10), c11.push(d10);
          b10.set("x-middleware-override-headers", c11.join(","));
        }
      }
      class ak extends Response {
        constructor(a10, b10 = {}) {
          super(a10, b10);
          const c10 = this.headers, d10 = new Proxy(new ad.ResponseCookies(c10), { get(a11, d11, e10) {
            switch (d11) {
              case "delete":
              case "set":
                return (...e11) => {
                  let f6 = Reflect.apply(a11[d11], a11, e11), g2 = new Headers(c10);
                  return f6 instanceof ad.ResponseCookies && c10.set("x-middleware-set-cookie", f6.getAll().map((a12) => (0, ad.stringifyCookie)(a12)).join(",")), aj(b10, g2), f6;
                };
              default:
                return ag.get(a11, d11, e10);
            }
          } });
          this[ah] = { cookies: d10, url: b10.url ? new ac(b10.url, { headers: N(c10), nextConfig: b10.nextConfig }) : void 0 };
        }
        [Symbol.for("edge-runtime.inspect.custom")]() {
          return { cookies: this.cookies, url: this.url, body: this.body, bodyUsed: this.bodyUsed, headers: Object.fromEntries(this.headers), ok: this.ok, redirected: this.redirected, status: this.status, statusText: this.statusText, type: this.type };
        }
        get cookies() {
          return this[ah].cookies;
        }
        static json(a10, b10) {
          let c10 = Response.json(a10, b10);
          return new ak(c10.body, c10);
        }
        static redirect(a10, b10) {
          let c10 = "number" == typeof b10 ? b10 : (null == b10 ? void 0 : b10.status) ?? 307;
          if (!ai.has(c10)) throw Object.defineProperty(RangeError('Failed to execute "redirect" on "response": Invalid status code'), "__NEXT_ERROR_CODE", { value: "E529", enumerable: false, configurable: true });
          let d10 = "object" == typeof b10 ? b10 : {}, e10 = new Headers(null == d10 ? void 0 : d10.headers);
          return e10.set("Location", O(a10)), new ak(null, { ...d10, headers: e10, status: c10 });
        }
        static rewrite(a10, b10) {
          let c10 = new Headers(null == b10 ? void 0 : b10.headers);
          return c10.set("x-middleware-rewrite", O(a10)), aj(b10, c10), new ak(null, { ...b10, headers: c10 });
        }
        static next(a10) {
          let b10 = new Headers(null == a10 ? void 0 : a10.headers);
          return b10.set("x-middleware-next", "1"), aj(a10, b10), new ak(null, { ...a10, headers: b10 });
        }
      }
      function al(a10, b10) {
        let c10 = "string" == typeof b10 ? new URL(b10) : b10, d10 = new URL(a10, b10), e10 = d10.origin === c10.origin;
        return { url: e10 ? d10.toString().slice(c10.origin.length) : d10.toString(), isRelative: e10 };
      }
      let am = "next-router-prefetch", an = ["rsc", "next-router-state-tree", am, "next-hmr-refresh", "next-router-segment-prefetch"], ao = "_rsc";
      function ap(a10) {
        return a10.startsWith("/") ? a10 : `/${a10}`;
      }
      function aq(a10) {
        return ap(a10.split("/").reduce((a11, b10, c10, d10) => b10 ? "(" === b10[0] && b10.endsWith(")") || "@" === b10[0] || ("page" === b10 || "route" === b10) && c10 === d10.length - 1 ? a11 : `${a11}/${b10}` : a11, ""));
      }
      class ar extends Error {
        constructor() {
          super("Headers cannot be modified. Read more: https://nextjs.org/docs/app/api-reference/functions/headers");
        }
        static callable() {
          throw new ar();
        }
      }
      class as extends Headers {
        constructor(a10) {
          super(), this.headers = new Proxy(a10, { get(b10, c10, d10) {
            if ("symbol" == typeof c10) return ag.get(b10, c10, d10);
            let e10 = c10.toLowerCase(), f6 = Object.keys(a10).find((a11) => a11.toLowerCase() === e10);
            if (void 0 !== f6) return ag.get(b10, f6, d10);
          }, set(b10, c10, d10, e10) {
            if ("symbol" == typeof c10) return ag.set(b10, c10, d10, e10);
            let f6 = c10.toLowerCase(), g2 = Object.keys(a10).find((a11) => a11.toLowerCase() === f6);
            return ag.set(b10, g2 ?? c10, d10, e10);
          }, has(b10, c10) {
            if ("symbol" == typeof c10) return ag.has(b10, c10);
            let d10 = c10.toLowerCase(), e10 = Object.keys(a10).find((a11) => a11.toLowerCase() === d10);
            return void 0 !== e10 && ag.has(b10, e10);
          }, deleteProperty(b10, c10) {
            if ("symbol" == typeof c10) return ag.deleteProperty(b10, c10);
            let d10 = c10.toLowerCase(), e10 = Object.keys(a10).find((a11) => a11.toLowerCase() === d10);
            return void 0 === e10 || ag.deleteProperty(b10, e10);
          } });
        }
        static seal(a10) {
          return new Proxy(a10, { get(a11, b10, c10) {
            switch (b10) {
              case "append":
              case "delete":
              case "set":
                return ar.callable;
              default:
                return ag.get(a11, b10, c10);
            }
          } });
        }
        merge(a10) {
          return Array.isArray(a10) ? a10.join(", ") : a10;
        }
        static from(a10) {
          return a10 instanceof Headers ? a10 : new as(a10);
        }
        append(a10, b10) {
          let c10 = this.headers[a10];
          "string" == typeof c10 ? this.headers[a10] = [c10, b10] : Array.isArray(c10) ? c10.push(b10) : this.headers[a10] = b10;
        }
        delete(a10) {
          delete this.headers[a10];
        }
        get(a10) {
          let b10 = this.headers[a10];
          return void 0 !== b10 ? this.merge(b10) : null;
        }
        has(a10) {
          return void 0 !== this.headers[a10];
        }
        set(a10, b10) {
          this.headers[a10] = b10;
        }
        forEach(a10, b10) {
          for (let [c10, d10] of this.entries()) a10.call(b10, d10, c10, this);
        }
        *entries() {
          for (let a10 of Object.keys(this.headers)) {
            let b10 = a10.toLowerCase(), c10 = this.get(b10);
            yield [b10, c10];
          }
        }
        *keys() {
          for (let a10 of Object.keys(this.headers)) {
            let b10 = a10.toLowerCase();
            yield b10;
          }
        }
        *values() {
          for (let a10 of Object.keys(this.headers)) {
            let b10 = this.get(a10);
            yield b10;
          }
        }
        [Symbol.iterator]() {
          return this.entries();
        }
      }
      let at = Object.defineProperty(Error("Invariant: AsyncLocalStorage accessed in runtime where it is not available"), "__NEXT_ERROR_CODE", { value: "E504", enumerable: false, configurable: true });
      class au {
        disable() {
          throw at;
        }
        getStore() {
        }
        run() {
          throw at;
        }
        exit() {
          throw at;
        }
        enterWith() {
          throw at;
        }
        static bind(a10) {
          return a10;
        }
      }
      let av = "u" > typeof globalThis && globalThis.AsyncLocalStorage;
      function aw() {
        return av ? new av() : new au();
      }
      let ax = aw();
      class ay extends Error {
        constructor() {
          super("Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options");
        }
        static callable() {
          throw new ay();
        }
      }
      class az {
        static seal(a10) {
          return new Proxy(a10, { get(a11, b10, c10) {
            switch (b10) {
              case "clear":
              case "delete":
              case "set":
                return ay.callable;
              default:
                return ag.get(a11, b10, c10);
            }
          } });
        }
      }
      let aA = Symbol.for("next.mutated.cookies");
      class aB {
        static wrap(a10, b10) {
          let c10 = new ad.ResponseCookies(new Headers());
          for (let b11 of a10.getAll()) c10.set(b11);
          let d10 = [], e10 = /* @__PURE__ */ new Set(), f6 = () => {
            let a11 = ax.getStore();
            if (a11 && (a11.pathWasRevalidated = 1), d10 = c10.getAll().filter((a12) => e10.has(a12.name)), b10) {
              let a12 = [];
              for (let b11 of d10) {
                let c11 = new ad.ResponseCookies(new Headers());
                c11.set(b11), a12.push(c11.toString());
              }
              b10(a12);
            }
          }, g2 = new Proxy(c10, { get(a11, b11, c11) {
            switch (b11) {
              case aA:
                return d10;
              case "delete":
                return function(...b12) {
                  e10.add("string" == typeof b12[0] ? b12[0] : b12[0].name);
                  try {
                    return a11.delete(...b12), g2;
                  } finally {
                    f6();
                  }
                };
              case "set":
                return function(...b12) {
                  e10.add("string" == typeof b12[0] ? b12[0] : b12[0].name);
                  try {
                    return a11.set(...b12), g2;
                  } finally {
                    f6();
                  }
                };
              default:
                return ag.get(a11, b11, c11);
            }
          } });
          return g2;
        }
      }
      function aC(a10, b10) {
        if ("action" !== a10.phase) throw new ay();
      }
      var aD = ((g = aD || {}).handleRequest = "BaseServer.handleRequest", g.run = "BaseServer.run", g.pipe = "BaseServer.pipe", g.getStaticHTML = "BaseServer.getStaticHTML", g.render = "BaseServer.render", g.renderToResponseWithComponents = "BaseServer.renderToResponseWithComponents", g.renderToResponse = "BaseServer.renderToResponse", g.renderToHTML = "BaseServer.renderToHTML", g.renderError = "BaseServer.renderError", g.renderErrorToResponse = "BaseServer.renderErrorToResponse", g.renderErrorToHTML = "BaseServer.renderErrorToHTML", g.render404 = "BaseServer.render404", g), aE = ((h = aE || {}).loadDefaultErrorComponents = "LoadComponents.loadDefaultErrorComponents", h.loadComponents = "LoadComponents.loadComponents", h), aF = ((i = aF || {}).getRequestHandler = "NextServer.getRequestHandler", i.getRequestHandlerWithMetadata = "NextServer.getRequestHandlerWithMetadata", i.getServer = "NextServer.getServer", i.getServerRequestHandler = "NextServer.getServerRequestHandler", i.createServer = "createServer.createServer", i), aG = ((j = aG || {}).compression = "NextNodeServer.compression", j.getBuildId = "NextNodeServer.getBuildId", j.createComponentTree = "NextNodeServer.createComponentTree", j.clientComponentLoading = "NextNodeServer.clientComponentLoading", j.getLayoutOrPageModule = "NextNodeServer.getLayoutOrPageModule", j.generateStaticRoutes = "NextNodeServer.generateStaticRoutes", j.generateFsStaticRoutes = "NextNodeServer.generateFsStaticRoutes", j.generatePublicRoutes = "NextNodeServer.generatePublicRoutes", j.generateImageRoutes = "NextNodeServer.generateImageRoutes.route", j.sendRenderResult = "NextNodeServer.sendRenderResult", j.proxyRequest = "NextNodeServer.proxyRequest", j.runApi = "NextNodeServer.runApi", j.render = "NextNodeServer.render", j.renderHTML = "NextNodeServer.renderHTML", j.imageOptimizer = "NextNodeServer.imageOptimizer", j.getPagePath = "NextNodeServer.getPagePath", j.getRoutesManifest = "NextNodeServer.getRoutesManifest", j.findPageComponents = "NextNodeServer.findPageComponents", j.getFontManifest = "NextNodeServer.getFontManifest", j.getServerComponentManifest = "NextNodeServer.getServerComponentManifest", j.getRequestHandler = "NextNodeServer.getRequestHandler", j.renderToHTML = "NextNodeServer.renderToHTML", j.renderError = "NextNodeServer.renderError", j.renderErrorToHTML = "NextNodeServer.renderErrorToHTML", j.render404 = "NextNodeServer.render404", j.startResponse = "NextNodeServer.startResponse", j.route = "route", j.onProxyReq = "onProxyReq", j.apiResolver = "apiResolver", j.internalFetch = "internalFetch", j), aH = ((k = aH || {}).startServer = "startServer.startServer", k), aI = ((l = aI || {}).getServerSideProps = "Render.getServerSideProps", l.getStaticProps = "Render.getStaticProps", l.renderToString = "Render.renderToString", l.renderDocument = "Render.renderDocument", l.createBodyResult = "Render.createBodyResult", l), aJ = ((m = aJ || {}).renderToString = "AppRender.renderToString", m.renderToReadableStream = "AppRender.renderToReadableStream", m.getBodyResult = "AppRender.getBodyResult", m.fetch = "AppRender.fetch", m), aK = ((n = aK || {}).executeRoute = "Router.executeRoute", n), aL = ((o = aL || {}).runHandler = "Node.runHandler", o), aM = ((p = aM || {}).runHandler = "AppRouteRouteHandlers.runHandler", p), aN = ((q = aN || {}).generateMetadata = "ResolveMetadata.generateMetadata", q.generateViewport = "ResolveMetadata.generateViewport", q), aO = ((r = aO || {}).execute = "Middleware.execute", r);
      let aP = /* @__PURE__ */ new Set(["Middleware.execute", "BaseServer.handleRequest", "Render.getServerSideProps", "Render.getStaticProps", "AppRender.fetch", "AppRender.getBodyResult", "Render.renderDocument", "Node.runHandler", "AppRouteRouteHandlers.runHandler", "ResolveMetadata.generateMetadata", "ResolveMetadata.generateViewport", "NextNodeServer.createComponentTree", "NextNodeServer.findPageComponents", "NextNodeServer.getLayoutOrPageModule", "NextNodeServer.startResponse", "NextNodeServer.clientComponentLoading"]), aQ = /* @__PURE__ */ new Set(["NextNodeServer.findPageComponents", "NextNodeServer.createComponentTree", "NextNodeServer.clientComponentLoading"]);
      function aR(a10) {
        return null !== a10 && "object" == typeof a10 && "then" in a10 && "function" == typeof a10.then;
      }
      let aS = process.env.NEXT_OTEL_PERFORMANCE_PREFIX, { context: aT, propagation: aU, trace: aV, SpanStatusCode: aW, SpanKind: aX, ROOT_CONTEXT: aY } = d = c(446);
      class aZ extends Error {
        constructor(a10, b10) {
          super(), this.bubble = a10, this.result = b10;
        }
      }
      let a$ = (a10, b10) => {
        "object" == typeof b10 && null !== b10 && b10 instanceof aZ && b10.bubble ? a10.setAttribute("next.bubble", true) : (b10 && (a10.recordException(b10), a10.setAttribute("error.type", b10.name)), a10.setStatus({ code: aW.ERROR, message: null == b10 ? void 0 : b10.message })), a10.end();
      }, a_ = /* @__PURE__ */ new Map(), a0 = d.createContextKey("next.rootSpanId"), a1 = 0, a2 = { set(a10, b10, c10) {
        a10.push({ key: b10, value: c10 });
      } };
      class a3 {
        getTracerInstance() {
          return aV.getTracer("next.js", "0.0.1");
        }
        getContext() {
          return aT;
        }
        getTracePropagationData() {
          let a10 = aT.active(), b10 = [];
          return aU.inject(a10, b10, a2), b10;
        }
        getActiveScopeSpan() {
          return aV.getSpan(null == aT ? void 0 : aT.active());
        }
        withPropagatedContext(a10, b10, c10, d10 = false) {
          let e10 = aT.active();
          if (d10) {
            let d11 = aU.extract(aY, a10, c10);
            if (aV.getSpanContext(d11)) return aT.with(d11, b10);
            let f7 = aU.extract(e10, a10, c10);
            return aT.with(f7, b10);
          }
          if (aV.getSpanContext(e10)) return b10();
          let f6 = aU.extract(e10, a10, c10);
          return aT.with(f6, b10);
        }
        trace(...a10) {
          let [b10, c10, d10] = a10, { fn: e10, options: f6 } = "function" == typeof c10 ? { fn: c10, options: {} } : { fn: d10, options: { ...c10 } }, g2 = f6.spanName ?? b10;
          if (!aP.has(b10) && "1" !== process.env.NEXT_OTEL_VERBOSE || f6.hideSpan) return e10();
          let h2 = this.getSpanContext((null == f6 ? void 0 : f6.parentSpan) ?? this.getActiveScopeSpan());
          h2 || (h2 = (null == aT ? void 0 : aT.active()) ?? aY);
          let i2 = h2.getValue(a0), j2 = "number" != typeof i2 || !a_.has(i2), k2 = a1++;
          return f6.attributes = { "next.span_name": g2, "next.span_type": b10, ...f6.attributes }, aT.with(h2.setValue(a0, k2), () => this.getTracerInstance().startActiveSpan(g2, f6, (a11) => {
            let c11;
            aS && b10 && aQ.has(b10) && (c11 = "performance" in globalThis && "measure" in performance ? globalThis.performance.now() : void 0);
            let d11 = false, g3 = () => {
              !d11 && (d11 = true, a_.delete(k2), c11 && performance.measure(`${aS}:next-${(b10.split(".").pop() || "").replace(/[A-Z]/g, (a12) => "-" + a12.toLowerCase())}`, { start: c11, end: performance.now() }));
            };
            if (j2 && a_.set(k2, new Map(Object.entries(f6.attributes ?? {}))), e10.length > 1) try {
              return e10(a11, (b11) => a$(a11, b11));
            } catch (b11) {
              throw a$(a11, b11), b11;
            } finally {
              g3();
            }
            try {
              let b11 = e10(a11);
              if (aR(b11)) return b11.then((b12) => (a11.end(), b12)).catch((b12) => {
                throw a$(a11, b12), b12;
              }).finally(g3);
              return a11.end(), g3(), b11;
            } catch (b11) {
              throw a$(a11, b11), g3(), b11;
            }
          }));
        }
        wrap(...a10) {
          let b10 = this, [c10, d10, e10] = 3 === a10.length ? a10 : [a10[0], {}, a10[1]];
          return aP.has(c10) || "1" === process.env.NEXT_OTEL_VERBOSE ? function() {
            let a11 = d10;
            "function" == typeof a11 && "function" == typeof e10 && (a11 = a11.apply(this, arguments));
            let f6 = arguments.length - 1, g2 = arguments[f6];
            if ("function" != typeof g2) return b10.trace(c10, a11, () => e10.apply(this, arguments));
            {
              let d11 = b10.getContext().bind(aT.active(), g2);
              return b10.trace(c10, a11, (a12, b11) => (arguments[f6] = function(a13) {
                return null == b11 || b11(a13), d11.apply(this, arguments);
              }, e10.apply(this, arguments)));
            }
          } : e10;
        }
        startSpan(...a10) {
          let [b10, c10] = a10, d10 = this.getSpanContext((null == c10 ? void 0 : c10.parentSpan) ?? this.getActiveScopeSpan());
          return this.getTracerInstance().startSpan(b10, c10, d10);
        }
        getSpanContext(a10) {
          return a10 ? aV.setSpan(aT.active(), a10) : void 0;
        }
        getRootSpanAttributes() {
          let a10 = aT.active().getValue(a0);
          return a_.get(a10);
        }
        setRootSpanAttribute(a10, b10) {
          let c10 = aT.active().getValue(a0), d10 = a_.get(c10);
          d10 && !d10.has(a10) && d10.set(a10, b10);
        }
        withSpan(a10, b10) {
          let c10 = aV.setSpan(aT.active(), a10);
          return aT.with(c10, b10);
        }
      }
      let a4 = (f = new a3(), () => f), a5 = "__prerender_bypass";
      Symbol("__next_preview_data"), Symbol(a5);
      class a6 {
        constructor(a10, b10, c10, d10) {
          var e10;
          const f6 = a10 && function(a11, b11) {
            let c11 = as.from(a11.headers);
            return { isOnDemandRevalidate: c11.get(G) === b11.previewModeId, revalidateOnlyGenerated: c11.has("x-prerender-revalidate-if-generated") };
          }(b10, a10).isOnDemandRevalidate, g2 = null == (e10 = c10.get(a5)) ? void 0 : e10.value;
          this._isEnabled = !!(!f6 && g2 && a10 && g2 === a10.previewModeId), this._previewModeId = null == a10 ? void 0 : a10.previewModeId, this._mutableCookies = d10;
        }
        get isEnabled() {
          return this._isEnabled;
        }
        enable() {
          if (!this._previewModeId) throw Object.defineProperty(Error("Invariant: previewProps missing previewModeId this should never happen"), "__NEXT_ERROR_CODE", { value: "E93", enumerable: false, configurable: true });
          this._mutableCookies.set({ name: a5, value: this._previewModeId, httpOnly: true, sameSite: "none", secure: true, path: "/" }), this._isEnabled = true;
        }
        disable() {
          this._mutableCookies.set({ name: a5, value: "", httpOnly: true, sameSite: "none", secure: true, path: "/", expires: /* @__PURE__ */ new Date(0) }), this._isEnabled = false;
        }
      }
      function a7(a10, b10) {
        if ("x-middleware-set-cookie" in a10.headers && "string" == typeof a10.headers["x-middleware-set-cookie"]) {
          let c10 = a10.headers["x-middleware-set-cookie"], d10 = new Headers();
          for (let a11 of M(c10)) d10.append("set-cookie", a11);
          for (let a11 of new ad.ResponseCookies(d10).getAll()) b10.set(a11);
        }
      }
      let a8 = aw();
      function a9(a10) {
        switch (a10.type) {
          case "prerender":
          case "prerender-runtime":
          case "prerender-ppr":
          case "prerender-client":
          case "validation-client":
            return a10.prerenderResumeDataCache;
          case "request":
            if (a10.prerenderResumeDataCache) return a10.prerenderResumeDataCache;
          case "prerender-legacy":
          case "cache":
          case "private-cache":
          case "unstable-cache":
          case "generate-static-params":
            return null;
          default:
            return a10;
        }
      }
      var ba = c(232), bb = c.n(ba);
      class bc extends Error {
        constructor(a10, b10) {
          super(`Invariant: ${a10.endsWith(".") ? a10 : a10 + "."} This is a bug in Next.js.`, b10), this.name = "InvariantError";
        }
      }
      class bd {
        constructor(a10, b10, c10) {
          this.prev = null, this.next = null, this.key = a10, this.data = b10, this.size = c10;
        }
      }
      class be {
        constructor() {
          this.prev = null, this.next = null;
        }
      }
      class bf {
        constructor(a10, b10, c10) {
          this.cache = /* @__PURE__ */ new Map(), this.totalSize = 0, this.maxSize = a10, this.calculateSize = b10, this.onEvict = c10, this.head = new be(), this.tail = new be(), this.head.next = this.tail, this.tail.prev = this.head;
        }
        addToHead(a10) {
          a10.prev = this.head, a10.next = this.head.next, this.head.next.prev = a10, this.head.next = a10;
        }
        removeNode(a10) {
          a10.prev.next = a10.next, a10.next.prev = a10.prev;
        }
        moveToHead(a10) {
          this.removeNode(a10), this.addToHead(a10);
        }
        removeTail() {
          let a10 = this.tail.prev;
          return this.removeNode(a10), a10;
        }
        set(a10, b10) {
          let c10 = (null == this.calculateSize ? void 0 : this.calculateSize.call(this, b10)) ?? 1;
          if (c10 <= 0) throw Object.defineProperty(Error(`LRUCache: calculateSize returned ${c10}, but size must be > 0. Items with size 0 would never be evicted, causing unbounded cache growth.`), "__NEXT_ERROR_CODE", { value: "E1045", enumerable: false, configurable: true });
          if (c10 > this.maxSize) return console.warn("Single item size exceeds maxSize"), false;
          let d10 = this.cache.get(a10);
          if (d10) d10.data = b10, this.totalSize = this.totalSize - d10.size + c10, d10.size = c10, this.moveToHead(d10);
          else {
            let d11 = new bd(a10, b10, c10);
            this.cache.set(a10, d11), this.addToHead(d11), this.totalSize += c10;
          }
          for (; this.totalSize > this.maxSize && this.cache.size > 0; ) {
            let a11 = this.removeTail();
            this.cache.delete(a11.key), this.totalSize -= a11.size, null == this.onEvict || this.onEvict.call(this, a11.key, a11.data);
          }
          return true;
        }
        has(a10) {
          return this.cache.has(a10);
        }
        get(a10) {
          let b10 = this.cache.get(a10);
          if (b10) return this.moveToHead(b10), b10.data;
        }
        *[Symbol.iterator]() {
          let a10 = this.head.next;
          for (; a10 && a10 !== this.tail; ) {
            let b10 = a10;
            yield [b10.key, b10.data], a10 = a10.next;
          }
        }
        remove(a10) {
          let b10 = this.cache.get(a10);
          b10 && (this.removeNode(b10), this.cache.delete(a10), this.totalSize -= b10.size);
        }
        get size() {
          return this.cache.size;
        }
        get currentSize() {
          return this.totalSize;
        }
      }
      let bg = /* @__PURE__ */ new Map(), bh = (a10, b10) => {
        for (let c10 of a10) {
          let a11 = bg.get(c10), d10 = null == a11 ? void 0 : a11.expired;
          if ("number" == typeof d10 && d10 <= Date.now() && d10 > b10) return true;
        }
        return false;
      }, bi = (a10, b10) => {
        for (let c10 of a10) {
          let a11 = bg.get(c10), d10 = (null == a11 ? void 0 : a11.stale) ?? 0;
          if ("number" == typeof d10 && d10 > b10) return true;
        }
        return false;
      };
      c(356).Buffer, process.env.NEXT_PRIVATE_DEBUG_CACHE, Symbol.for("@next/cache-handlers");
      let bj = Symbol.for("@next/cache-handlers-map"), bk = Symbol.for("@next/cache-handlers-set"), bl = globalThis;
      function bm() {
        if (bl[bj]) return bl[bj].entries();
      }
      async function bn(a10, b10) {
        if (!a10) return b10();
        let c10 = bo(a10);
        try {
          return await b10();
        } finally {
          var d10, e10, f6, g2;
          let b11, h2, i2, j2, k2 = (d10 = c10, e10 = bo(a10), b11 = new Set(d10.pendingRevalidatedTags.map((a11) => {
            let b12 = "object" == typeof a11.profile ? JSON.stringify(a11.profile) : a11.profile || "";
            return `${a11.tag}:${b12}`;
          })), h2 = new Set(d10.pendingRevalidateWrites), { pendingRevalidatedTags: e10.pendingRevalidatedTags.filter((a11) => {
            let c11 = "object" == typeof a11.profile ? JSON.stringify(a11.profile) : a11.profile || "";
            return !b11.has(`${a11.tag}:${c11}`);
          }), pendingRevalidates: Object.fromEntries(Object.entries(e10.pendingRevalidates).filter(([a11]) => !(a11 in d10.pendingRevalidates))), pendingRevalidateWrites: e10.pendingRevalidateWrites.filter((a11) => !h2.has(a11)) });
          await (f6 = a10, i2 = [], (j2 = (null == (g2 = k2) ? void 0 : g2.pendingRevalidatedTags) ?? f6.pendingRevalidatedTags ?? []).length > 0 && i2.push(bp(j2, f6.incrementalCache, f6)), i2.push(...Object.values((null == g2 ? void 0 : g2.pendingRevalidates) ?? f6.pendingRevalidates ?? {})), i2.push(...(null == g2 ? void 0 : g2.pendingRevalidateWrites) ?? f6.pendingRevalidateWrites ?? []), 0 !== i2.length && Promise.all(i2).then(() => void 0));
        }
      }
      function bo(a10) {
        return { pendingRevalidatedTags: a10.pendingRevalidatedTags ? [...a10.pendingRevalidatedTags] : [], pendingRevalidates: { ...a10.pendingRevalidates }, pendingRevalidateWrites: a10.pendingRevalidateWrites ? [...a10.pendingRevalidateWrites] : [] };
      }
      async function bp(a10, b10, c10) {
        if (0 === a10.length) return;
        let d10 = function() {
          if (bl[bk]) return bl[bk].values();
        }(), e10 = [], f6 = /* @__PURE__ */ new Map();
        for (let b11 of a10) {
          let a11, c11 = b11.profile;
          for (let [b12] of f6) if ("string" == typeof b12 && "string" == typeof c11 && b12 === c11 || "object" == typeof b12 && "object" == typeof c11 && JSON.stringify(b12) === JSON.stringify(c11) || b12 === c11) {
            a11 = b12;
            break;
          }
          let d11 = a11 || c11;
          f6.has(d11) || f6.set(d11, []), f6.get(d11).push(b11.tag);
        }
        for (let [a11, h2] of f6) {
          let f7;
          if (a11) {
            let b11;
            if ("object" == typeof a11) b11 = a11;
            else if ("string" == typeof a11) {
              var g2;
              if (!(b11 = null == c10 || null == (g2 = c10.cacheLifeProfiles) ? void 0 : g2[a11])) throw Object.defineProperty(Error(`Invalid profile provided "${a11}" must be configured under cacheLife in next.config or be "max"`), "__NEXT_ERROR_CODE", { value: "E873", enumerable: false, configurable: true });
            }
            b11 && (f7 = { expire: b11.expire });
          }
          for (let b11 of d10 || []) a11 ? e10.push(null == b11.updateTags ? void 0 : b11.updateTags.call(b11, h2, f7)) : e10.push(null == b11.updateTags ? void 0 : b11.updateTags.call(b11, h2));
          b10 && e10.push(b10.revalidateTag(h2, f7));
        }
        await Promise.all(e10);
      }
      let bq = Object.defineProperty(Error("Invariant: AsyncLocalStorage accessed in runtime where it is not available"), "__NEXT_ERROR_CODE", { value: "E504", enumerable: false, configurable: true });
      class br {
        disable() {
          throw bq;
        }
        getStore() {
        }
        run() {
          throw bq;
        }
        exit() {
          throw bq;
        }
        enterWith() {
          throw bq;
        }
        static bind(a10) {
          return a10;
        }
      }
      let bs = "u" > typeof globalThis && globalThis.AsyncLocalStorage, bt = bs ? new bs() : new br();
      class bu {
        constructor({ waitUntil: a10, onClose: b10, onTaskError: c10 }) {
          this.workUnitStores = /* @__PURE__ */ new Set(), this.waitUntil = a10, this.onClose = b10, this.onTaskError = c10, this.callbackQueue = new (bb())(), this.callbackQueue.pause();
        }
        after(a10) {
          if (aR(a10)) this.waitUntil || bv(), this.waitUntil(a10.catch((a11) => this.reportTaskError("promise", a11)));
          else if ("function" == typeof a10) this.addCallback(a10);
          else throw Object.defineProperty(Error("`after()`: Argument must be a promise or a function"), "__NEXT_ERROR_CODE", { value: "E50", enumerable: false, configurable: true });
        }
        addCallback(a10) {
          var b10;
          this.waitUntil || bv();
          let c10 = a8.getStore();
          c10 && this.workUnitStores.add(c10);
          let d10 = bt.getStore(), e10 = d10 ? d10.rootTaskSpawnPhase : null == c10 ? void 0 : c10.phase;
          this.runCallbacksOnClosePromise || (this.runCallbacksOnClosePromise = this.runCallbacksOnClose(), this.waitUntil(this.runCallbacksOnClosePromise));
          let f6 = (b10 = async () => {
            try {
              await bt.run({ rootTaskSpawnPhase: e10 }, () => a10());
            } catch (a11) {
              this.reportTaskError("function", a11);
            }
          }, bs ? bs.bind(b10) : br.bind(b10));
          this.callbackQueue.add(f6);
        }
        async runCallbacksOnClose() {
          return await new Promise((a10) => this.onClose(a10)), this.runCallbacks();
        }
        async runCallbacks() {
          if (0 === this.callbackQueue.size) return;
          for (let a11 of this.workUnitStores) a11.phase = "after";
          let a10 = ax.getStore();
          if (!a10) throw Object.defineProperty(new bc("Missing workStore in AfterContext.runCallbacks"), "__NEXT_ERROR_CODE", { value: "E547", enumerable: false, configurable: true });
          return bn(a10, () => (this.callbackQueue.start(), this.callbackQueue.onIdle()));
        }
        reportTaskError(a10, b10) {
          if (console.error("promise" === a10 ? "A promise passed to `after()` rejected:" : "An error occurred in a function passed to `after()`:", b10), this.onTaskError) try {
            null == this.onTaskError || this.onTaskError.call(this, b10);
          } catch (a11) {
            console.error(Object.defineProperty(new bc("`onTaskError` threw while handling an error thrown from an `after` task", { cause: a11 }), "__NEXT_ERROR_CODE", { value: "E569", enumerable: false, configurable: true }));
          }
        }
      }
      function bv() {
        throw Object.defineProperty(Error("`after()` will not work correctly, because `waitUntil` is not available in the current environment."), "__NEXT_ERROR_CODE", { value: "E91", enumerable: false, configurable: true });
      }
      function bw(a10) {
        let b10, c10 = { then: (d10, e10) => (b10 || (b10 = Promise.resolve(a10())), b10.then((a11) => {
          c10.value = a11;
        }).catch(() => {
        }), b10.then(d10, e10)) };
        return c10;
      }
      class bx {
        onClose(a10) {
          if (this.isClosed) throw Object.defineProperty(Error("Cannot subscribe to a closed CloseController"), "__NEXT_ERROR_CODE", { value: "E365", enumerable: false, configurable: true });
          this.target.addEventListener("close", a10), this.listeners++;
        }
        dispatchClose() {
          if (this.isClosed) throw Object.defineProperty(Error("Cannot close a CloseController multiple times"), "__NEXT_ERROR_CODE", { value: "E229", enumerable: false, configurable: true });
          this.listeners > 0 && this.target.dispatchEvent(new Event("close")), this.isClosed = true;
        }
        constructor() {
          this.target = new EventTarget(), this.listeners = 0, this.isClosed = false;
        }
      }
      function by() {
        return { previewModeId: process.env.__NEXT_PREVIEW_MODE_ID || "", previewModeSigningKey: process.env.__NEXT_PREVIEW_MODE_SIGNING_KEY || "", previewModeEncryptionKey: process.env.__NEXT_PREVIEW_MODE_ENCRYPTION_KEY || "" };
      }
      let bz = Symbol.for("@next/request-context");
      async function bA(a10, b10, c10) {
        let d10 = /* @__PURE__ */ new Set();
        for (let b11 of ((a11) => {
          let b12 = ["/layout"];
          if (a11.startsWith("/")) {
            let c11 = a11.split("/");
            for (let a12 = 1; a12 < c11.length + 1; a12++) {
              let d11 = c11.slice(0, a12).join("/");
              d11 && (d11.endsWith("/page") || d11.endsWith("/route") || (d11 = `${d11}${!d11.endsWith("/") ? "/" : ""}layout`), b12.push(d11));
            }
          }
          return b12;
        })(a10)) b11 = `${K}${b11}`, d10.add(b11);
        if (b10 && (!c10 || 0 === c10.size)) {
          let a11 = `${K}${b10}`;
          d10.add(a11);
        }
        d10.has(`${K}/`) && d10.add(`${K}/index`), d10.has(`${K}/index`) && d10.add(`${K}/`);
        let e10 = Array.from(d10);
        return { tags: e10, expirationsByCacheKind: function(a11) {
          let b11 = /* @__PURE__ */ new Map(), c11 = bm();
          if (c11) for (let [d11, e11] of c11) "getExpiration" in e11 && b11.set(d11, bw(async () => e11.getExpiration(a11)));
          return b11;
        }(e10) };
      }
      let bB = Symbol.for("NextInternalRequestMeta");
      class bC extends af {
        constructor(a10) {
          super(a10.input, a10.init), this.sourcePage = a10.page;
        }
        get request() {
          throw Object.defineProperty(new D({ page: this.sourcePage }), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
        }
        respondWith() {
          throw Object.defineProperty(new D({ page: this.sourcePage }), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
        }
        waitUntil() {
          throw Object.defineProperty(new D({ page: this.sourcePage }), "__NEXT_ERROR_CODE", { value: "E394", enumerable: false, configurable: true });
        }
      }
      let bD = { keys: (a10) => Array.from(a10.keys()), get: (a10, b10) => a10.get(b10) ?? void 0 }, bE = (a10, b10) => a4().withPropagatedContext(a10.headers, b10, bD), bF = false;
      async function bG(a10) {
        var b10, d10, e10, f6, g2;
        let h2, i2, j2, k2, l2;
        !function() {
          if (!bF && (bF = true, "true" === process.env.NEXT_PRIVATE_TEST_PROXY)) {
            let { interceptTestApis: a11, wrapRequestHandler: b11 } = c(987);
            a11(), bE = b11(bE);
          }
        }(), await B();
        let m2 = void 0 !== globalThis.__BUILD_MANIFEST;
        a10.request.url = a10.request.url.replace(/\.rsc($|\?)/, "$1");
        let n2 = a10.bypassNextUrl ? new URL(a10.request.url) : new ac(a10.request.url, { headers: a10.request.headers, nextConfig: a10.request.nextConfig });
        for (let a11 of [...n2.searchParams.keys()]) {
          let b11 = n2.searchParams.getAll(a11), c10 = function(a12) {
            for (let b12 of ["nxtP", "nxtI"]) if (a12 !== b12 && a12.startsWith(b12)) return a12.substring(b12.length);
            return null;
          }(a11);
          if (c10) {
            for (let a12 of (n2.searchParams.delete(c10), b11)) n2.searchParams.append(c10, a12);
            n2.searchParams.delete(a11);
          }
        }
        let o2 = process.env.__NEXT_BUILD_ID || "";
        "buildId" in n2 && (o2 = n2.buildId || "", n2.buildId = "");
        let p2 = function(a11) {
          let b11 = new Headers();
          for (let [c10, d11] of Object.entries(a11)) for (let a12 of Array.isArray(d11) ? d11 : [d11]) void 0 !== a12 && ("number" == typeof a12 && (a12 = a12.toString()), b11.append(c10, a12));
          return b11;
        }(a10.request.headers), q2 = p2.has("x-nextjs-data"), r2 = "1" === p2.get("rsc");
        q2 && "/index" === n2.pathname && (n2.pathname = "/");
        let s2 = /* @__PURE__ */ new Map();
        if (!m2) for (let a11 of an) {
          let b11 = p2.get(a11);
          null !== b11 && (s2.set(a11, b11), p2.delete(a11));
        }
        let t2 = n2.searchParams.get(ao), u2 = new bC({ page: a10.page, input: ((k2 = (j2 = "string" == typeof n2) ? new URL(n2) : n2).searchParams.delete(ao), j2 ? k2.toString() : k2).toString(), init: { body: a10.request.body, headers: p2, method: a10.request.method, nextConfig: a10.request.nextConfig, signal: a10.request.signal } });
        a10.request.requestMeta && (g2 = a10.request.requestMeta, u2[bB] = g2), q2 && Object.defineProperty(u2, "__isData", { enumerable: false, value: true }), !globalThis.__incrementalCacheShared && a10.IncrementalCache && (globalThis.__incrementalCache = new a10.IncrementalCache({ CurCacheHandler: a10.incrementalCacheHandler, minimalMode: true, fetchCacheKeyPrefix: "", dev: false, requestHeaders: a10.request.headers, getPrerenderManifest: () => ({ version: -1, routes: {}, dynamicRoutes: {}, notFoundRoutes: [], preview: by() }) }));
        let v2 = a10.request.waitUntil ?? (null == (b10 = null == (l2 = globalThis[bz]) ? void 0 : l2.get()) ? void 0 : b10.waitUntil), w2 = new T({ request: u2, page: a10.page, context: v2 ? { waitUntil: v2 } : void 0 });
        if ((h2 = await bE(u2, () => {
          if ("/middleware" === a10.page || "/src/middleware" === a10.page || "/proxy" === a10.page || "/src/proxy" === a10.page) {
            let b11 = w2.waitUntil.bind(w2), c10 = new bx();
            return a4().trace(aO.execute, { spanName: `middleware ${u2.method}`, attributes: { "http.target": u2.nextUrl.pathname, "http.method": u2.method } }, async () => {
              try {
                var d11, e11, f7, g3, h3, j3;
                let k3 = by(), l3 = await bA("/", u2.nextUrl.pathname, null), m3 = (h3 = u2.nextUrl, j3 = (a11) => {
                  i2 = a11;
                }, function(a11, b12, c11, d12, e12, f8, g4, h4, i3, j4) {
                  function k4(a12) {
                    c11 && c11.setHeader("Set-Cookie", a12);
                  }
                  let l4 = {};
                  return { type: "request", phase: a11, implicitTags: f8, url: { pathname: d12.pathname, search: d12.search ?? "" }, rootParams: e12, get headers() {
                    return l4.headers || (l4.headers = function(a12) {
                      let b13 = as.from(a12);
                      for (let a13 of an) b13.delete(a13);
                      return as.seal(b13);
                    }(b12.headers)), l4.headers;
                  }, get cookies() {
                    if (!l4.cookies) {
                      let a12 = new ad.RequestCookies(as.from(b12.headers));
                      a7(b12, a12), l4.cookies = az.seal(a12);
                    }
                    return l4.cookies;
                  }, set cookies(value) {
                    l4.cookies = value;
                  }, get mutableCookies() {
                    if (!l4.mutableCookies) {
                      var m4, n4;
                      let a12, d13 = (m4 = b12.headers, n4 = g4 || (c11 ? k4 : void 0), a12 = new ad.RequestCookies(as.from(m4)), aB.wrap(a12, n4));
                      a7(b12, d13), l4.mutableCookies = d13;
                    }
                    return l4.mutableCookies;
                  }, get userspaceMutableCookies() {
                    if (!l4.userspaceMutableCookies) {
                      var o3;
                      let a12;
                      o3 = this, l4.userspaceMutableCookies = a12 = new Proxy(o3.mutableCookies, { get(b13, c12, d13) {
                        switch (c12) {
                          case "delete":
                            return function(...c13) {
                              return aC(o3, "cookies().delete"), b13.delete(...c13), a12;
                            };
                          case "set":
                            return function(...c13) {
                              return aC(o3, "cookies().set"), b13.set(...c13), a12;
                            };
                          default:
                            return ag.get(b13, c12, d13);
                        }
                      } });
                    }
                    return l4.userspaceMutableCookies;
                  }, get draftMode() {
                    return l4.draftMode || (l4.draftMode = new a6(h4, b12, this.cookies, this.mutableCookies)), l4.draftMode;
                  }, renderResumeDataCache: null, isHmrRefresh: i3, serverComponentsHmrCache: j4 || globalThis.__serverComponentsHmrCache, fallbackParams: null };
                }("action", u2, void 0, h3, {}, l3, j3, k3, false, void 0)), n3 = function({ page: a11, renderOpts: b12, isPrefetchRequest: c11, buildId: d12, previouslyRevalidatedTags: e12, nonce: f8 }) {
                  let g4 = !b12.shouldWaitOnAllReady && !b12.supportsDynamicResponse && !b12.isDraftMode && !b12.isPossibleServerAction, h4 = g4 && (!!process.env.NEXT_DEBUG_BUILD || "1" === process.env.NEXT_SSG_FETCH_METRICS), i3 = { isStaticGeneration: g4, page: a11, route: aq(a11), incrementalCache: b12.incrementalCache || globalThis.__incrementalCache, cacheLifeProfiles: b12.cacheLifeProfiles, isBuildTimePrerendering: b12.isBuildTimePrerendering, fetchCache: b12.fetchCache, isOnDemandRevalidate: b12.isOnDemandRevalidate, isDraftMode: b12.isDraftMode, isPrefetchRequest: c11, buildId: d12, reactLoadableManifest: (null == b12 ? void 0 : b12.reactLoadableManifest) || {}, assetPrefix: (null == b12 ? void 0 : b12.assetPrefix) || "", nonce: f8, afterContext: function(a12) {
                    let { waitUntil: b13, onClose: c12, onAfterTaskError: d13 } = a12;
                    return new bu({ waitUntil: b13, onClose: c12, onTaskError: d13 });
                  }(b12), cacheComponentsEnabled: b12.cacheComponents, previouslyRevalidatedTags: e12, refreshTagsByCacheKind: function() {
                    let a12 = /* @__PURE__ */ new Map(), b13 = bm();
                    if (b13) for (let [c12, d13] of b13) "refreshTags" in d13 && a12.set(c12, bw(async () => d13.refreshTags()));
                    return a12;
                  }(), runInCleanSnapshot: bs ? bs.snapshot() : function(a12, ...b13) {
                    return a12(...b13);
                  }, shouldTrackFetchMetrics: h4, reactServerErrorsByDigest: /* @__PURE__ */ new Map() };
                  return b12.store = i3, i3;
                }({ page: "/", renderOpts: { cacheLifeProfiles: null == (e11 = a10.request.nextConfig) || null == (d11 = e11.experimental) ? void 0 : d11.cacheLife, cacheComponents: false, experimental: { isRoutePPREnabled: false, authInterrupts: !!(null == (g3 = a10.request.nextConfig) || null == (f7 = g3.experimental) ? void 0 : f7.authInterrupts) }, supportsDynamicResponse: true, waitUntil: b11, onClose: c10.onClose.bind(c10), onAfterTaskError: void 0 }, isPrefetchRequest: "1" === u2.headers.get(am), buildId: o2 ?? "", previouslyRevalidatedTags: [] });
                return await ax.run(n3, () => a8.run(m3, a10.handler, u2, w2));
              } finally {
                setTimeout(() => {
                  c10.dispatchClose();
                }, 0);
              }
            });
          }
          return a10.handler(u2, w2);
        })) && !(h2 instanceof Response)) throw Object.defineProperty(TypeError("Expected an instance of Response to be returned"), "__NEXT_ERROR_CODE", { value: "E567", enumerable: false, configurable: true });
        h2 && i2 && h2.headers.set("set-cookie", i2);
        let x2 = null == h2 ? void 0 : h2.headers.get("x-middleware-rewrite");
        if (h2 && x2 && (r2 || !m2)) {
          let b11 = new ac(x2, { forceLocale: true, headers: a10.request.headers, nextConfig: a10.request.nextConfig });
          m2 || b11.host !== u2.nextUrl.host || (b11.buildId = o2 || b11.buildId, h2.headers.set("x-middleware-rewrite", String(b11)));
          let { url: c10, isRelative: g3 } = al(b11.toString(), n2.toString());
          !m2 && q2 && h2.headers.set("x-nextjs-rewrite", c10);
          let i3 = !g3 && (null == (f6 = a10.request.nextConfig) || null == (e10 = f6.experimental) || null == (d10 = e10.clientParamParsingOrigins) ? void 0 : d10.some((a11) => new RegExp(a11).test(b11.origin)));
          r2 && (g3 || i3) && (n2.pathname !== b11.pathname && h2.headers.set("x-nextjs-rewritten-path", b11.pathname), n2.search !== b11.search && h2.headers.set("x-nextjs-rewritten-query", b11.search.slice(1)));
        }
        if (h2 && x2 && r2 && t2) {
          let a11 = new URL(x2);
          a11.searchParams.has(ao) || (a11.searchParams.set(ao, t2), h2.headers.set("x-middleware-rewrite", a11.toString()));
        }
        let y2 = null == h2 ? void 0 : h2.headers.get("Location");
        if (h2 && y2 && !m2) {
          let b11 = new ac(y2, { forceLocale: false, headers: a10.request.headers, nextConfig: a10.request.nextConfig });
          h2 = new Response(h2.body, h2), b11.host === n2.host && (b11.buildId = o2 || b11.buildId, h2.headers.set("Location", al(b11, n2).url)), q2 && (h2.headers.delete("Location"), h2.headers.set("x-nextjs-redirect", al(b11.toString(), n2.toString()).url));
        }
        let z2 = h2 || ak.next(), A2 = z2.headers.get("x-middleware-override-headers"), C2 = [];
        if (A2) {
          for (let [a11, b11] of s2) z2.headers.set(`x-middleware-request-${a11}`, b11), C2.push(a11);
          C2.length > 0 && z2.headers.set("x-middleware-override-headers", A2 + "," + C2.join(","));
        }
        return { response: z2, waitUntil: ("internal" === w2[R].kind ? Promise.all(w2[R].promises).then(() => {
        }) : void 0) ?? Promise.resolve(), fetchMetrics: u2.fetchMetrics };
      }
      let { env: bH, stdout: bI } = (null == (u = globalThis) ? void 0 : u.process) ?? {}, bJ = bH && !bH.NO_COLOR && (bH.FORCE_COLOR || (null == bI ? void 0 : bI.isTTY) && !bH.CI && "dumb" !== bH.TERM), bK = (a10, b10, c10, d10) => {
        let e10 = a10.substring(0, d10) + c10, f6 = a10.substring(d10 + b10.length), g2 = f6.indexOf(b10);
        return ~g2 ? e10 + bK(f6, b10, c10, g2) : e10 + f6;
      }, bL = (a10, b10, c10 = a10) => bJ ? (d10) => {
        let e10 = "" + d10, f6 = e10.indexOf(b10, a10.length);
        return ~f6 ? a10 + bK(e10, b10, c10, f6) + b10 : a10 + e10 + b10;
      } : String, bM = bL("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m");
      bL("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"), bL("\x1B[3m", "\x1B[23m"), bL("\x1B[4m", "\x1B[24m"), bL("\x1B[7m", "\x1B[27m"), bL("\x1B[8m", "\x1B[28m"), bL("\x1B[9m", "\x1B[29m"), bL("\x1B[30m", "\x1B[39m");
      let bN = bL("\x1B[31m", "\x1B[39m"), bO = bL("\x1B[32m", "\x1B[39m"), bP = bL("\x1B[33m", "\x1B[39m");
      bL("\x1B[34m", "\x1B[39m");
      let bQ = bL("\x1B[35m", "\x1B[39m");
      bL("\x1B[38;2;173;127;168m", "\x1B[39m"), bL("\x1B[36m", "\x1B[39m");
      let bR = bL("\x1B[37m", "\x1B[39m");
      bL("\x1B[90m", "\x1B[39m"), bL("\x1B[40m", "\x1B[49m"), bL("\x1B[41m", "\x1B[49m"), bL("\x1B[42m", "\x1B[49m"), bL("\x1B[43m", "\x1B[49m"), bL("\x1B[44m", "\x1B[49m"), bL("\x1B[45m", "\x1B[49m"), bL("\x1B[46m", "\x1B[49m"), bL("\x1B[47m", "\x1B[49m"), bR(bM("\u25CB")), bN(bM("\u2A2F")), bP(bM("\u26A0")), bR(bM(" ")), bO(bM("\u2713")), bQ(bM("\xBB")), new bf(1e4, (a10) => a10.length), new bf(1e4, (a10) => a10.length);
      var bS = ((s = {}).APP_PAGE = "APP_PAGE", s.APP_ROUTE = "APP_ROUTE", s.PAGES = "PAGES", s.FETCH = "FETCH", s.REDIRECT = "REDIRECT", s.IMAGE = "IMAGE", s), bT = ((t = {}).APP_PAGE = "APP_PAGE", t.APP_ROUTE = "APP_ROUTE", t.PAGES = "PAGES", t.FETCH = "FETCH", t.IMAGE = "IMAGE", t);
      function bU() {
      }
      new Uint8Array([60, 104, 116, 109, 108]), new Uint8Array([60, 104, 101, 97, 100]), new Uint8Array([60, 98, 111, 100, 121]), new Uint8Array([60, 47, 104, 101, 97, 100, 62]), new Uint8Array([60, 47, 98, 111, 100, 121, 62]), new Uint8Array([60, 47, 104, 116, 109, 108, 62]), new Uint8Array([60, 47, 98, 111, 100, 121, 62, 60, 47, 104, 116, 109, 108, 62]), new Uint8Array([60, 109, 101, 116, 97, 32, 110, 97, 109, 101, 61, 34, 194, 171, 110, 120, 116, 45, 105, 99, 111, 110, 194, 187, 34]), c(356).Buffer, c(356).Buffer;
      let bV = new TextEncoder();
      function bW(a10) {
        return new ReadableStream({ start(b10) {
          b10.enqueue(bV.encode(a10)), b10.close();
        } });
      }
      function bX(a10) {
        return new ReadableStream({ start(b10) {
          b10.enqueue(a10), b10.close();
        } });
      }
      async function bY(a10, b10) {
        let c10 = new TextDecoder("utf-8", { fatal: true }), d10 = "";
        for await (let e10 of a10) {
          if (null == b10 ? void 0 : b10.aborted) return d10;
          d10 += c10.decode(e10, { stream: true });
        }
        return d10 + c10.decode();
      }
      let bZ = "ResponseAborted";
      class b$ extends Error {
        constructor(...a10) {
          super(...a10), this.name = bZ;
        }
      }
      class b_ {
        constructor() {
          let a10, b10;
          this.promise = new Promise((c10, d10) => {
            a10 = c10, b10 = d10;
          }), this.resolve = a10, this.reject = b10;
        }
      }
      let b0 = 0, b1 = 0, b2 = 0;
      function b3(a10) {
        return (null == a10 ? void 0 : a10.name) === "AbortError" || (null == a10 ? void 0 : a10.name) === bZ;
      }
      async function b4(a10, b10, c10) {
        try {
          let d10, { errored: e10, destroyed: f6 } = b10;
          if (e10 || f6) return;
          let g2 = (d10 = new AbortController(), b10.once("close", () => {
            b10.writableFinished || d10.abort(new b$());
          }), d10), h2 = function(a11, b11) {
            let c11 = false, d11 = new b_();
            function e11() {
              d11.resolve();
            }
            a11.on("drain", e11), a11.once("close", () => {
              a11.off("drain", e11), d11.resolve();
            });
            let f7 = new b_();
            return a11.once("finish", () => {
              f7.resolve();
            }), new WritableStream({ write: async (b12) => {
              if (!c11) {
                if (c11 = true, "performance" in globalThis && process.env.NEXT_OTEL_PERFORMANCE_PREFIX) {
                  let a12 = function(a13 = {}) {
                    let b13 = 0 === b0 ? void 0 : { clientComponentLoadStart: b0, clientComponentLoadTimes: b1, clientComponentLoadCount: b2 };
                    return a13.reset && (b0 = 0, b1 = 0, b2 = 0), b13;
                  }();
                  a12 && performance.measure(`${process.env.NEXT_OTEL_PERFORMANCE_PREFIX}:next-client-component-loading`, { start: a12.clientComponentLoadStart, end: a12.clientComponentLoadStart + a12.clientComponentLoadTimes });
                }
                a11.flushHeaders(), a4().trace(aG.startResponse, { spanName: "start response" }, () => void 0);
              }
              try {
                let c12 = a11.write(b12);
                "flush" in a11 && "function" == typeof a11.flush && a11.flush(), c12 || (await d11.promise, d11 = new b_());
              } catch (b13) {
                throw a11.end(), Object.defineProperty(Error("failed to write chunk to response", { cause: b13 }), "__NEXT_ERROR_CODE", { value: "E321", enumerable: false, configurable: true });
              }
            }, abort: (b12) => {
              a11.writableFinished || a11.destroy(b12);
            }, close: async () => {
              if (b11 && await b11, !a11.writableFinished) return a11.end(), f7.promise;
            } });
          }(b10, c10);
          await a10.pipeTo(h2, { signal: g2.signal });
        } catch (a11) {
          if (b3(a11)) return;
          throw Object.defineProperty(Error("failed to pipe response", { cause: a11 }), "__NEXT_ERROR_CODE", { value: "E180", enumerable: false, configurable: true });
        }
      }
      var b5 = c(356).Buffer;
      class b6 {
        static #a = this.EMPTY = new b6(null, { metadata: {}, contentType: null });
        static fromStatic(a10, b10) {
          return new b6(a10, { metadata: {}, contentType: b10 });
        }
        constructor(a10, { contentType: b10, waitUntil: c10, metadata: d10 }) {
          this.response = a10, this.contentType = b10, this.metadata = d10, this.waitUntil = c10;
        }
        assignMetadata(a10) {
          Object.assign(this.metadata, a10);
        }
        get isNull() {
          return null === this.response;
        }
        get isDynamic() {
          return "string" != typeof this.response;
        }
        toUnchunkedString(a10 = false) {
          if (null === this.response) return "";
          if ("string" != typeof this.response) {
            if (!a10) throw Object.defineProperty(new bc("dynamic responses cannot be unchunked. This is a bug in Next.js"), "__NEXT_ERROR_CODE", { value: "E732", enumerable: false, configurable: true });
            return bY(this.readable);
          }
          return this.response;
        }
        get readable() {
          return null === this.response ? new ReadableStream({ start(a10) {
            a10.close();
          } }) : "string" == typeof this.response ? bW(this.response) : b5.isBuffer(this.response) ? bX(this.response) : Array.isArray(this.response) ? function(...a10) {
            if (0 === a10.length) return new ReadableStream({ start(a11) {
              a11.close();
            } });
            if (1 === a10.length) return a10[0];
            let { readable: b10, writable: c10 } = new TransformStream(), d10 = a10[0].pipeTo(c10, { preventClose: true }), e10 = 1;
            for (; e10 < a10.length - 1; e10++) {
              let b11 = a10[e10];
              d10 = d10.then(() => b11.pipeTo(c10, { preventClose: true }));
            }
            let f6 = a10[e10];
            return (d10 = d10.then(() => f6.pipeTo(c10))).catch(bU), b10;
          }(...this.response) : this.response;
        }
        coerce() {
          return null === this.response ? [] : "string" == typeof this.response ? [bW(this.response)] : Array.isArray(this.response) ? this.response : b5.isBuffer(this.response) ? [bX(this.response)] : [this.response];
        }
        pipeThrough(a10) {
          this.response = this.readable.pipeThrough(a10);
        }
        unshift(a10) {
          this.response = this.coerce(), this.response.unshift(a10);
        }
        push(a10) {
          this.response = this.coerce(), this.response.push(a10);
        }
        async pipeTo(a10) {
          try {
            await this.readable.pipeTo(a10, { preventClose: true }), this.waitUntil && await this.waitUntil, await a10.close();
          } catch (b10) {
            if (b3(b10)) return void await a10.abort(b10);
            throw b10;
          }
        }
        async pipeToNodeResponse(a10) {
          await b4(this.readable, a10, this.waitUntil);
        }
      }
      function b7(a10, b10) {
        if (!a10) return b10;
        let c10 = parseInt(a10, 10);
        return Number.isFinite(c10) && c10 > 0 ? c10 : b10;
      }
      b7(process.env.NEXT_PRIVATE_RESPONSE_CACHE_TTL, 1e4), b7(process.env.NEXT_PRIVATE_RESPONSE_CACHE_MAX_SIZE, 150);
      var b8 = c(654), b9 = c.n(b8);
      class ca {
        constructor(a10) {
          this.fs = a10, this.tasks = [];
        }
        findOrCreateTask(a10) {
          for (let b11 of this.tasks) if (b11[0] === a10) return b11;
          let b10 = this.fs.mkdir(a10);
          b10.catch(() => {
          });
          let c10 = [a10, b10, []];
          return this.tasks.push(c10), c10;
        }
        append(a10, b10) {
          let c10 = this.findOrCreateTask(b9().dirname(a10)), d10 = c10[1].then(() => this.fs.writeFile(a10, b10));
          d10.catch(() => {
          }), c10[2].push(d10);
        }
        wait() {
          return Promise.all(this.tasks.flatMap((a10) => a10[2]));
        }
      }
      function cb(a10) {
        return (null == a10 ? void 0 : a10.length) || 0;
      }
      class cc {
        static #a = this.debug = !!process.env.NEXT_PRIVATE_DEBUG_CACHE;
        constructor(a10) {
          this.fs = a10.fs, this.flushToDisk = a10.flushToDisk, this.serverDistDir = a10.serverDistDir, this.revalidatedTags = a10.revalidatedTags, a10.maxMemoryCacheSize ? cc.memoryCache ? cc.debug && console.log("FileSystemCache: memory store already initialized") : (cc.debug && console.log("FileSystemCache: using memory store for fetch cache"), cc.memoryCache = function(a11) {
            return e || (e = new bf(a11, function({ value: a12 }) {
              var b10, c10;
              if (!a12) return 25;
              if (a12.kind === bS.REDIRECT) return JSON.stringify(a12.props).length;
              if (a12.kind === bS.IMAGE) throw Object.defineProperty(Error("invariant image should not be incremental-cache"), "__NEXT_ERROR_CODE", { value: "E501", enumerable: false, configurable: true });
              if (a12.kind === bS.FETCH) return JSON.stringify(a12.data || "").length;
              if (a12.kind === bS.APP_ROUTE) return a12.body.length;
              return a12.kind === bS.APP_PAGE ? Math.max(1, a12.html.length + cb(a12.rscData) + ((null == (c10 = a12.postponed) ? void 0 : c10.length) || 0) + function(a13) {
                if (!a13) return 0;
                let b11 = 0;
                for (let [c11, d10] of a13) b11 += c11.length + cb(d10);
                return b11;
              }(a12.segmentData)) : a12.html.length + ((null == (b10 = JSON.stringify(a12.pageData)) ? void 0 : b10.length) || 0);
            })), e;
          }(a10.maxMemoryCacheSize)) : cc.debug && console.log("FileSystemCache: not using memory store for fetch cache");
        }
        resetRequestCache() {
        }
        async revalidateTag(a10, b10) {
          if (a10 = "string" == typeof a10 ? [a10] : a10, cc.debug && console.log("FileSystemCache: revalidateTag", a10, b10), 0 === a10.length) return;
          let c10 = Date.now();
          for (let d10 of a10) {
            let a11 = bg.get(d10) || {};
            if (b10) {
              let e10 = { ...a11 };
              e10.stale = c10, void 0 !== b10.expire && (e10.expired = c10 + 1e3 * b10.expire), bg.set(d10, e10);
            } else bg.set(d10, { ...a11, expired: c10 });
          }
        }
        async get(...a10) {
          var b10, c10, d10, e10, f6, g2;
          let [h2, i2] = a10, { kind: j2 } = i2, k2 = null == (b10 = cc.memoryCache) ? void 0 : b10.get(h2);
          if (cc.debug && (j2 === bT.FETCH ? console.log("FileSystemCache: get", h2, i2.tags, j2, !!k2) : console.log("FileSystemCache: get", h2, j2, !!k2)), (null == k2 || null == (c10 = k2.value) ? void 0 : c10.kind) === bS.APP_PAGE || (null == k2 || null == (d10 = k2.value) ? void 0 : d10.kind) === bS.APP_ROUTE || (null == k2 || null == (e10 = k2.value) ? void 0 : e10.kind) === bS.PAGES) {
            let a11 = null == (g2 = k2.value.headers) ? void 0 : g2[I];
            if ("string" == typeof a11) {
              let b11 = a11.split(",");
              if (b11.length > 0 && bh(b11, k2.lastModified)) return cc.debug && console.log("FileSystemCache: expired tags", b11), null;
            }
          } else if ((null == k2 || null == (f6 = k2.value) ? void 0 : f6.kind) === bS.FETCH) {
            let a11 = i2.kind === bT.FETCH ? [...i2.tags || [], ...i2.softTags || []] : [];
            if (a11.some((a12) => this.revalidatedTags.includes(a12))) return cc.debug && console.log("FileSystemCache: was revalidated", a11), null;
            if (bh(a11, k2.lastModified)) return cc.debug && console.log("FileSystemCache: expired tags", a11), null;
          }
          return k2 ?? null;
        }
        async set(a10, b10, c10) {
          var d10;
          if (null == (d10 = cc.memoryCache) || d10.set(a10, { value: b10, lastModified: Date.now() }), cc.debug && console.log("FileSystemCache: set", a10), !this.flushToDisk || !b10) return;
          let e10 = new ca(this.fs);
          if (b10.kind === bS.APP_ROUTE) {
            let c11 = this.getFilePath(`${a10}.body`, bT.APP_ROUTE);
            e10.append(c11, b10.body);
            let d11 = { headers: b10.headers, status: b10.status, postponed: void 0, segmentPaths: void 0, prefetchHints: void 0 };
            e10.append(c11.replace(/\.body$/, H), JSON.stringify(d11, null, 2));
          } else if (b10.kind === bS.PAGES || b10.kind === bS.APP_PAGE) {
            let d11 = b10.kind === bS.APP_PAGE, f6 = this.getFilePath(`${a10}.html`, d11 ? bT.APP_PAGE : bT.PAGES);
            if (e10.append(f6, b10.html), c10.fetchCache || c10.isFallback || c10.isRoutePPREnabled || e10.append(this.getFilePath(`${a10}${d11 ? ".rsc" : ".json"}`, d11 ? bT.APP_PAGE : bT.PAGES), d11 ? b10.rscData : JSON.stringify(b10.pageData)), (null == b10 ? void 0 : b10.kind) === bS.APP_PAGE) {
              let a11;
              if (b10.segmentData) {
                a11 = [];
                let c12 = f6.replace(/\.html$/, ".segments");
                for (let [d12, f7] of b10.segmentData) {
                  a11.push(d12);
                  let b11 = c12 + d12 + ".segment.rsc";
                  e10.append(b11, f7);
                }
              }
              let c11 = { headers: b10.headers, status: b10.status, postponed: b10.postponed, segmentPaths: a11, prefetchHints: void 0 };
              e10.append(f6.replace(/\.html$/, H), JSON.stringify(c11));
            }
          } else if (b10.kind === bS.FETCH) {
            let d11 = this.getFilePath(a10, bT.FETCH);
            e10.append(d11, JSON.stringify({ ...b10, tags: c10.fetchCache ? c10.tags : [] }));
          }
          await e10.wait();
        }
        getFilePath(a10, b10) {
          switch (b10) {
            case bT.FETCH:
              return b9().join(this.serverDistDir, "..", "cache", "fetch-cache", a10);
            case bT.PAGES:
              return b9().join(this.serverDistDir, "pages", a10);
            case bT.IMAGE:
            case bT.APP_PAGE:
            case bT.APP_ROUTE:
              return b9().join(this.serverDistDir, "app", a10);
            default:
              throw Object.defineProperty(Error(`Unexpected file path kind: ${b10}`), "__NEXT_ERROR_CODE", { value: "E479", enumerable: false, configurable: true });
          }
        }
      }
      let cd = ["(..)(..)", "(.)", "(..)", "(...)"], ce = /\/[^/]*\[[^/]+\][^/]*(?=\/|$)/, cf = /\/\[[^/]+\](?=\/|$)/;
      function cg(a10) {
        return a10.replace(/(?:\/index)?\/?$/, "") || "/";
      }
      "u" > typeof performance && ["mark", "measure", "getEntriesByName"].every((a10) => "function" == typeof performance[a10]);
      class ch {
        static #a = this.cacheControls = /* @__PURE__ */ new Map();
        constructor(a10) {
          this.prerenderManifest = a10;
        }
        get(a10) {
          let b10 = ch.cacheControls.get(a10);
          if (b10) return b10;
          let c10 = this.prerenderManifest.routes[a10];
          if (c10) {
            let { initialRevalidateSeconds: a11, initialExpireSeconds: b11 } = c10;
            if (void 0 !== a11) return { revalidate: a11, expire: b11 };
          }
          let d10 = this.prerenderManifest.dynamicRoutes[a10];
          if (d10) {
            let { fallbackRevalidate: a11, fallbackExpire: b11 } = d10;
            if (void 0 !== a11) return { revalidate: a11, expire: b11 };
          }
        }
        set(a10, b10) {
          ch.cacheControls.set(a10, b10);
        }
        clear() {
          ch.cacheControls.clear();
        }
      }
      c(259);
      class ci {
        static #a = this.debug = !!process.env.NEXT_PRIVATE_DEBUG_CACHE;
        constructor({ fs: a10, dev: b10, flushToDisk: c10, minimalMode: d10, serverDistDir: e10, requestHeaders: f6, maxMemoryCacheSize: g2, getPrerenderManifest: h2, fetchCacheKeyPrefix: i2, CurCacheHandler: j2, allowedRevalidateHeaderKeys: k2 }) {
          var l2, m2, n2, o2;
          this.locks = /* @__PURE__ */ new Map(), this.hasCustomCacheHandler = !!j2;
          const p2 = Symbol.for("@next/cache-handlers"), q2 = globalThis;
          if (j2) ci.debug && console.log("IncrementalCache: using custom cache handler", j2.name);
          else {
            const b11 = q2[p2];
            (null == b11 ? void 0 : b11.FetchCache) ? (j2 = b11.FetchCache, ci.debug && console.log("IncrementalCache: using global FetchCache cache handler")) : a10 && e10 && (ci.debug && console.log("IncrementalCache: using filesystem cache handler"), j2 = cc);
          }
          process.env.__NEXT_TEST_MAX_ISR_CACHE && (g2 = parseInt(process.env.__NEXT_TEST_MAX_ISR_CACHE, 10)), this.dev = b10, this.disableForTestmode = "true" === process.env.NEXT_PRIVATE_TEST_PROXY, this.minimalMode = d10, this.requestHeaders = f6, this.allowedRevalidateHeaderKeys = k2, this.prerenderManifest = h2(), this.cacheControls = new ch(this.prerenderManifest), this.fetchCacheKeyPrefix = i2;
          let r2 = [];
          f6[G] === (null == (m2 = this.prerenderManifest) || null == (l2 = m2.preview) ? void 0 : l2.previewModeId) && (this.isOnDemandRevalidate = true), d10 && (r2 = this.revalidatedTags = function(a11, b11) {
            return "string" == typeof a11[J] && a11["x-next-revalidate-tag-token"] === b11 ? a11[J].split(",") : [];
          }(f6, null == (o2 = this.prerenderManifest) || null == (n2 = o2.preview) ? void 0 : n2.previewModeId)), j2 && (this.cacheHandler = new j2({ dev: b10, fs: a10, flushToDisk: c10, serverDistDir: e10, revalidatedTags: r2, maxMemoryCacheSize: g2, _requestHeaders: f6, fetchCacheKeyPrefix: i2 }));
        }
        calculateRevalidate(a10, b10, c10, d10) {
          if (c10) return Math.floor(performance.timeOrigin + performance.now() - 1e3);
          let e10 = this.cacheControls.get(cg(a10)), f6 = e10 ? e10.revalidate : !d10 && 1;
          return "number" == typeof f6 ? 1e3 * f6 + b10 : f6;
        }
        _getPathname(a10, b10) {
          return b10 ? a10 : /^\/index(\/|$)/.test(a10) && !function(a11, b11 = true) {
            return (void 0 !== a11.split("/").find((a12) => cd.find((b12) => a12.startsWith(b12))) && (a11 = function(a12) {
              let b12, c10, d10;
              for (let e10 of a12.split("/")) if (c10 = cd.find((a13) => e10.startsWith(a13))) {
                [b12, d10] = a12.split(c10, 2);
                break;
              }
              if (!b12 || !c10 || !d10) throw Object.defineProperty(Error(`Invalid interception route: ${a12}. Must be in the format /<intercepting route>/(..|...|..)(..)/<intercepted route>`), "__NEXT_ERROR_CODE", { value: "E269", enumerable: false, configurable: true });
              switch (b12 = aq(b12), c10) {
                case "(.)":
                  d10 = "/" === b12 ? `/${d10}` : b12 + "/" + d10;
                  break;
                case "(..)":
                  if ("/" === b12) throw Object.defineProperty(Error(`Invalid interception route: ${a12}. Cannot use (..) marker at the root level, use (.) instead.`), "__NEXT_ERROR_CODE", { value: "E207", enumerable: false, configurable: true });
                  d10 = b12.split("/").slice(0, -1).concat(d10).join("/");
                  break;
                case "(...)":
                  d10 = "/" + d10;
                  break;
                case "(..)(..)":
                  let e10 = b12.split("/");
                  if (e10.length <= 2) throw Object.defineProperty(Error(`Invalid interception route: ${a12}. Cannot use (..)(..) marker at the root level or one level up.`), "__NEXT_ERROR_CODE", { value: "E486", enumerable: false, configurable: true });
                  d10 = e10.slice(0, -2).concat(d10).join("/");
                  break;
                default:
                  throw Object.defineProperty(Error("Invariant: unexpected marker"), "__NEXT_ERROR_CODE", { value: "E112", enumerable: false, configurable: true });
              }
              return { interceptingRoute: b12, interceptedRoute: d10 };
            }(a11).interceptedRoute), b11) ? cf.test(a11) : ce.test(a11);
          }(a10) ? `/index${a10}` : "/" === a10 ? "/index" : ap(a10);
        }
        resetRequestCache() {
          var a10, b10;
          null == (b10 = this.cacheHandler) || null == (a10 = b10.resetRequestCache) || a10.call(b10);
        }
        async lock(a10) {
          for (; ; ) {
            let b11 = this.locks.get(a10);
            if (ci.debug && console.log("IncrementalCache: lock get", a10, !!b11), !b11) break;
            await b11;
          }
          let { resolve: b10, promise: c10 } = new b_();
          return ci.debug && console.log("IncrementalCache: successfully locked", a10), this.locks.set(a10, c10), () => {
            b10(), this.locks.delete(a10);
          };
        }
        async revalidateTag(a10, b10) {
          var c10;
          return null == (c10 = this.cacheHandler) ? void 0 : c10.revalidateTag(a10, b10);
        }
        async generateCacheKey(a10, b10 = {}) {
          let c10 = [], d10 = new TextEncoder(), e10 = new TextDecoder();
          if (b10.body) if (b10.body instanceof Uint8Array) c10.push(e10.decode(b10.body)), b10._ogBody = b10.body;
          else if ("function" == typeof b10.body.getReader) {
            let a11 = b10.body, f7 = [];
            try {
              await a11.pipeTo(new WritableStream({ write(a12) {
                "string" == typeof a12 ? (f7.push(d10.encode(a12)), c10.push(a12)) : (f7.push(a12), c10.push(e10.decode(a12, { stream: true })));
              } })), c10.push(e10.decode());
              let g3 = f7.reduce((a12, b11) => a12 + b11.length, 0), h3 = new Uint8Array(g3), i2 = 0;
              for (let a12 of f7) h3.set(a12, i2), i2 += a12.length;
              b10._ogBody = h3;
            } catch (a12) {
              console.error("Problem reading body", a12);
            }
          } else if ("function" == typeof b10.body.keys) {
            let a11 = b10.body;
            for (let d11 of (b10._ogBody = b10.body, /* @__PURE__ */ new Set([...a11.keys()]))) {
              let b11 = a11.getAll(d11);
              c10.push(`${d11}=${(await Promise.all(b11.map(async (a12) => "string" == typeof a12 ? a12 : await a12.text()))).join(",")}`);
            }
          } else if ("function" == typeof b10.body.arrayBuffer) {
            let a11 = b10.body, d11 = await a11.arrayBuffer();
            c10.push(await a11.text()), b10._ogBody = new Blob([d11], { type: a11.type });
          } else "string" == typeof b10.body && (c10.push(b10.body), b10._ogBody = b10.body);
          let f6 = "function" == typeof (b10.headers || {}).keys ? Object.fromEntries(b10.headers) : Object.assign({}, b10.headers);
          "traceparent" in f6 && delete f6.traceparent, "tracestate" in f6 && delete f6.tracestate;
          let g2 = JSON.stringify(["v3", this.fetchCacheKeyPrefix || "", a10, b10.method, f6, b10.mode, b10.redirect, b10.credentials, b10.referrer, b10.referrerPolicy, b10.integrity, b10.cache, c10]);
          {
            var h2;
            let a11 = d10.encode(g2);
            return h2 = await crypto.subtle.digest("SHA-256", a11), Array.prototype.map.call(new Uint8Array(h2), (a12) => a12.toString(16).padStart(2, "0")).join("");
          }
        }
        async get(a10, b10) {
          var c10, d10, e10, f6, g2, h2, i2;
          let j2, k2;
          if (b10.kind === bT.FETCH) {
            let c11 = a8.getStore(), d11 = c11 ? function(a11) {
              switch (a11.type) {
                case "request":
                case "prerender":
                case "prerender-runtime":
                case "prerender-client":
                case "validation-client":
                  if (a11.renderResumeDataCache) return a11.renderResumeDataCache;
                case "prerender-ppr":
                  return a11.prerenderResumeDataCache ?? null;
                case "cache":
                case "private-cache":
                case "unstable-cache":
                case "prerender-legacy":
                case "generate-static-params":
                  return null;
                default:
                  return a11;
              }
            }(c11) : null;
            if (d11) {
              let c12 = d11.fetch.get(a10);
              if ((null == c12 ? void 0 : c12.kind) === bS.FETCH) {
                let d12 = ax.getStore();
                if (![...b10.tags || [], ...b10.softTags || []].some((a11) => {
                  var b11, c13;
                  return (null == (b11 = this.revalidatedTags) ? void 0 : b11.includes(a11)) || (null == d12 || null == (c13 = d12.pendingRevalidatedTags) ? void 0 : c13.some((b12) => b12.tag === a11));
                })) return ci.debug && console.log("IncrementalCache: rdc:hit", a10), { isStale: false, value: c12 };
                ci.debug && console.log("IncrementalCache: rdc:revalidated-tag", a10);
              } else ci.debug && console.log("IncrementalCache: rdc:miss", a10);
            } else ci.debug && console.log("IncrementalCache: rdc:no-resume-data");
          }
          if (this.disableForTestmode || this.dev && (b10.kind !== bT.FETCH || "no-cache" === this.requestHeaders["cache-control"])) return null;
          a10 = this._getPathname(a10, b10.kind === bT.FETCH);
          let l2 = await (null == (c10 = this.cacheHandler) ? void 0 : c10.get(a10, b10));
          if (b10.kind === bT.FETCH) {
            if (!l2) return null;
            if ((null == (e10 = l2.value) ? void 0 : e10.kind) !== bS.FETCH) throw Object.defineProperty(new bc(`Expected cached value for cache key ${JSON.stringify(a10)} to be a "FETCH" kind, got ${JSON.stringify(null == (f6 = l2.value) ? void 0 : f6.kind)} instead.`), "__NEXT_ERROR_CODE", { value: "E653", enumerable: false, configurable: true });
            let c11 = ax.getStore(), d11 = [...b10.tags || [], ...b10.softTags || []];
            if (d11.some((a11) => {
              var b11, d12;
              return (null == (b11 = this.revalidatedTags) ? void 0 : b11.includes(a11)) || (null == c11 || null == (d12 = c11.pendingRevalidatedTags) ? void 0 : d12.some((b12) => b12.tag === a11));
            })) return ci.debug && console.log("IncrementalCache: expired tag", a10), null;
            let g3 = a8.getStore();
            if (g3) {
              let b11 = a9(g3);
              b11 && (ci.debug && console.log("IncrementalCache: rdc:set", a10), b11.fetch.set(a10, l2.value));
            }
            let h3 = b10.revalidate || l2.value.revalidate, i3 = (performance.timeOrigin + performance.now() - (l2.lastModified || 0)) / 1e3 > h3, j3 = l2.value.data;
            return bh(d11, l2.lastModified) ? null : (bi(d11, l2.lastModified) && (i3 = true), { isStale: i3, value: { kind: bS.FETCH, data: j3, revalidate: h3 } });
          }
          if ((null == l2 || null == (d10 = l2.value) ? void 0 : d10.kind) === bS.FETCH) throw Object.defineProperty(new bc(`Expected cached value for cache key ${JSON.stringify(a10)} not to be a ${JSON.stringify(b10.kind)} kind, got "FETCH" instead.`), "__NEXT_ERROR_CODE", { value: "E652", enumerable: false, configurable: true });
          let m2 = null, { isFallback: n2 } = b10, o2 = this.cacheControls.get(cg(a10));
          if ((null == l2 ? void 0 : l2.lastModified) === -1) j2 = -1, k2 = -31536e6;
          else {
            let c11 = performance.timeOrigin + performance.now(), d11 = (null == l2 ? void 0 : l2.lastModified) || c11;
            if (void 0 === (j2 = false !== (k2 = this.calculateRevalidate(a10, d11, this.dev ?? false, b10.isFallback)) && k2 < c11 || void 0) && ((null == l2 || null == (g2 = l2.value) ? void 0 : g2.kind) === bS.APP_PAGE || (null == l2 || null == (h2 = l2.value) ? void 0 : h2.kind) === bS.APP_ROUTE)) {
              let a11 = null == (i2 = l2.value.headers) ? void 0 : i2[I];
              if ("string" == typeof a11) {
                let b11 = a11.split(",");
                b11.length > 0 && (bh(b11, d11) ? j2 = -1 : bi(b11, d11) && (j2 = true));
              }
            }
          }
          return l2 && (m2 = { isStale: j2, cacheControl: o2, revalidateAfter: k2, value: l2.value, isFallback: n2 }), !l2 && this.prerenderManifest.notFoundRoutes.includes(a10) && (m2 = { isStale: j2, value: null, cacheControl: o2, revalidateAfter: k2, isFallback: n2 }, this.set(a10, m2.value, { ...b10, cacheControl: o2 })), m2;
        }
        async set(a10, b10, c10) {
          if ((null == b10 ? void 0 : b10.kind) === bS.FETCH) {
            let c11 = a8.getStore(), d11 = c11 ? a9(c11) : null;
            d11 && (ci.debug && console.log("IncrementalCache: rdc:set", a10), d11.fetch.set(a10, b10));
          }
          if (this.disableForTestmode || this.dev && !c10.fetchCache) return;
          a10 = this._getPathname(a10, c10.fetchCache);
          let d10 = JSON.stringify(b10).length;
          if (c10.fetchCache && d10 > 2097152 && !this.hasCustomCacheHandler && !c10.isImplicitBuildTimeCache) {
            let b11 = `Failed to set Next.js data cache for ${c10.fetchUrl || a10}, items over 2MB can not be cached (${d10} bytes)`;
            if (this.dev) throw Object.defineProperty(Error(b11), "__NEXT_ERROR_CODE", { value: "E1003", enumerable: false, configurable: true });
            console.warn(b11);
            return;
          }
          try {
            var e10;
            !c10.fetchCache && c10.cacheControl && this.cacheControls.set(cg(a10), c10.cacheControl), await (null == (e10 = this.cacheHandler) ? void 0 : e10.set(a10, b10, c10));
          } catch (b11) {
            console.warn("Failed to update prerender cache for", a10, b11);
          }
        }
      }
      c(990), "u" < typeof URLPattern || URLPattern;
      var cj = c(345);
      if (/* @__PURE__ */ new WeakMap(), cj.unstable_postpone, false === ("Route %%% needs to bail out of prerendering at this point because it used ^^^. React throws this special object to indicate where. It should not be caught by your own try/catch. Learn more: https://nextjs.org/docs/messages/ppr-caught-error".includes("needs to bail out of prerendering at this point because it used") && "Route %%% needs to bail out of prerendering at this point because it used ^^^. React throws this special object to indicate where. It should not be caught by your own try/catch. Learn more: https://nextjs.org/docs/messages/ppr-caught-error".includes("Learn more: https://nextjs.org/docs/messages/ppr-caught-error"))) throw Object.defineProperty(Error("Invariant: isDynamicPostpone misidentified a postpone reason. This is a bug in Next.js"), "__NEXT_ERROR_CODE", { value: "E296", enumerable: false, configurable: true });
      RegExp("\\n\\s+at Suspense \\(<anonymous>\\)(?:(?!\\n\\s+at (?:body|div|main|section|article|aside|header|footer|nav|form|p|span|h1|h2|h3|h4|h5|h6) \\(<anonymous>\\))[\\s\\S])*?\\n\\s+at __next_root_layout_boundary__ \\([^\\n]*\\)"), RegExp("\\n\\s+at __next_metadata_boundary__[\\n\\s]"), RegExp("\\n\\s+at __next_viewport_boundary__[\\n\\s]"), RegExp("\\n\\s+at __next_outlet_boundary__[\\n\\s]"), RegExp("\\n\\s+at __next_instant_validation_boundary__[\\n\\s]");
      let ck = globalThis.crypto.subtle;
      var cl = Object.defineProperty, cm = {}, cn = { UpstashError: () => cp, UpstashJSONParseError: () => cr, UrlError: () => cq };
      for (var co in cn) cl(cm, co, { get: cn[co], enumerable: true });
      var cp = class extends Error {
        constructor(a10, b10) {
          super(a10, b10), this.name = "UpstashError";
        }
      }, cq = class extends Error {
        constructor(a10) {
          super(`Upstash Redis client was passed an invalid URL. You should pass a URL starting with https. Received: "${a10}". `), this.name = "UrlError";
        }
      }, cr = class extends cp {
        constructor(a10, b10) {
          const c10 = a10.length > 200 ? a10.slice(0, 200) + "..." : a10;
          super(`Unable to parse response body: ${c10}`, b10), this.name = "UpstashJSONParseError";
        }
      };
      function cs(a10) {
        try {
          return function a11(b10) {
            let c10 = Array.isArray(b10) ? b10.map((b11) => {
              try {
                return a11(b11);
              } catch {
                return b11;
              }
            }) : JSON.parse(b10);
            return "number" == typeof c10 && c10.toString() !== b10 ? b10 : c10;
          }(a10);
        } catch {
          return a10;
        }
      }
      function ct(a10) {
        return [a10[0], ...cs(a10.slice(1))];
      }
      function cu(a10) {
        let [b10, c10] = a10, d10 = [];
        for (let a11 = 0; a11 < c10.length; a11 += 2) d10.push({ key: c10[a11], type: c10[a11 + 1] });
        return [b10, d10];
      }
      function cv(a10) {
        if ("object" == typeof a10 && null !== a10 && !Array.isArray(a10)) return a10;
        if (!Array.isArray(a10)) return {};
        let b10 = {};
        for (let c10 = 0; c10 < a10.length; c10 += 2) "string" == typeof a10[c10] && (b10[a10[c10]] = a10[c10 + 1]);
        return b10;
      }
      var cw = class {
        baseUrl;
        headers;
        options;
        readYourWrites;
        upstashSyncToken = "";
        hasCredentials;
        retry;
        constructor(a10) {
          if (this.options = { backend: a10.options?.backend, agent: a10.agent, responseEncoding: a10.responseEncoding ?? "base64", cache: a10.cache, signal: a10.signal, keepAlive: a10.keepAlive ?? true }, this.upstashSyncToken = "", this.readYourWrites = a10.readYourWrites ?? true, this.baseUrl = (a10.baseUrl || "").replace(/\/$/, ""), this.baseUrl && !/^https?:\/\/[^\s#$./?].\S*$/.test(this.baseUrl)) throw new cq(this.baseUrl);
          this.headers = { "Content-Type": "application/json", ...a10.headers }, this.hasCredentials = !!(this.baseUrl && this.headers.authorization.split(" ")[1]), "base64" === this.options.responseEncoding && (this.headers["Upstash-Encoding"] = "base64"), this.retry = "boolean" != typeof a10.retry || a10.retry ? { attempts: a10.retry?.retries ?? 5, backoff: a10.retry?.backoff ?? ((a11) => 50 * Math.exp(a11)) } : { attempts: 1, backoff: () => 0 };
        }
        mergeTelemetry(a10) {
          this.headers = cz(this.headers, "Upstash-Telemetry-Runtime", a10.runtime), this.headers = cz(this.headers, "Upstash-Telemetry-Platform", a10.platform), this.headers = cz(this.headers, "Upstash-Telemetry-Sdk", a10.sdk);
        }
        async request(a10) {
          let b10, c10 = function(...a11) {
            let b11 = {};
            for (let c11 of a11) if (c11) for (let [a12, d11] of Object.entries(c11)) null != d11 && (b11[a12] = d11);
            return b11;
          }(this.headers, a10.headers ?? {}), d10 = [this.baseUrl, ...a10.path ?? []].join("/"), e10 = "text/event-stream" === c10.Accept, f6 = a10.signal ?? this.options.signal, g2 = "function" == typeof f6, h2 = { cache: this.options.cache, method: "POST", headers: c10, body: JSON.stringify(a10.body), keepalive: this.options.keepAlive, agent: this.options.agent, signal: g2 ? f6() : f6, backend: this.options.backend };
          if (this.hasCredentials || console.warn("[Upstash Redis] Redis client was initialized without url or token. Failed to execute command."), this.readYourWrites) {
            let a11 = this.upstashSyncToken;
            this.headers["upstash-sync-token"] = a11;
          }
          let i2 = null, j2 = null;
          for (let a11 = 0; a11 <= this.retry.attempts; a11++) try {
            i2 = await fetch(d10, h2);
            break;
          } catch (b11) {
            if (h2.signal?.aborted && g2) throw b11;
            if (h2.signal?.aborted) {
              i2 = new Response(new Blob([JSON.stringify({ result: h2.signal.reason ?? "Aborted" })]), { status: 200, statusText: h2.signal.reason ?? "Aborted" });
              break;
            }
            j2 = b11, a11 < this.retry.attempts && await new Promise((b12) => setTimeout(b12, this.retry.backoff(a11)));
          }
          if (!i2) throw j2 ?? Error("Exhausted all retries");
          if (!i2.ok) {
            let b11, c11 = await i2.text();
            try {
              b11 = JSON.parse(c11);
            } catch (a11) {
              throw new cr(c11, { cause: a11 });
            }
            throw new cp(`${b11.error}, command was: ${JSON.stringify(a10.body)}`);
          }
          if (this.readYourWrites) {
            let a11 = i2.headers;
            this.upstashSyncToken = a11.get("upstash-sync-token") ?? "";
          }
          if (e10 && a10 && a10.onMessage && i2.body) {
            let b11 = i2.body.getReader(), c11 = new TextDecoder();
            return (async () => {
              try {
                let d11 = "";
                for (; ; ) {
                  let { value: e11, done: f7 } = await b11.read();
                  if (f7) break;
                  let g3 = (d11 += c11.decode(e11, { stream: true })).split("\n");
                  if ((d11 = g3.pop() || "").length > 1048576) throw Error("Buffer size exceeded (1MB)");
                  for (let b12 of g3) if (b12.startsWith("data: ")) {
                    let c12 = b12.slice(6);
                    a10.onMessage?.(c12);
                  }
                }
              } catch (a11) {
                a11 instanceof Error && "AbortError" === a11.name || console.error("Stream reading error:", a11);
              } finally {
                try {
                  await b11.cancel();
                } catch {
                }
              }
            })(), { result: 1 };
          }
          let k2 = await i2.text();
          try {
            b10 = JSON.parse(k2);
          } catch (a11) {
            throw new cr(k2, { cause: a11 });
          }
          if (this.readYourWrites) {
            let a11 = i2.headers;
            this.upstashSyncToken = a11.get("upstash-sync-token") ?? "";
          }
          return "base64" === this.options.responseEncoding ? Array.isArray(b10) ? b10.map(({ result: a11, error: b11 }) => ({ result: cy(a11), error: b11 })) : { result: cy(b10.result), error: b10.error } : b10;
        }
      };
      function cx(a10) {
        let b10 = "";
        try {
          let c10 = atob(a10), d10 = c10.length, e10 = new Uint8Array(d10);
          for (let a11 = 0; a11 < d10; a11++) e10[a11] = c10.charCodeAt(a11);
          b10 = new TextDecoder().decode(e10);
        } catch {
          b10 = a10;
        }
        return b10;
      }
      function cy(a10) {
        let b10;
        switch (typeof a10) {
          case "undefined":
            return a10;
          case "number":
            b10 = a10;
            break;
          case "object":
            b10 = Array.isArray(a10) ? a10.map((a11) => "string" == typeof a11 ? cx(a11) : Array.isArray(a11) ? a11.map((a12) => cy(a12)) : a11) : null;
            break;
          case "string":
            b10 = "OK" === a10 ? "OK" : cx(a10);
        }
        return b10;
      }
      function cz(a10, b10, c10) {
        return c10 && (a10[b10] = a10[b10] ? [a10[b10], c10].join(",") : c10), a10;
      }
      var cA = (a10) => {
        switch (typeof a10) {
          case "string":
          case "number":
          case "boolean":
            return a10;
          default:
            return JSON.stringify(a10);
        }
      }, cB = class {
        command;
        serialize;
        deserialize;
        headers;
        path;
        onMessage;
        isStreaming;
        signal;
        constructor(a10, b10) {
          if (this.serialize = cA, this.deserialize = b10?.automaticDeserialization === void 0 || b10.automaticDeserialization ? b10?.deserialize ?? cs : (a11) => a11, this.command = a10.map((a11) => this.serialize(a11)), this.headers = b10?.headers, this.path = b10?.path, this.onMessage = b10?.streamOptions?.onMessage, this.isStreaming = b10?.streamOptions?.isStreaming ?? false, this.signal = b10?.streamOptions?.signal, b10?.latencyLogging) {
            const a11 = this.exec.bind(this);
            this.exec = async (b11) => {
              let c10 = performance.now(), d10 = await a11(b11), e10 = (performance.now() - c10).toFixed(2);
              return console.log(`Latency for \x1B[38;2;19;185;39m${this.command[0].toString().toUpperCase()}\x1B[0m: \x1B[38;2;0;255;255m${e10} ms\x1B[0m`), d10;
            };
          }
        }
        async exec(a10) {
          let { result: b10, error: c10 } = await a10.request({ body: this.command, path: this.path, upstashSyncToken: a10.upstashSyncToken, headers: this.headers, onMessage: this.onMessage, isStreaming: this.isStreaming, signal: this.signal });
          if (c10) throw new cp(c10);
          if (void 0 === b10) throw TypeError("Request did not return a result");
          return this.deserialize(b10);
        }
      }, cC = class extends cB {
        constructor(a10, b10) {
          const c10 = ["hrandfield", a10[0]];
          "number" == typeof a10[1] && c10.push(a10[1]), a10[2] && c10.push("WITHVALUES"), super(c10, { deserialize: a10[2] ? (a11) => function(a12) {
            if (0 === a12.length) return null;
            let b11 = {};
            for (let c11 = 0; c11 < a12.length; c11 += 2) {
              let d10 = a12[c11], e10 = a12[c11 + 1];
              try {
                b11[d10] = JSON.parse(e10);
              } catch {
                b11[d10] = e10;
              }
            }
            return b11;
          }(a11) : b10?.deserialize, ...b10 });
        }
      }, cD = class extends cB {
        constructor(a10, b10) {
          super(["append", ...a10], b10);
        }
      }, cE = class extends cB {
        constructor([a10, b10, c10], d10) {
          const e10 = ["bitcount", a10];
          "number" == typeof b10 && e10.push(b10), "number" == typeof c10 && e10.push(c10), super(e10, d10);
        }
      }, cF = class {
        constructor(a10, b10, c10, d10 = (a11) => a11.exec(this.client)) {
          this.client = b10, this.opts = c10, this.execOperation = d10, this.command = ["bitfield", ...a10];
        }
        command;
        chain(...a10) {
          return this.command.push(...a10), this;
        }
        get(...a10) {
          return this.chain("get", ...a10);
        }
        set(...a10) {
          return this.chain("set", ...a10);
        }
        incrby(...a10) {
          return this.chain("incrby", ...a10);
        }
        overflow(a10) {
          return this.chain("overflow", a10);
        }
        exec() {
          let a10 = new cB(this.command, this.opts);
          return this.execOperation(a10);
        }
      }, cG = class extends cB {
        constructor(a10, b10) {
          super(["bitop", ...a10], b10);
        }
      }, cH = class extends cB {
        constructor(a10, b10) {
          super(["bitpos", ...a10], b10);
        }
      }, cI = class extends cB {
        constructor([a10, b10, c10], d10) {
          super(["COPY", a10, b10, ...c10?.replace ? ["REPLACE"] : []], { ...d10, deserialize: (a11) => a11 > 0 ? "COPIED" : "NOT_COPIED" });
        }
      }, cJ = class extends cB {
        constructor(a10) {
          super(["dbsize"], a10);
        }
      }, cK = class extends cB {
        constructor(a10, b10) {
          super(["decr", ...a10], b10);
        }
      }, cL = class extends cB {
        constructor(a10, b10) {
          super(["decrby", ...a10], b10);
        }
      }, cM = class extends cB {
        constructor(a10, b10) {
          super(["del", ...a10], b10);
        }
      }, cN = class extends cB {
        constructor(a10, b10) {
          super(["echo", ...a10], b10);
        }
      }, cO = class extends cB {
        constructor([a10, b10, c10], d10) {
          super(["eval_ro", a10, b10.length, ...b10, ...c10 ?? []], d10);
        }
      }, cP = class extends cB {
        constructor([a10, b10, c10], d10) {
          super(["eval", a10, b10.length, ...b10, ...c10 ?? []], d10);
        }
      }, cQ = class extends cB {
        constructor([a10, b10, c10], d10) {
          super(["evalsha_ro", a10, b10.length, ...b10, ...c10 ?? []], d10);
        }
      }, cR = class extends cB {
        constructor([a10, b10, c10], d10) {
          super(["evalsha", a10, b10.length, ...b10, ...c10 ?? []], d10);
        }
      }, cS = class extends cB {
        constructor(a10, b10) {
          super(a10.map((a11) => "string" == typeof a11 ? a11 : String(a11)), b10);
        }
      }, cT = class extends cB {
        constructor(a10, b10) {
          super(["exists", ...a10], b10);
        }
      }, cU = class extends cB {
        constructor(a10, b10) {
          super(["expire", ...a10.filter(Boolean)], b10);
        }
      }, cV = class extends cB {
        constructor(a10, b10) {
          super(["expireat", ...a10], b10);
        }
      }, cW = class extends cB {
        constructor([a10, b10, c10], d10) {
          super(["fcall", a10, ...b10 ? [b10.length, ...b10] : [0], ...c10 ?? []], d10);
        }
      }, cX = class extends cB {
        constructor([a10, b10, c10], d10) {
          super(["fcall_ro", a10, ...b10 ? [b10.length, ...b10] : [0], ...c10 ?? []], d10);
        }
      }, cY = class extends cB {
        constructor(a10, b10) {
          const c10 = ["flushall"];
          a10 && a10.length > 0 && a10[0].async && c10.push("async"), super(c10, b10);
        }
      }, cZ = class extends cB {
        constructor([a10], b10) {
          const c10 = ["flushdb"];
          a10?.async && c10.push("async"), super(c10, b10);
        }
      }, c$ = class extends cB {
        constructor([a10], b10) {
          super(["function", "delete", a10], b10);
        }
      }, c_ = class extends cB {
        constructor(a10) {
          super(["function", "flush"], a10);
        }
      }, c0 = class extends cB {
        constructor([a10], b10) {
          const c10 = ["function", "list"];
          a10?.libraryName && c10.push("libraryname", a10.libraryName), a10?.withCode && c10.push("withcode"), super(c10, { deserialize: c1, ...b10 });
        }
      };
      function c1(a10) {
        return Array.isArray(a10) ? a10.map((a11) => {
          let b10 = cv(a11), c10 = b10.functions.map((a12) => cv(a12));
          return { libraryName: b10.library_name, engine: b10.engine, functions: c10.map((a12) => ({ name: a12.name, description: a12.description ?? void 0, flags: a12.flags })), libraryCode: b10.library_code };
        }) : [];
      }
      var c2 = class extends cB {
        constructor([a10], b10) {
          super(["function", "load", ...a10.replace ? ["replace"] : [], a10.code], b10);
        }
      }, c3 = class extends cB {
        constructor(a10) {
          super(["function", "stats"], { deserialize: c4, ...a10 });
        }
      };
      function c4(a10) {
        return { engines: Object.fromEntries(Object.entries(Object.fromEntries(Object.entries(cv(cv(a10).engines)).map(([a11, b10]) => [a11, cv(b10)]))).map(([a11, b10]) => [a11, { librariesCount: b10.libraries_count, functionsCount: b10.functions_count }])) };
      }
      var c5 = class extends cB {
        constructor([a10, b10, ...c10], d10) {
          const e10 = ["geoadd", a10];
          "nx" in b10 && b10.nx ? e10.push("nx") : "xx" in b10 && b10.xx && e10.push("xx"), "ch" in b10 && b10.ch && e10.push("ch"), "latitude" in b10 && b10.latitude && e10.push(b10.longitude, b10.latitude, b10.member), e10.push(...c10.flatMap(({ latitude: a11, longitude: b11, member: c11 }) => [b11, a11, c11])), super(e10, d10);
        }
      }, c6 = class extends cB {
        constructor([a10, b10, c10, d10 = "M"], e10) {
          super(["GEODIST", a10, b10, c10, d10], e10);
        }
      }, c7 = class extends cB {
        constructor(a10, b10) {
          const [c10] = a10;
          super(["GEOHASH", c10, ...Array.isArray(a10[1]) ? a10[1] : a10.slice(1)], b10);
        }
      }, c8 = class extends cB {
        constructor(a10, b10) {
          const [c10] = a10;
          super(["GEOPOS", c10, ...Array.isArray(a10[1]) ? a10[1] : a10.slice(1)], { deserialize: (a11) => function(a12) {
            let b11 = [];
            for (let c11 of a12) c11?.[0] && c11?.[1] && b11.push({ lng: Number.parseFloat(c11[0]), lat: Number.parseFloat(c11[1]) });
            return b11;
          }(a11), ...b10 });
        }
      }, c9 = class extends cB {
        constructor([a10, b10, c10, d10, e10], f6) {
          const g2 = ["GEOSEARCH", a10];
          ("FROMMEMBER" === b10.type || "frommember" === b10.type) && g2.push(b10.type, b10.member), ("FROMLONLAT" === b10.type || "fromlonlat" === b10.type) && g2.push(b10.type, b10.coordinate.lon, b10.coordinate.lat), ("BYRADIUS" === c10.type || "byradius" === c10.type) && g2.push(c10.type, c10.radius, c10.radiusType), ("BYBOX" === c10.type || "bybox" === c10.type) && g2.push(c10.type, c10.rect.width, c10.rect.height, c10.rectType), g2.push(d10), e10?.count && g2.push("COUNT", e10.count.limit, ...e10.count.any ? ["ANY"] : []), super([...g2, ...e10?.withCoord ? ["WITHCOORD"] : [], ...e10?.withDist ? ["WITHDIST"] : [], ...e10?.withHash ? ["WITHHASH"] : []], { deserialize: (a11) => e10?.withCoord || e10?.withDist || e10?.withHash ? a11.map((a12) => {
            let b11 = 1, c11 = {};
            try {
              c11.member = JSON.parse(a12[0]);
            } catch {
              c11.member = a12[0];
            }
            return e10.withDist && (c11.dist = Number.parseFloat(a12[b11++])), e10.withHash && (c11.hash = a12[b11++].toString()), e10.withCoord && (c11.coord = { long: Number.parseFloat(a12[b11][0]), lat: Number.parseFloat(a12[b11][1]) }), c11;
          }) : a11.map((a12) => {
            try {
              return { member: JSON.parse(a12) };
            } catch {
              return { member: a12 };
            }
          }), ...f6 });
        }
      }, da = class extends cB {
        constructor([a10, b10, c10, d10, e10, f6], g2) {
          const h2 = ["GEOSEARCHSTORE", a10, b10];
          ("FROMMEMBER" === c10.type || "frommember" === c10.type) && h2.push(c10.type, c10.member), ("FROMLONLAT" === c10.type || "fromlonlat" === c10.type) && h2.push(c10.type, c10.coordinate.lon, c10.coordinate.lat), ("BYRADIUS" === d10.type || "byradius" === d10.type) && h2.push(d10.type, d10.radius, d10.radiusType), ("BYBOX" === d10.type || "bybox" === d10.type) && h2.push(d10.type, d10.rect.width, d10.rect.height, d10.rectType), h2.push(e10), f6?.count && h2.push("COUNT", f6.count.limit, ...f6.count.any ? ["ANY"] : []), super([...h2, ...f6?.storeDist ? ["STOREDIST"] : []], g2);
        }
      }, db = class extends cB {
        constructor(a10, b10) {
          super(["get", ...a10], b10);
        }
      }, dc = class extends cB {
        constructor(a10, b10) {
          super(["getbit", ...a10], b10);
        }
      }, dd = class extends cB {
        constructor(a10, b10) {
          super(["getdel", ...a10], b10);
        }
      }, de = class extends cB {
        constructor([a10, b10], c10) {
          const d10 = ["getex", a10];
          b10 && ("ex" in b10 && "number" == typeof b10.ex ? d10.push("ex", b10.ex) : "px" in b10 && "number" == typeof b10.px ? d10.push("px", b10.px) : "exat" in b10 && "number" == typeof b10.exat ? d10.push("exat", b10.exat) : "pxat" in b10 && "number" == typeof b10.pxat ? d10.push("pxat", b10.pxat) : "persist" in b10 && b10.persist && d10.push("persist")), super(d10, c10);
        }
      }, df = class extends cB {
        constructor(a10, b10) {
          super(["getrange", ...a10], b10);
        }
      }, dg = class extends cB {
        constructor(a10, b10) {
          super(["getset", ...a10], b10);
        }
      }, dh = class extends cB {
        constructor(a10, b10) {
          super(["hdel", ...a10], b10);
        }
      }, di = class extends cB {
        constructor(a10, b10) {
          super(["hexists", ...a10], b10);
        }
      }, dj = class extends cB {
        constructor(a10, b10) {
          const [c10, d10, e10, f6] = a10, g2 = Array.isArray(d10) ? d10 : [d10];
          super(["hexpire", c10, e10, ...f6 ? [f6] : [], "FIELDS", g2.length, ...g2], b10);
        }
      }, dk = class extends cB {
        constructor(a10, b10) {
          const [c10, d10, e10, f6] = a10, g2 = Array.isArray(d10) ? d10 : [d10];
          super(["hexpireat", c10, e10, ...f6 ? [f6] : [], "FIELDS", g2.length, ...g2], b10);
        }
      }, dl = class extends cB {
        constructor(a10, b10) {
          const [c10, d10] = a10, e10 = Array.isArray(d10) ? d10 : [d10];
          super(["hexpiretime", c10, "FIELDS", e10.length, ...e10], b10);
        }
      }, dm = class extends cB {
        constructor(a10, b10) {
          const [c10, d10] = a10, e10 = Array.isArray(d10) ? d10 : [d10];
          super(["hpersist", c10, "FIELDS", e10.length, ...e10], b10);
        }
      }, dn = class extends cB {
        constructor(a10, b10) {
          const [c10, d10, e10, f6] = a10, g2 = Array.isArray(d10) ? d10 : [d10];
          super(["hpexpire", c10, e10, ...f6 ? [f6] : [], "FIELDS", g2.length, ...g2], b10);
        }
      }, dp = class extends cB {
        constructor(a10, b10) {
          const [c10, d10, e10, f6] = a10, g2 = Array.isArray(d10) ? d10 : [d10];
          super(["hpexpireat", c10, e10, ...f6 ? [f6] : [], "FIELDS", g2.length, ...g2], b10);
        }
      }, dq = class extends cB {
        constructor(a10, b10) {
          const [c10, d10] = a10, e10 = Array.isArray(d10) ? d10 : [d10];
          super(["hpexpiretime", c10, "FIELDS", e10.length, ...e10], b10);
        }
      }, dr = class extends cB {
        constructor(a10, b10) {
          const [c10, d10] = a10, e10 = Array.isArray(d10) ? d10 : [d10];
          super(["hpttl", c10, "FIELDS", e10.length, ...e10], b10);
        }
      }, ds = class extends cB {
        constructor(a10, b10) {
          super(["hget", ...a10], b10);
        }
      }, dt = class extends cB {
        constructor(a10, b10) {
          super(["hgetall", ...a10], { deserialize: (a11) => function(a12) {
            if (0 === a12.length) return null;
            let b11 = {};
            for (let c10 = 0; c10 < a12.length; c10 += 2) {
              let d10 = a12[c10], e10 = a12[c10 + 1];
              try {
                let a13 = !Number.isNaN(Number(e10)) && !Number.isSafeInteger(Number(e10));
                b11[d10] = a13 ? e10 : JSON.parse(e10);
              } catch {
                b11[d10] = e10;
              }
            }
            return b11;
          }(a11), ...b10 });
        }
      }, du = class extends cB {
        constructor(a10, b10) {
          super(["hincrby", ...a10], b10);
        }
      }, dv = class extends cB {
        constructor(a10, b10) {
          super(["hincrbyfloat", ...a10], b10);
        }
      }, dw = class extends cB {
        constructor([a10], b10) {
          super(["hkeys", a10], b10);
        }
      }, dx = class extends cB {
        constructor(a10, b10) {
          super(["hlen", ...a10], b10);
        }
      }, dy = class extends cB {
        constructor([a10, ...b10], c10) {
          super(["hmget", a10, ...b10], { deserialize: (a11) => function(a12, b11) {
            if (b11.every((a13) => null === a13)) return null;
            let c11 = {};
            for (let [d10, e10] of a12.entries()) try {
              c11[e10] = JSON.parse(b11[d10]);
            } catch {
              c11[e10] = b11[d10];
            }
            return c11;
          }(b10, a11), ...c10 });
        }
      }, dz = class extends cB {
        constructor([a10, b10], c10) {
          super(["hmset", a10, ...Object.entries(b10).flatMap(([a11, b11]) => [a11, b11])], c10);
        }
      }, dA = class extends cB {
        constructor([a10, b10, c10], d10) {
          const e10 = ["hscan", a10, b10];
          c10?.match && e10.push("match", c10.match), "number" == typeof c10?.count && e10.push("count", c10.count), super(e10, { deserialize: ct, ...d10 });
        }
      }, dB = class extends cB {
        constructor([a10, b10], c10) {
          super(["hset", a10, ...Object.entries(b10).flatMap(([a11, b11]) => [a11, b11])], c10);
        }
      }, dC = class extends cB {
        constructor(a10, b10) {
          super(["hsetnx", ...a10], b10);
        }
      }, dD = class extends cB {
        constructor(a10, b10) {
          super(["hstrlen", ...a10], b10);
        }
      }, dE = class extends cB {
        constructor(a10, b10) {
          const [c10, d10] = a10, e10 = Array.isArray(d10) ? d10 : [d10];
          super(["httl", c10, "FIELDS", e10.length, ...e10], b10);
        }
      }, dF = class extends cB {
        constructor(a10, b10) {
          super(["hvals", ...a10], b10);
        }
      }, dG = class extends cB {
        constructor(a10, b10) {
          super(["incr", ...a10], b10);
        }
      }, dH = class extends cB {
        constructor(a10, b10) {
          super(["incrby", ...a10], b10);
        }
      }, dI = class extends cB {
        constructor(a10, b10) {
          super(["incrbyfloat", ...a10], b10);
        }
      }, dJ = class extends cB {
        constructor(a10, b10) {
          super(["JSON.ARRAPPEND", ...a10], b10);
        }
      }, dK = class extends cB {
        constructor(a10, b10) {
          super(["JSON.ARRINDEX", ...a10], b10);
        }
      }, dL = class extends cB {
        constructor(a10, b10) {
          super(["JSON.ARRINSERT", ...a10], b10);
        }
      }, dM = class extends cB {
        constructor(a10, b10) {
          super(["JSON.ARRLEN", a10[0], a10[1] ?? "$"], b10);
        }
      }, dN = class extends cB {
        constructor(a10, b10) {
          super(["JSON.ARRPOP", ...a10], b10);
        }
      }, dO = class extends cB {
        constructor(a10, b10) {
          const c10 = a10[1] ?? "$", d10 = a10[2] ?? 0, e10 = a10[3] ?? 0;
          super(["JSON.ARRTRIM", a10[0], c10, d10, e10], b10);
        }
      }, dP = class extends cB {
        constructor(a10, b10) {
          super(["JSON.CLEAR", ...a10], b10);
        }
      }, dQ = class extends cB {
        constructor(a10, b10) {
          super(["JSON.DEL", ...a10], b10);
        }
      }, dR = class extends cB {
        constructor(a10, b10) {
          super(["JSON.FORGET", ...a10], b10);
        }
      }, dS = class extends cB {
        constructor(a10, b10) {
          const c10 = ["JSON.GET"];
          "string" == typeof a10[1] ? c10.push(...a10) : (c10.push(a10[0]), a10[1] && (a10[1].indent && c10.push("INDENT", a10[1].indent), a10[1].newline && c10.push("NEWLINE", a10[1].newline), a10[1].space && c10.push("SPACE", a10[1].space)), c10.push(...a10.slice(2))), super(c10, b10);
        }
      }, dT = class extends cB {
        constructor(a10, b10) {
          super(["JSON.MERGE", ...a10], b10);
        }
      }, dU = class extends cB {
        constructor(a10, b10) {
          super(["JSON.MGET", ...a10[0], a10[1]], b10);
        }
      }, dV = class extends cB {
        constructor(a10, b10) {
          const c10 = ["JSON.MSET"];
          for (const b11 of a10) c10.push(b11.key, b11.path, b11.value);
          super(c10, b10);
        }
      }, dW = class extends cB {
        constructor(a10, b10) {
          super(["JSON.NUMINCRBY", ...a10], b10);
        }
      }, dX = class extends cB {
        constructor(a10, b10) {
          super(["JSON.NUMMULTBY", ...a10], b10);
        }
      }, dY = class extends cB {
        constructor(a10, b10) {
          super(["JSON.OBJKEYS", ...a10], b10);
        }
      }, dZ = class extends cB {
        constructor(a10, b10) {
          super(["JSON.OBJLEN", ...a10], b10);
        }
      }, d$ = class extends cB {
        constructor(a10, b10) {
          super(["JSON.RESP", ...a10], b10);
        }
      }, d_ = class extends cB {
        constructor(a10, b10) {
          const c10 = ["JSON.SET", a10[0], a10[1], a10[2]];
          a10[3] && (a10[3].nx ? c10.push("NX") : a10[3].xx && c10.push("XX")), super(c10, b10);
        }
      }, d0 = class extends cB {
        constructor(a10, b10) {
          super(["JSON.STRAPPEND", ...a10], b10);
        }
      }, d1 = class extends cB {
        constructor(a10, b10) {
          super(["JSON.STRLEN", ...a10], b10);
        }
      }, d2 = class extends cB {
        constructor(a10, b10) {
          super(["JSON.TOGGLE", ...a10], b10);
        }
      }, d3 = class extends cB {
        constructor(a10, b10) {
          super(["JSON.TYPE", ...a10], b10);
        }
      }, d4 = class extends cB {
        constructor(a10, b10) {
          super(["keys", ...a10], b10);
        }
      }, d5 = class extends cB {
        constructor(a10, b10) {
          super(["lindex", ...a10], b10);
        }
      }, d6 = class extends cB {
        constructor(a10, b10) {
          super(["linsert", ...a10], b10);
        }
      }, d7 = class extends cB {
        constructor(a10, b10) {
          super(["llen", ...a10], b10);
        }
      }, d8 = class extends cB {
        constructor(a10, b10) {
          super(["lmove", ...a10], b10);
        }
      }, d9 = class extends cB {
        constructor(a10, b10) {
          const [c10, d10, e10, f6] = a10;
          super(["LMPOP", c10, ...d10, e10, ...f6 ? ["COUNT", f6] : []], b10);
        }
      }, ea = class extends cB {
        constructor(a10, b10) {
          super(["lpop", ...a10], b10);
        }
      }, eb = class extends cB {
        constructor(a10, b10) {
          const c10 = ["lpos", a10[0], a10[1]];
          "number" == typeof a10[2]?.rank && c10.push("rank", a10[2].rank), "number" == typeof a10[2]?.count && c10.push("count", a10[2].count), "number" == typeof a10[2]?.maxLen && c10.push("maxLen", a10[2].maxLen), super(c10, b10);
        }
      }, ec = class extends cB {
        constructor(a10, b10) {
          super(["lpush", ...a10], b10);
        }
      }, ed = class extends cB {
        constructor(a10, b10) {
          super(["lpushx", ...a10], b10);
        }
      }, ee = class extends cB {
        constructor(a10, b10) {
          super(["lrange", ...a10], b10);
        }
      }, ef = class extends cB {
        constructor(a10, b10) {
          super(["lrem", ...a10], b10);
        }
      }, eg = class extends cB {
        constructor(a10, b10) {
          super(["lset", ...a10], b10);
        }
      }, eh = class extends cB {
        constructor(a10, b10) {
          super(["ltrim", ...a10], b10);
        }
      }, ei = class extends cB {
        constructor(a10, b10) {
          super(["mget", ...Array.isArray(a10[0]) ? a10[0] : a10], b10);
        }
      }, ej = class extends cB {
        constructor([a10], b10) {
          super(["mset", ...Object.entries(a10).flatMap(([a11, b11]) => [a11, b11])], b10);
        }
      }, ek = class extends cB {
        constructor([a10], b10) {
          super(["msetnx", ...Object.entries(a10).flat()], b10);
        }
      }, el = class extends cB {
        constructor(a10, b10) {
          super(["persist", ...a10], b10);
        }
      }, em = class extends cB {
        constructor(a10, b10) {
          super(["pexpire", ...a10], b10);
        }
      }, en = class extends cB {
        constructor(a10, b10) {
          super(["pexpireat", ...a10], b10);
        }
      }, eo = class extends cB {
        constructor(a10, b10) {
          super(["pfadd", ...a10], b10);
        }
      }, ep = class extends cB {
        constructor(a10, b10) {
          super(["pfcount", ...a10], b10);
        }
      }, eq = class extends cB {
        constructor(a10, b10) {
          super(["pfmerge", ...a10], b10);
        }
      }, er = class extends cB {
        constructor(a10, b10) {
          const c10 = ["ping"];
          a10?.[0] !== void 0 && c10.push(a10[0]), super(c10, b10);
        }
      }, es = class extends cB {
        constructor(a10, b10) {
          super(["psetex", ...a10], b10);
        }
      }, et = class extends cB {
        constructor(a10, b10) {
          super(["pttl", ...a10], b10);
        }
      }, eu = class extends cB {
        constructor(a10, b10) {
          super(["publish", ...a10], b10);
        }
      }, ev = class extends cB {
        constructor(a10) {
          super(["randomkey"], a10);
        }
      }, ew = class extends cB {
        constructor(a10, b10) {
          super(["rename", ...a10], b10);
        }
      }, ex = class extends cB {
        constructor(a10, b10) {
          super(["renamenx", ...a10], b10);
        }
      }, ey = class extends cB {
        constructor(a10, b10) {
          super(["rpop", ...a10], b10);
        }
      }, ez = class extends cB {
        constructor(a10, b10) {
          super(["rpush", ...a10], b10);
        }
      }, eA = class extends cB {
        constructor(a10, b10) {
          super(["rpushx", ...a10], b10);
        }
      }, eB = class extends cB {
        constructor(a10, b10) {
          super(["sadd", ...a10], b10);
        }
      }, eC = class extends cB {
        constructor([a10, b10], c10) {
          const d10 = ["scan", a10];
          b10?.match && d10.push("match", b10.match), "number" == typeof b10?.count && d10.push("count", b10.count), b10 && "withType" in b10 && true === b10.withType ? d10.push("withtype") : b10 && "type" in b10 && b10.type && b10.type.length > 0 && d10.push("type", b10.type), super(d10, { deserialize: b10?.withType ? cu : ct, ...c10 });
        }
      }, eD = class extends cB {
        constructor(a10, b10) {
          super(["scard", ...a10], b10);
        }
      }, eE = class extends cB {
        constructor(a10, b10) {
          super(["script", "exists", ...a10], { deserialize: (a11) => a11, ...b10 });
        }
      }, eF = class extends cB {
        constructor([a10], b10) {
          const c10 = ["script", "flush"];
          a10?.sync ? c10.push("sync") : a10?.async && c10.push("async"), super(c10, b10);
        }
      }, eG = class extends cB {
        constructor(a10, b10) {
          super(["script", "load", ...a10], b10);
        }
      }, eH = class extends cB {
        constructor(a10, b10) {
          super(["sdiff", ...a10], b10);
        }
      }, eI = class extends cB {
        constructor(a10, b10) {
          super(["sdiffstore", ...a10], b10);
        }
      }, eJ = class extends cB {
        constructor([a10, b10, c10], d10) {
          const e10 = ["set", a10, b10];
          c10 && ("nx" in c10 && c10.nx ? e10.push("nx") : "xx" in c10 && c10.xx && e10.push("xx"), "get" in c10 && c10.get && e10.push("get"), "ex" in c10 && "number" == typeof c10.ex ? e10.push("ex", c10.ex) : "px" in c10 && "number" == typeof c10.px ? e10.push("px", c10.px) : "exat" in c10 && "number" == typeof c10.exat ? e10.push("exat", c10.exat) : "pxat" in c10 && "number" == typeof c10.pxat ? e10.push("pxat", c10.pxat) : "keepTtl" in c10 && c10.keepTtl && e10.push("keepTtl")), super(e10, d10);
        }
      }, eK = class extends cB {
        constructor(a10, b10) {
          super(["setbit", ...a10], b10);
        }
      }, eL = class extends cB {
        constructor(a10, b10) {
          super(["setex", ...a10], b10);
        }
      }, eM = class extends cB {
        constructor(a10, b10) {
          super(["setnx", ...a10], b10);
        }
      }, eN = class extends cB {
        constructor(a10, b10) {
          super(["setrange", ...a10], b10);
        }
      }, eO = class extends cB {
        constructor(a10, b10) {
          super(["sinter", ...a10], b10);
        }
      }, eP = class extends cB {
        constructor(a10, b10) {
          super(["sinterstore", ...a10], b10);
        }
      }, eQ = class extends cB {
        constructor(a10, b10) {
          super(["sismember", ...a10], b10);
        }
      }, eR = class extends cB {
        constructor(a10, b10) {
          super(["smembers", ...a10], b10);
        }
      }, eS = class extends cB {
        constructor(a10, b10) {
          super(["smismember", a10[0], ...a10[1]], b10);
        }
      }, eT = class extends cB {
        constructor(a10, b10) {
          super(["smove", ...a10], b10);
        }
      }, eU = class extends cB {
        constructor([a10, b10], c10) {
          const d10 = ["spop", a10];
          "number" == typeof b10 && d10.push(b10), super(d10, c10);
        }
      }, eV = class extends cB {
        constructor([a10, b10], c10) {
          const d10 = ["srandmember", a10];
          "number" == typeof b10 && d10.push(b10), super(d10, c10);
        }
      }, eW = class extends cB {
        constructor(a10, b10) {
          super(["srem", ...a10], b10);
        }
      }, eX = class extends cB {
        constructor([a10, b10, c10], d10) {
          const e10 = ["sscan", a10, b10];
          c10?.match && e10.push("match", c10.match), "number" == typeof c10?.count && e10.push("count", c10.count), super(e10, { deserialize: ct, ...d10 });
        }
      }, eY = class extends cB {
        constructor(a10, b10) {
          super(["strlen", ...a10], b10);
        }
      }, eZ = class extends cB {
        constructor(a10, b10) {
          super(["sunion", ...a10], b10);
        }
      }, e$ = class extends cB {
        constructor(a10, b10) {
          super(["sunionstore", ...a10], b10);
        }
      }, e_ = class extends cB {
        constructor(a10) {
          super(["time"], a10);
        }
      }, e0 = class extends cB {
        constructor(a10, b10) {
          super(["touch", ...a10], b10);
        }
      }, e1 = class extends cB {
        constructor(a10, b10) {
          super(["ttl", ...a10], b10);
        }
      }, e2 = class extends cB {
        constructor(a10, b10) {
          super(["type", ...a10], b10);
        }
      }, e3 = class extends cB {
        constructor(a10, b10) {
          super(["unlink", ...a10], b10);
        }
      }, e4 = class extends cB {
        constructor([a10, b10, c10], d10) {
          super(["XACK", a10, b10, ...Array.isArray(c10) ? [...c10] : [c10]], d10);
        }
      }, e5 = class extends cB {
        constructor([a10, b10, c10, d10], e10) {
          const f6 = ["XADD", a10];
          for (const [a11, e11] of (d10 && (d10.nomkStream && f6.push("NOMKSTREAM"), d10.trim && (f6.push(d10.trim.type, d10.trim.comparison, d10.trim.threshold), void 0 !== d10.trim.limit && f6.push("LIMIT", d10.trim.limit))), f6.push(b10), Object.entries(c10))) f6.push(a11, e11);
          super(f6, e10);
        }
      }, e6 = class extends cB {
        constructor([a10, b10, c10, d10, e10, f6], g2) {
          const h2 = [];
          f6?.count && h2.push("COUNT", f6.count), f6?.justId && h2.push("JUSTID"), super(["XAUTOCLAIM", a10, b10, c10, d10, e10, ...h2], g2);
        }
      }, e7 = class extends cB {
        constructor([a10, b10, c10, d10, e10, f6], g2) {
          const h2 = Array.isArray(e10) ? [...e10] : [e10], i2 = [];
          f6?.idleMS && i2.push("IDLE", f6.idleMS), f6?.idleMS && i2.push("TIME", f6.timeMS), f6?.retryCount && i2.push("RETRYCOUNT", f6.retryCount), f6?.force && i2.push("FORCE"), f6?.justId && i2.push("JUSTID"), f6?.lastId && i2.push("LASTID", f6.lastId), super(["XCLAIM", a10, b10, c10, d10, ...h2, ...i2], g2);
        }
      }, e8 = class extends cB {
        constructor([a10, b10], c10) {
          super(["XDEL", a10, ...Array.isArray(b10) ? [...b10] : [b10]], c10);
        }
      }, e9 = class extends cB {
        constructor([a10, b10], c10) {
          const d10 = ["XGROUP"];
          switch (b10.type) {
            case "CREATE":
              d10.push("CREATE", a10, b10.group, b10.id), b10.options && (b10.options.MKSTREAM && d10.push("MKSTREAM"), void 0 !== b10.options.ENTRIESREAD && d10.push("ENTRIESREAD", b10.options.ENTRIESREAD.toString()));
              break;
            case "CREATECONSUMER":
              d10.push("CREATECONSUMER", a10, b10.group, b10.consumer);
              break;
            case "DELCONSUMER":
              d10.push("DELCONSUMER", a10, b10.group, b10.consumer);
              break;
            case "DESTROY":
              d10.push("DESTROY", a10, b10.group);
              break;
            case "SETID":
              d10.push("SETID", a10, b10.group, b10.id), b10.options?.ENTRIESREAD !== void 0 && d10.push("ENTRIESREAD", b10.options.ENTRIESREAD.toString());
              break;
            default:
              throw Error("Invalid XGROUP");
          }
          super(d10, c10);
        }
      }, fa = class extends cB {
        constructor([a10, b10], c10) {
          const d10 = [];
          "CONSUMERS" === b10.type ? d10.push("CONSUMERS", a10, b10.group) : d10.push("GROUPS", a10), super(["XINFO", ...d10], c10);
        }
      }, fb = class extends cB {
        constructor(a10, b10) {
          super(["XLEN", ...a10], b10);
        }
      }, fc = class extends cB {
        constructor([a10, b10, c10, d10, e10, f6], g2) {
          const h2 = f6?.consumer === void 0 ? [] : Array.isArray(f6.consumer) ? [...f6.consumer] : [f6.consumer];
          super(["XPENDING", a10, b10, ...f6?.idleTime ? ["IDLE", f6.idleTime] : [], c10, d10, e10, ...h2], g2);
        }
      }, fd = class extends cB {
        constructor([a10, b10, c10, d10], e10) {
          const f6 = ["XRANGE", a10, b10, c10];
          "number" == typeof d10 && f6.push("COUNT", d10), super(f6, { deserialize: (a11) => function(a12) {
            let b11 = {};
            for (let c11 of a12) for (let a13 = 0; a13 < c11.length; a13 += 2) {
              let d11 = c11[a13], e11 = c11[a13 + 1];
              d11 in b11 || (b11[d11] = {});
              for (let a14 = 0; a14 < e11.length; a14 += 2) {
                let c12 = e11[a14], f7 = e11[a14 + 1];
                try {
                  b11[d11][c12] = JSON.parse(f7);
                } catch {
                  b11[d11][c12] = f7;
                }
              }
            }
            return b11;
          }(a11), ...e10 });
        }
      }, fe = class extends cB {
        constructor([a10, b10, c10], d10) {
          if (Array.isArray(a10) && Array.isArray(b10) && a10.length !== b10.length) throw Error("ERR Unbalanced XREAD list of streams: for each stream key an ID or '$' must be specified");
          const e10 = [];
          "number" == typeof c10?.count && e10.push("COUNT", c10.count), "number" == typeof c10?.blockMS && e10.push("BLOCK", c10.blockMS), e10.push("STREAMS", ...Array.isArray(a10) ? [...a10] : [a10], ...Array.isArray(b10) ? [...b10] : [b10]), super(["XREAD", ...e10], d10);
        }
      }, ff = class extends cB {
        constructor([a10, b10, c10, d10, e10], f6) {
          if (Array.isArray(c10) && Array.isArray(d10) && c10.length !== d10.length) throw Error("ERR Unbalanced XREADGROUP list of streams: for each stream key an ID or '$' must be specified");
          const g2 = [];
          "number" == typeof e10?.count && g2.push("COUNT", e10.count), "number" == typeof e10?.blockMS && g2.push("BLOCK", e10.blockMS), "boolean" == typeof e10?.NOACK && e10.NOACK && g2.push("NOACK"), g2.push("STREAMS", ...Array.isArray(c10) ? [...c10] : [c10], ...Array.isArray(d10) ? [...d10] : [d10]), super(["XREADGROUP", "GROUP", a10, b10, ...g2], f6);
        }
      }, fg = class extends cB {
        constructor([a10, b10, c10, d10], e10) {
          const f6 = ["XREVRANGE", a10, b10, c10];
          "number" == typeof d10 && f6.push("COUNT", d10), super(f6, { deserialize: (a11) => function(a12) {
            let b11 = {};
            for (let c11 of a12) for (let a13 = 0; a13 < c11.length; a13 += 2) {
              let d11 = c11[a13], e11 = c11[a13 + 1];
              d11 in b11 || (b11[d11] = {});
              for (let a14 = 0; a14 < e11.length; a14 += 2) {
                let c12 = e11[a14], f7 = e11[a14 + 1];
                try {
                  b11[d11][c12] = JSON.parse(f7);
                } catch {
                  b11[d11][c12] = f7;
                }
              }
            }
            return b11;
          }(a11), ...e10 });
        }
      }, fh = class extends cB {
        constructor([a10, b10], c10) {
          const { limit: d10, strategy: e10, threshold: f6, exactness: g2 = "~" } = b10;
          super(["XTRIM", a10, e10, g2, f6, ...d10 ? ["LIMIT", d10] : []], c10);
        }
      }, fi = class extends cB {
        constructor([a10, b10, ...c10], d10) {
          const e10 = ["zadd", a10];
          "nx" in b10 && b10.nx ? e10.push("nx") : "xx" in b10 && b10.xx && e10.push("xx"), "ch" in b10 && b10.ch && e10.push("ch"), "incr" in b10 && b10.incr && e10.push("incr"), "lt" in b10 && b10.lt ? e10.push("lt") : "gt" in b10 && b10.gt && e10.push("gt"), "score" in b10 && "member" in b10 && e10.push(b10.score, b10.member), e10.push(...c10.flatMap(({ score: a11, member: b11 }) => [a11, b11])), super(e10, d10);
        }
      }, fj = class extends cB {
        constructor(a10, b10) {
          super(["zcard", ...a10], b10);
        }
      }, fk = class extends cB {
        constructor(a10, b10) {
          super(["zcount", ...a10], b10);
        }
      }, fl = class extends cB {
        constructor(a10, b10) {
          super(["zincrby", ...a10], b10);
        }
      }, fm = class extends cB {
        constructor([a10, b10, c10, d10], e10) {
          const f6 = ["zinterstore", a10, b10];
          Array.isArray(c10) ? f6.push(...c10) : f6.push(c10), d10 && ("weights" in d10 && d10.weights ? f6.push("weights", ...d10.weights) : "weight" in d10 && "number" == typeof d10.weight && f6.push("weights", d10.weight), "aggregate" in d10 && f6.push("aggregate", d10.aggregate)), super(f6, e10);
        }
      }, fn = class extends cB {
        constructor(a10, b10) {
          super(["zlexcount", ...a10], b10);
        }
      }, fo = class extends cB {
        constructor([a10, b10], c10) {
          const d10 = ["zpopmax", a10];
          "number" == typeof b10 && d10.push(b10), super(d10, c10);
        }
      }, fp = class extends cB {
        constructor([a10, b10], c10) {
          const d10 = ["zpopmin", a10];
          "number" == typeof b10 && d10.push(b10), super(d10, c10);
        }
      }, fq = class extends cB {
        constructor([a10, b10, c10, d10], e10) {
          const f6 = ["zrange", a10, b10, c10];
          d10?.byScore && f6.push("byscore"), d10?.byLex && f6.push("bylex"), d10?.rev && f6.push("rev"), d10?.count !== void 0 && void 0 !== d10.offset && f6.push("limit", d10.offset, d10.count), d10?.withScores && f6.push("withscores"), super(f6, e10);
        }
      }, fr = class extends cB {
        constructor(a10, b10) {
          super(["zrank", ...a10], b10);
        }
      }, fs = class extends cB {
        constructor(a10, b10) {
          super(["zrem", ...a10], b10);
        }
      }, ft = class extends cB {
        constructor(a10, b10) {
          super(["zremrangebylex", ...a10], b10);
        }
      }, fu = class extends cB {
        constructor(a10, b10) {
          super(["zremrangebyrank", ...a10], b10);
        }
      }, fv = class extends cB {
        constructor(a10, b10) {
          super(["zremrangebyscore", ...a10], b10);
        }
      }, fw = class extends cB {
        constructor(a10, b10) {
          super(["zrevrank", ...a10], b10);
        }
      }, fx = class extends cB {
        constructor([a10, b10, c10], d10) {
          const e10 = ["zscan", a10, b10];
          c10?.match && e10.push("match", c10.match), "number" == typeof c10?.count && e10.push("count", c10.count), super(e10, { deserialize: ct, ...d10 });
        }
      }, fy = class extends cB {
        constructor(a10, b10) {
          super(["zscore", ...a10], b10);
        }
      }, fz = class extends cB {
        constructor([a10, b10, c10], d10) {
          const e10 = ["zunion", a10];
          Array.isArray(b10) ? e10.push(...b10) : e10.push(b10), c10 && ("weights" in c10 && c10.weights ? e10.push("weights", ...c10.weights) : "weight" in c10 && "number" == typeof c10.weight && e10.push("weights", c10.weight), "aggregate" in c10 && e10.push("aggregate", c10.aggregate), c10.withScores && e10.push("withscores")), super(e10, d10);
        }
      }, fA = class extends cB {
        constructor([a10, b10, c10, d10], e10) {
          const f6 = ["zunionstore", a10, b10];
          Array.isArray(c10) ? f6.push(...c10) : f6.push(c10), d10 && ("weights" in d10 && d10.weights ? f6.push("weights", ...d10.weights) : "weight" in d10 && "number" == typeof d10.weight && f6.push("weights", d10.weight), "aggregate" in d10 && f6.push("aggregate", d10.aggregate)), super(f6, e10);
        }
      }, fB = class extends cB {
        constructor(a10, b10) {
          super(["zdiffstore", ...a10], b10);
        }
      }, fC = class extends cB {
        constructor(a10, b10) {
          const [c10, d10] = a10;
          super(["zmscore", c10, ...d10], b10);
        }
      }, fD = class {
        client;
        commands;
        commandOptions;
        multiExec;
        constructor(a10) {
          if (this.client = a10.client, this.commands = [], this.commandOptions = a10.commandOptions, this.multiExec = a10.multiExec ?? false, this.commandOptions?.latencyLogging) {
            const a11 = this.exec.bind(this);
            this.exec = async (b10) => {
              let c10 = performance.now(), d10 = await (b10 ? a11(b10) : a11()), e10 = (performance.now() - c10).toFixed(2);
              return console.log(`Latency for \x1B[38;2;19;185;39m${this.multiExec ? ["MULTI-EXEC"] : ["PIPELINE"].toString().toUpperCase()}\x1B[0m: \x1B[38;2;0;255;255m${e10} ms\x1B[0m`), d10;
            };
          }
        }
        exec = async (a10) => {
          if (0 === this.commands.length) throw Error("Pipeline is empty");
          let b10 = this.multiExec ? ["multi-exec"] : ["pipeline"], c10 = await this.client.request({ path: b10, body: Object.values(this.commands).map((a11) => a11.command) });
          return a10?.keepErrors ? c10.map(({ error: a11, result: b11 }, c11) => ({ error: a11, result: this.commands[c11].deserialize(b11) })) : c10.map(({ error: a11, result: b11 }, c11) => {
            if (a11) throw new cp(`Command ${c11 + 1} [ ${this.commands[c11].command[0]} ] failed: ${a11}`);
            return this.commands[c11].deserialize(b11);
          });
        };
        length() {
          return this.commands.length;
        }
        chain(a10) {
          return this.commands.push(a10), this;
        }
        append = (...a10) => this.chain(new cD(a10, this.commandOptions));
        bitcount = (...a10) => this.chain(new cE(a10, this.commandOptions));
        bitfield = (...a10) => new cF(a10, this.client, this.commandOptions, this.chain.bind(this));
        bitop = (a10, b10, c10, ...d10) => this.chain(new cG([a10, b10, c10, ...d10], this.commandOptions));
        bitpos = (...a10) => this.chain(new cH(a10, this.commandOptions));
        copy = (...a10) => this.chain(new cI(a10, this.commandOptions));
        zdiffstore = (...a10) => this.chain(new fB(a10, this.commandOptions));
        dbsize = () => this.chain(new cJ(this.commandOptions));
        decr = (...a10) => this.chain(new cK(a10, this.commandOptions));
        decrby = (...a10) => this.chain(new cL(a10, this.commandOptions));
        del = (...a10) => this.chain(new cM(a10, this.commandOptions));
        echo = (...a10) => this.chain(new cN(a10, this.commandOptions));
        evalRo = (...a10) => this.chain(new cO(a10, this.commandOptions));
        eval = (...a10) => this.chain(new cP(a10, this.commandOptions));
        evalshaRo = (...a10) => this.chain(new cQ(a10, this.commandOptions));
        evalsha = (...a10) => this.chain(new cR(a10, this.commandOptions));
        exists = (...a10) => this.chain(new cT(a10, this.commandOptions));
        expire = (...a10) => this.chain(new cU(a10, this.commandOptions));
        expireat = (...a10) => this.chain(new cV(a10, this.commandOptions));
        flushall = (a10) => this.chain(new cY(a10, this.commandOptions));
        flushdb = (...a10) => this.chain(new cZ(a10, this.commandOptions));
        geoadd = (...a10) => this.chain(new c5(a10, this.commandOptions));
        geodist = (...a10) => this.chain(new c6(a10, this.commandOptions));
        geopos = (...a10) => this.chain(new c8(a10, this.commandOptions));
        geohash = (...a10) => this.chain(new c7(a10, this.commandOptions));
        geosearch = (...a10) => this.chain(new c9(a10, this.commandOptions));
        geosearchstore = (...a10) => this.chain(new da(a10, this.commandOptions));
        get = (...a10) => this.chain(new db(a10, this.commandOptions));
        getbit = (...a10) => this.chain(new dc(a10, this.commandOptions));
        getdel = (...a10) => this.chain(new dd(a10, this.commandOptions));
        getex = (...a10) => this.chain(new de(a10, this.commandOptions));
        getrange = (...a10) => this.chain(new df(a10, this.commandOptions));
        getset = (a10, b10) => this.chain(new dg([a10, b10], this.commandOptions));
        hdel = (...a10) => this.chain(new dh(a10, this.commandOptions));
        hexists = (...a10) => this.chain(new di(a10, this.commandOptions));
        hexpire = (...a10) => this.chain(new dj(a10, this.commandOptions));
        hexpireat = (...a10) => this.chain(new dk(a10, this.commandOptions));
        hexpiretime = (...a10) => this.chain(new dl(a10, this.commandOptions));
        httl = (...a10) => this.chain(new dE(a10, this.commandOptions));
        hpexpire = (...a10) => this.chain(new dn(a10, this.commandOptions));
        hpexpireat = (...a10) => this.chain(new dp(a10, this.commandOptions));
        hpexpiretime = (...a10) => this.chain(new dq(a10, this.commandOptions));
        hpttl = (...a10) => this.chain(new dr(a10, this.commandOptions));
        hpersist = (...a10) => this.chain(new dm(a10, this.commandOptions));
        hget = (...a10) => this.chain(new ds(a10, this.commandOptions));
        hgetall = (...a10) => this.chain(new dt(a10, this.commandOptions));
        hincrby = (...a10) => this.chain(new du(a10, this.commandOptions));
        hincrbyfloat = (...a10) => this.chain(new dv(a10, this.commandOptions));
        hkeys = (...a10) => this.chain(new dw(a10, this.commandOptions));
        hlen = (...a10) => this.chain(new dx(a10, this.commandOptions));
        hmget = (...a10) => this.chain(new dy(a10, this.commandOptions));
        hmset = (a10, b10) => this.chain(new dz([a10, b10], this.commandOptions));
        hrandfield = (a10, b10, c10) => this.chain(new cC([a10, b10, c10], this.commandOptions));
        hscan = (...a10) => this.chain(new dA(a10, this.commandOptions));
        hset = (a10, b10) => this.chain(new dB([a10, b10], this.commandOptions));
        hsetnx = (a10, b10, c10) => this.chain(new dC([a10, b10, c10], this.commandOptions));
        hstrlen = (...a10) => this.chain(new dD(a10, this.commandOptions));
        hvals = (...a10) => this.chain(new dF(a10, this.commandOptions));
        incr = (...a10) => this.chain(new dG(a10, this.commandOptions));
        incrby = (...a10) => this.chain(new dH(a10, this.commandOptions));
        incrbyfloat = (...a10) => this.chain(new dI(a10, this.commandOptions));
        keys = (...a10) => this.chain(new d4(a10, this.commandOptions));
        lindex = (...a10) => this.chain(new d5(a10, this.commandOptions));
        linsert = (a10, b10, c10, d10) => this.chain(new d6([a10, b10, c10, d10], this.commandOptions));
        llen = (...a10) => this.chain(new d7(a10, this.commandOptions));
        lmove = (...a10) => this.chain(new d8(a10, this.commandOptions));
        lpop = (...a10) => this.chain(new ea(a10, this.commandOptions));
        lmpop = (...a10) => this.chain(new d9(a10, this.commandOptions));
        lpos = (...a10) => this.chain(new eb(a10, this.commandOptions));
        lpush = (a10, ...b10) => this.chain(new ec([a10, ...b10], this.commandOptions));
        lpushx = (a10, ...b10) => this.chain(new ed([a10, ...b10], this.commandOptions));
        lrange = (...a10) => this.chain(new ee(a10, this.commandOptions));
        lrem = (a10, b10, c10) => this.chain(new ef([a10, b10, c10], this.commandOptions));
        lset = (a10, b10, c10) => this.chain(new eg([a10, b10, c10], this.commandOptions));
        ltrim = (...a10) => this.chain(new eh(a10, this.commandOptions));
        mget = (...a10) => this.chain(new ei(a10, this.commandOptions));
        mset = (a10) => this.chain(new ej([a10], this.commandOptions));
        msetnx = (a10) => this.chain(new ek([a10], this.commandOptions));
        persist = (...a10) => this.chain(new el(a10, this.commandOptions));
        pexpire = (...a10) => this.chain(new em(a10, this.commandOptions));
        pexpireat = (...a10) => this.chain(new en(a10, this.commandOptions));
        pfadd = (...a10) => this.chain(new eo(a10, this.commandOptions));
        pfcount = (...a10) => this.chain(new ep(a10, this.commandOptions));
        pfmerge = (...a10) => this.chain(new eq(a10, this.commandOptions));
        ping = (a10) => this.chain(new er(a10, this.commandOptions));
        psetex = (a10, b10, c10) => this.chain(new es([a10, b10, c10], this.commandOptions));
        pttl = (...a10) => this.chain(new et(a10, this.commandOptions));
        publish = (...a10) => this.chain(new eu(a10, this.commandOptions));
        randomkey = () => this.chain(new ev(this.commandOptions));
        rename = (...a10) => this.chain(new ew(a10, this.commandOptions));
        renamenx = (...a10) => this.chain(new ex(a10, this.commandOptions));
        rpop = (...a10) => this.chain(new ey(a10, this.commandOptions));
        rpush = (a10, ...b10) => this.chain(new ez([a10, ...b10], this.commandOptions));
        rpushx = (a10, ...b10) => this.chain(new eA([a10, ...b10], this.commandOptions));
        sadd = (a10, b10, ...c10) => this.chain(new eB([a10, b10, ...c10], this.commandOptions));
        scan = (...a10) => this.chain(new eC(a10, this.commandOptions));
        scard = (...a10) => this.chain(new eD(a10, this.commandOptions));
        scriptExists = (...a10) => this.chain(new eE(a10, this.commandOptions));
        scriptFlush = (...a10) => this.chain(new eF(a10, this.commandOptions));
        scriptLoad = (...a10) => this.chain(new eG(a10, this.commandOptions));
        sdiff = (...a10) => this.chain(new eH(a10, this.commandOptions));
        sdiffstore = (...a10) => this.chain(new eI(a10, this.commandOptions));
        set = (a10, b10, c10) => this.chain(new eJ([a10, b10, c10], this.commandOptions));
        setbit = (...a10) => this.chain(new eK(a10, this.commandOptions));
        setex = (a10, b10, c10) => this.chain(new eL([a10, b10, c10], this.commandOptions));
        setnx = (a10, b10) => this.chain(new eM([a10, b10], this.commandOptions));
        setrange = (...a10) => this.chain(new eN(a10, this.commandOptions));
        sinter = (...a10) => this.chain(new eO(a10, this.commandOptions));
        sinterstore = (...a10) => this.chain(new eP(a10, this.commandOptions));
        sismember = (a10, b10) => this.chain(new eQ([a10, b10], this.commandOptions));
        smembers = (...a10) => this.chain(new eR(a10, this.commandOptions));
        smismember = (a10, b10) => this.chain(new eS([a10, b10], this.commandOptions));
        smove = (a10, b10, c10) => this.chain(new eT([a10, b10, c10], this.commandOptions));
        spop = (...a10) => this.chain(new eU(a10, this.commandOptions));
        srandmember = (...a10) => this.chain(new eV(a10, this.commandOptions));
        srem = (a10, ...b10) => this.chain(new eW([a10, ...b10], this.commandOptions));
        sscan = (...a10) => this.chain(new eX(a10, this.commandOptions));
        strlen = (...a10) => this.chain(new eY(a10, this.commandOptions));
        sunion = (...a10) => this.chain(new eZ(a10, this.commandOptions));
        sunionstore = (...a10) => this.chain(new e$(a10, this.commandOptions));
        time = () => this.chain(new e_(this.commandOptions));
        touch = (...a10) => this.chain(new e0(a10, this.commandOptions));
        ttl = (...a10) => this.chain(new e1(a10, this.commandOptions));
        type = (...a10) => this.chain(new e2(a10, this.commandOptions));
        unlink = (...a10) => this.chain(new e3(a10, this.commandOptions));
        zadd = (...a10) => ("score" in a10[1], this.chain(new fi([a10[0], a10[1], ...a10.slice(2)], this.commandOptions)));
        xadd = (...a10) => this.chain(new e5(a10, this.commandOptions));
        xack = (...a10) => this.chain(new e4(a10, this.commandOptions));
        xdel = (...a10) => this.chain(new e8(a10, this.commandOptions));
        xgroup = (...a10) => this.chain(new e9(a10, this.commandOptions));
        xread = (...a10) => this.chain(new fe(a10, this.commandOptions));
        xreadgroup = (...a10) => this.chain(new ff(a10, this.commandOptions));
        xinfo = (...a10) => this.chain(new fa(a10, this.commandOptions));
        xlen = (...a10) => this.chain(new fb(a10, this.commandOptions));
        xpending = (...a10) => this.chain(new fc(a10, this.commandOptions));
        xclaim = (...a10) => this.chain(new e7(a10, this.commandOptions));
        xautoclaim = (...a10) => this.chain(new e6(a10, this.commandOptions));
        xtrim = (...a10) => this.chain(new fh(a10, this.commandOptions));
        xrange = (...a10) => this.chain(new fd(a10, this.commandOptions));
        xrevrange = (...a10) => this.chain(new fg(a10, this.commandOptions));
        zcard = (...a10) => this.chain(new fj(a10, this.commandOptions));
        zcount = (...a10) => this.chain(new fk(a10, this.commandOptions));
        zincrby = (a10, b10, c10) => this.chain(new fl([a10, b10, c10], this.commandOptions));
        zinterstore = (...a10) => this.chain(new fm(a10, this.commandOptions));
        zlexcount = (...a10) => this.chain(new fn(a10, this.commandOptions));
        zmscore = (...a10) => this.chain(new fC(a10, this.commandOptions));
        zpopmax = (...a10) => this.chain(new fo(a10, this.commandOptions));
        zpopmin = (...a10) => this.chain(new fp(a10, this.commandOptions));
        zrange = (...a10) => this.chain(new fq(a10, this.commandOptions));
        zrank = (a10, b10) => this.chain(new fr([a10, b10], this.commandOptions));
        zrem = (a10, ...b10) => this.chain(new fs([a10, ...b10], this.commandOptions));
        zremrangebylex = (...a10) => this.chain(new ft(a10, this.commandOptions));
        zremrangebyrank = (...a10) => this.chain(new fu(a10, this.commandOptions));
        zremrangebyscore = (...a10) => this.chain(new fv(a10, this.commandOptions));
        zrevrank = (a10, b10) => this.chain(new fw([a10, b10], this.commandOptions));
        zscan = (...a10) => this.chain(new fx(a10, this.commandOptions));
        zscore = (a10, b10) => this.chain(new fy([a10, b10], this.commandOptions));
        zunionstore = (...a10) => this.chain(new fA(a10, this.commandOptions));
        zunion = (...a10) => this.chain(new fz(a10, this.commandOptions));
        get json() {
          return { arrappend: (...a10) => this.chain(new dJ(a10, this.commandOptions)), arrindex: (...a10) => this.chain(new dK(a10, this.commandOptions)), arrinsert: (...a10) => this.chain(new dL(a10, this.commandOptions)), arrlen: (...a10) => this.chain(new dM(a10, this.commandOptions)), arrpop: (...a10) => this.chain(new dN(a10, this.commandOptions)), arrtrim: (...a10) => this.chain(new dO(a10, this.commandOptions)), clear: (...a10) => this.chain(new dP(a10, this.commandOptions)), del: (...a10) => this.chain(new dQ(a10, this.commandOptions)), forget: (...a10) => this.chain(new dR(a10, this.commandOptions)), get: (...a10) => this.chain(new dS(a10, this.commandOptions)), merge: (...a10) => this.chain(new dT(a10, this.commandOptions)), mget: (...a10) => this.chain(new dU(a10, this.commandOptions)), mset: (...a10) => this.chain(new dV(a10, this.commandOptions)), numincrby: (...a10) => this.chain(new dW(a10, this.commandOptions)), nummultby: (...a10) => this.chain(new dX(a10, this.commandOptions)), objkeys: (...a10) => this.chain(new dY(a10, this.commandOptions)), objlen: (...a10) => this.chain(new dZ(a10, this.commandOptions)), resp: (...a10) => this.chain(new d$(a10, this.commandOptions)), set: (...a10) => this.chain(new d_(a10, this.commandOptions)), strappend: (...a10) => this.chain(new d0(a10, this.commandOptions)), strlen: (...a10) => this.chain(new d1(a10, this.commandOptions)), toggle: (...a10) => this.chain(new d2(a10, this.commandOptions)), type: (...a10) => this.chain(new d3(a10, this.commandOptions)) };
        }
        get functions() {
          return { load: (...a10) => this.chain(new c2(a10, this.commandOptions)), list: (...a10) => this.chain(new c0(a10, this.commandOptions)), delete: (...a10) => this.chain(new c$(a10, this.commandOptions)), flush: () => this.chain(new c_(this.commandOptions)), stats: () => this.chain(new c3(this.commandOptions)), call: (...a10) => this.chain(new cW(a10, this.commandOptions)), callRo: (...a10) => this.chain(new cX(a10, this.commandOptions)) };
        }
      }, fE = /* @__PURE__ */ new Set(["scan", "keys", "flushdb", "flushall", "dbsize", "hscan", "hgetall", "hkeys", "lrange", "sscan", "smembers", "xrange", "xrevrange", "zscan", "zrange", "exec"]), fF = class {
        pipelinePromises = /* @__PURE__ */ new WeakMap();
        activePipeline = null;
        indexInCurrentPipeline = 0;
        redis;
        pipeline;
        pipelineCounter = 0;
        constructor(a10) {
          this.redis = a10, this.pipeline = a10.pipeline();
        }
        async withAutoPipeline(a10) {
          let b10 = this.activePipeline ?? this.redis.pipeline();
          this.activePipeline || (this.activePipeline = b10, this.indexInCurrentPipeline = 0);
          let c10 = this.indexInCurrentPipeline++;
          a10(b10);
          let d10 = this.deferExecution().then(() => {
            if (!this.pipelinePromises.has(b10)) {
              let a11 = b10.exec({ keepErrors: true });
              this.pipelineCounter += 1, this.pipelinePromises.set(b10, a11), this.activePipeline = null;
            }
            return this.pipelinePromises.get(b10);
          }), e10 = (await d10)[c10];
          if (e10.error) throw new cp(`Command failed: ${e10.error}`);
          return e10.result;
        }
        async deferExecution() {
          await Promise.resolve(), await Promise.resolve();
        }
      }, fG = class extends cB {
        constructor(a10, b10) {
          super([], { ...b10, headers: { Accept: "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" }, path: ["psubscribe", ...a10], streamOptions: { isStreaming: true, onMessage: b10?.streamOptions?.onMessage, signal: b10?.streamOptions?.signal } });
        }
      }, fH = class extends EventTarget {
        subscriptions;
        client;
        listeners;
        opts;
        constructor(a10, b10, c10 = false, d10) {
          for (const e10 of (super(), this.client = a10, this.subscriptions = /* @__PURE__ */ new Map(), this.listeners = /* @__PURE__ */ new Map(), this.opts = d10, b10)) c10 ? this.subscribeToPattern(e10) : this.subscribeToChannel(e10);
        }
        subscribeToChannel(a10) {
          let b10 = new AbortController(), c10 = new fI([a10], { streamOptions: { signal: b10.signal, onMessage: (a11) => this.handleMessage(a11, false) } });
          c10.exec(this.client).catch((a11) => {
            "AbortError" !== a11.name && this.dispatchToListeners("error", a11);
          }), this.subscriptions.set(a10, { command: c10, controller: b10, isPattern: false });
        }
        subscribeToPattern(a10) {
          let b10 = new AbortController(), c10 = new fG([a10], { streamOptions: { signal: b10.signal, onMessage: (a11) => this.handleMessage(a11, true) } });
          c10.exec(this.client).catch((a11) => {
            "AbortError" !== a11.name && this.dispatchToListeners("error", a11);
          }), this.subscriptions.set(a10, { command: c10, controller: b10, isPattern: true });
        }
        handleMessage(a10, b10) {
          let c10 = a10.replace(/^data:\s*/, ""), d10 = c10.indexOf(","), e10 = c10.indexOf(",", d10 + 1), f6 = b10 ? c10.indexOf(",", e10 + 1) : -1;
          if (-1 !== d10 && -1 !== e10) {
            let a11 = c10.slice(0, d10);
            if (b10 && "pmessage" === a11 && -1 !== f6) {
              let a12 = c10.slice(d10 + 1, e10), b11 = c10.slice(e10 + 1, f6), g2 = c10.slice(f6 + 1);
              try {
                let c11 = this.opts?.automaticDeserialization === false ? g2 : JSON.parse(g2);
                this.dispatchToListeners("pmessage", { pattern: a12, channel: b11, message: c11 }), this.dispatchToListeners(`pmessage:${a12}`, { pattern: a12, channel: b11, message: c11 });
              } catch (a13) {
                this.dispatchToListeners("error", Error(`Failed to parse message: ${a13}`));
              }
            } else {
              let b11 = c10.slice(d10 + 1, e10), f7 = c10.slice(e10 + 1);
              try {
                if ("subscribe" === a11 || "psubscribe" === a11 || "unsubscribe" === a11 || "punsubscribe" === a11) {
                  let b12 = Number.parseInt(f7);
                  this.dispatchToListeners(a11, b12);
                } else {
                  let c11 = this.opts?.automaticDeserialization === false ? f7 : fJ(f7);
                  this.dispatchToListeners(a11, { channel: b11, message: c11 }), this.dispatchToListeners(`${a11}:${b11}`, { channel: b11, message: c11 });
                }
              } catch (a12) {
                this.dispatchToListeners("error", Error(`Failed to parse message: ${a12}`));
              }
            }
          }
        }
        dispatchToListeners(a10, b10) {
          let c10 = this.listeners.get(a10);
          if (c10) for (let a11 of c10) a11(b10);
        }
        on(a10, b10) {
          this.listeners.has(a10) || this.listeners.set(a10, /* @__PURE__ */ new Set()), this.listeners.get(a10)?.add(b10);
        }
        removeAllListeners() {
          this.listeners.clear();
        }
        async unsubscribe(a10) {
          if (a10) for (let b10 of a10) {
            let a11 = this.subscriptions.get(b10);
            if (a11) {
              try {
                a11.controller.abort();
              } catch {
              }
              this.subscriptions.delete(b10);
            }
          }
          else {
            for (let a11 of this.subscriptions.values()) try {
              a11.controller.abort();
            } catch {
            }
            this.subscriptions.clear(), this.removeAllListeners();
          }
        }
        getSubscribedChannels() {
          return [...this.subscriptions.keys()];
        }
      }, fI = class extends cB {
        constructor(a10, b10) {
          super([], { ...b10, headers: { Accept: "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" }, path: ["subscribe", ...a10], streamOptions: { isStreaming: true, onMessage: b10?.streamOptions?.onMessage, signal: b10?.streamOptions?.signal } });
        }
      }, fJ = (a10) => {
        try {
          return JSON.parse(a10);
        } catch {
          return a10;
        }
      }, fK = class {
        script;
        sha1;
        redis;
        constructor(a10, b10) {
          this.redis = a10, this.script = b10, this.sha1 = "", this.init(b10);
        }
        async init(a10) {
          this.sha1 || (this.sha1 = await this.digest(a10));
        }
        async eval(a10, b10) {
          return await this.init(this.script), await this.redis.eval(this.script, a10, b10);
        }
        async evalsha(a10, b10) {
          return await this.init(this.script), await this.redis.evalsha(this.sha1, a10, b10);
        }
        async exec(a10, b10) {
          return await this.init(this.script), await this.redis.evalsha(this.sha1, a10, b10).catch(async (c10) => {
            if (c10 instanceof Error && c10.message.toLowerCase().includes("noscript")) return await this.redis.eval(this.script, a10, b10);
            throw c10;
          });
        }
        async digest(a10) {
          let b10 = new TextEncoder().encode(a10);
          return [...new Uint8Array(await ck.digest("SHA-1", b10))].map((a11) => a11.toString(16).padStart(2, "0")).join("");
        }
      }, fL = class {
        script;
        sha1;
        redis;
        constructor(a10, b10) {
          this.redis = a10, this.sha1 = "", this.script = b10, this.init(b10);
        }
        async init(a10) {
          this.sha1 || (this.sha1 = await this.digest(a10));
        }
        async evalRo(a10, b10) {
          return await this.init(this.script), await this.redis.evalRo(this.script, a10, b10);
        }
        async evalshaRo(a10, b10) {
          return await this.init(this.script), await this.redis.evalshaRo(this.sha1, a10, b10);
        }
        async exec(a10, b10) {
          return await this.init(this.script), await this.redis.evalshaRo(this.sha1, a10, b10).catch(async (c10) => {
            if (c10 instanceof Error && c10.message.toLowerCase().includes("noscript")) return await this.redis.evalRo(this.script, a10, b10);
            throw c10;
          });
        }
        async digest(a10) {
          let b10 = new TextEncoder().encode(a10);
          return [...new Uint8Array(await ck.digest("SHA-1", b10))].map((a11) => a11.toString(16).padStart(2, "0")).join("");
        }
      }, fM = class {
        client;
        opts;
        enableTelemetry;
        enableAutoPipelining;
        constructor(a10, b10) {
          this.client = a10, this.opts = b10, this.enableTelemetry = b10?.enableTelemetry ?? true, b10?.readYourWrites === false && (this.client.readYourWrites = false), this.enableAutoPipelining = b10?.enableAutoPipelining ?? true;
        }
        get readYourWritesSyncToken() {
          return this.client.upstashSyncToken;
        }
        set readYourWritesSyncToken(a10) {
          this.client.upstashSyncToken = a10;
        }
        get json() {
          return { arrappend: (...a10) => new dJ(a10, this.opts).exec(this.client), arrindex: (...a10) => new dK(a10, this.opts).exec(this.client), arrinsert: (...a10) => new dL(a10, this.opts).exec(this.client), arrlen: (...a10) => new dM(a10, this.opts).exec(this.client), arrpop: (...a10) => new dN(a10, this.opts).exec(this.client), arrtrim: (...a10) => new dO(a10, this.opts).exec(this.client), clear: (...a10) => new dP(a10, this.opts).exec(this.client), del: (...a10) => new dQ(a10, this.opts).exec(this.client), forget: (...a10) => new dR(a10, this.opts).exec(this.client), get: (...a10) => new dS(a10, this.opts).exec(this.client), merge: (...a10) => new dT(a10, this.opts).exec(this.client), mget: (...a10) => new dU(a10, this.opts).exec(this.client), mset: (...a10) => new dV(a10, this.opts).exec(this.client), numincrby: (...a10) => new dW(a10, this.opts).exec(this.client), nummultby: (...a10) => new dX(a10, this.opts).exec(this.client), objkeys: (...a10) => new dY(a10, this.opts).exec(this.client), objlen: (...a10) => new dZ(a10, this.opts).exec(this.client), resp: (...a10) => new d$(a10, this.opts).exec(this.client), set: (...a10) => new d_(a10, this.opts).exec(this.client), strappend: (...a10) => new d0(a10, this.opts).exec(this.client), strlen: (...a10) => new d1(a10, this.opts).exec(this.client), toggle: (...a10) => new d2(a10, this.opts).exec(this.client), type: (...a10) => new d3(a10, this.opts).exec(this.client) };
        }
        get functions() {
          return { load: (...a10) => new c2(a10, this.opts).exec(this.client), list: (...a10) => new c0(a10, this.opts).exec(this.client), delete: (...a10) => new c$(a10, this.opts).exec(this.client), flush: () => new c_(this.opts).exec(this.client), stats: () => new c3(this.opts).exec(this.client), call: (...a10) => new cW(a10, this.opts).exec(this.client), callRo: (...a10) => new cX(a10, this.opts).exec(this.client) };
        }
        use = (a10) => {
          let b10 = this.client.request.bind(this.client);
          this.client.request = (c10) => a10(c10, b10);
        };
        addTelemetry = (a10) => {
          if (this.enableTelemetry) try {
            this.client.mergeTelemetry(a10);
          } catch {
          }
        };
        createScript(a10, b10) {
          return b10?.readonly ? new fL(this, a10) : new fK(this, a10);
        }
        pipeline = () => new fD({ client: this.client, commandOptions: this.opts, multiExec: false });
        autoPipeline = () => function a10(b10, c10 = "root") {
          return b10.autoPipelineExecutor || (b10.autoPipelineExecutor = new fF(b10)), new Proxy(b10, { get: (b11, d10) => {
            if ("pipelineCounter" === d10) return b11.autoPipelineExecutor.pipelineCounter;
            if ("root" === c10 && "json" === d10) return a10(b11, "json");
            if ("root" === c10 && "functions" === d10) return a10(b11, "functions");
            if ("root" === c10) {
              let a11 = d10 in b11 && !(d10 in b11.autoPipelineExecutor.pipeline), c11 = fE.has(d10);
              if (a11 || c11) return b11[d10];
            }
            let e10 = b11.autoPipelineExecutor.pipeline, f6 = "json" === c10 ? e10.json[d10] : "functions" === c10 ? e10.functions[d10] : e10[d10];
            return "function" == typeof f6 ? (...a11) => b11.autoPipelineExecutor.withAutoPipeline((b12) => {
              ("json" === c10 ? b12.json[d10] : "functions" === c10 ? b12.functions[d10] : b12[d10])(...a11);
            }) : f6;
          } });
        }(this);
        multi = () => new fD({ client: this.client, commandOptions: this.opts, multiExec: true });
        bitfield = (...a10) => new cF(a10, this.client, this.opts);
        append = (...a10) => new cD(a10, this.opts).exec(this.client);
        bitcount = (...a10) => new cE(a10, this.opts).exec(this.client);
        bitop = (a10, b10, c10, ...d10) => new cG([a10, b10, c10, ...d10], this.opts).exec(this.client);
        bitpos = (...a10) => new cH(a10, this.opts).exec(this.client);
        copy = (...a10) => new cI(a10, this.opts).exec(this.client);
        dbsize = () => new cJ(this.opts).exec(this.client);
        decr = (...a10) => new cK(a10, this.opts).exec(this.client);
        decrby = (...a10) => new cL(a10, this.opts).exec(this.client);
        del = (...a10) => new cM(a10, this.opts).exec(this.client);
        echo = (...a10) => new cN(a10, this.opts).exec(this.client);
        evalRo = (...a10) => new cO(a10, this.opts).exec(this.client);
        eval = (...a10) => new cP(a10, this.opts).exec(this.client);
        evalshaRo = (...a10) => new cQ(a10, this.opts).exec(this.client);
        evalsha = (...a10) => new cR(a10, this.opts).exec(this.client);
        exec = (a10) => new cS(a10, this.opts).exec(this.client);
        exists = (...a10) => new cT(a10, this.opts).exec(this.client);
        expire = (...a10) => new cU(a10, this.opts).exec(this.client);
        expireat = (...a10) => new cV(a10, this.opts).exec(this.client);
        flushall = (a10) => new cY(a10, this.opts).exec(this.client);
        flushdb = (...a10) => new cZ(a10, this.opts).exec(this.client);
        geoadd = (...a10) => new c5(a10, this.opts).exec(this.client);
        geopos = (...a10) => new c8(a10, this.opts).exec(this.client);
        geodist = (...a10) => new c6(a10, this.opts).exec(this.client);
        geohash = (...a10) => new c7(a10, this.opts).exec(this.client);
        geosearch = (...a10) => new c9(a10, this.opts).exec(this.client);
        geosearchstore = (...a10) => new da(a10, this.opts).exec(this.client);
        get = (...a10) => new db(a10, this.opts).exec(this.client);
        getbit = (...a10) => new dc(a10, this.opts).exec(this.client);
        getdel = (...a10) => new dd(a10, this.opts).exec(this.client);
        getex = (...a10) => new de(a10, this.opts).exec(this.client);
        getrange = (...a10) => new df(a10, this.opts).exec(this.client);
        getset = (a10, b10) => new dg([a10, b10], this.opts).exec(this.client);
        hdel = (...a10) => new dh(a10, this.opts).exec(this.client);
        hexists = (...a10) => new di(a10, this.opts).exec(this.client);
        hexpire = (...a10) => new dj(a10, this.opts).exec(this.client);
        hexpireat = (...a10) => new dk(a10, this.opts).exec(this.client);
        hexpiretime = (...a10) => new dl(a10, this.opts).exec(this.client);
        httl = (...a10) => new dE(a10, this.opts).exec(this.client);
        hpexpire = (...a10) => new dn(a10, this.opts).exec(this.client);
        hpexpireat = (...a10) => new dp(a10, this.opts).exec(this.client);
        hpexpiretime = (...a10) => new dq(a10, this.opts).exec(this.client);
        hpttl = (...a10) => new dr(a10, this.opts).exec(this.client);
        hpersist = (...a10) => new dm(a10, this.opts).exec(this.client);
        hget = (...a10) => new ds(a10, this.opts).exec(this.client);
        hgetall = (...a10) => new dt(a10, this.opts).exec(this.client);
        hincrby = (...a10) => new du(a10, this.opts).exec(this.client);
        hincrbyfloat = (...a10) => new dv(a10, this.opts).exec(this.client);
        hkeys = (...a10) => new dw(a10, this.opts).exec(this.client);
        hlen = (...a10) => new dx(a10, this.opts).exec(this.client);
        hmget = (...a10) => new dy(a10, this.opts).exec(this.client);
        hmset = (a10, b10) => new dz([a10, b10], this.opts).exec(this.client);
        hrandfield = (a10, b10, c10) => new cC([a10, b10, c10], this.opts).exec(this.client);
        hscan = (...a10) => new dA(a10, this.opts).exec(this.client);
        hset = (a10, b10) => new dB([a10, b10], this.opts).exec(this.client);
        hsetnx = (a10, b10, c10) => new dC([a10, b10, c10], this.opts).exec(this.client);
        hstrlen = (...a10) => new dD(a10, this.opts).exec(this.client);
        hvals = (...a10) => new dF(a10, this.opts).exec(this.client);
        incr = (...a10) => new dG(a10, this.opts).exec(this.client);
        incrby = (...a10) => new dH(a10, this.opts).exec(this.client);
        incrbyfloat = (...a10) => new dI(a10, this.opts).exec(this.client);
        keys = (...a10) => new d4(a10, this.opts).exec(this.client);
        lindex = (...a10) => new d5(a10, this.opts).exec(this.client);
        linsert = (a10, b10, c10, d10) => new d6([a10, b10, c10, d10], this.opts).exec(this.client);
        llen = (...a10) => new d7(a10, this.opts).exec(this.client);
        lmove = (...a10) => new d8(a10, this.opts).exec(this.client);
        lpop = (...a10) => new ea(a10, this.opts).exec(this.client);
        lmpop = (...a10) => new d9(a10, this.opts).exec(this.client);
        lpos = (...a10) => new eb(a10, this.opts).exec(this.client);
        lpush = (a10, ...b10) => new ec([a10, ...b10], this.opts).exec(this.client);
        lpushx = (a10, ...b10) => new ed([a10, ...b10], this.opts).exec(this.client);
        lrange = (...a10) => new ee(a10, this.opts).exec(this.client);
        lrem = (a10, b10, c10) => new ef([a10, b10, c10], this.opts).exec(this.client);
        lset = (a10, b10, c10) => new eg([a10, b10, c10], this.opts).exec(this.client);
        ltrim = (...a10) => new eh(a10, this.opts).exec(this.client);
        mget = (...a10) => new ei(a10, this.opts).exec(this.client);
        mset = (a10) => new ej([a10], this.opts).exec(this.client);
        msetnx = (a10) => new ek([a10], this.opts).exec(this.client);
        persist = (...a10) => new el(a10, this.opts).exec(this.client);
        pexpire = (...a10) => new em(a10, this.opts).exec(this.client);
        pexpireat = (...a10) => new en(a10, this.opts).exec(this.client);
        pfadd = (...a10) => new eo(a10, this.opts).exec(this.client);
        pfcount = (...a10) => new ep(a10, this.opts).exec(this.client);
        pfmerge = (...a10) => new eq(a10, this.opts).exec(this.client);
        ping = (a10) => new er(a10, this.opts).exec(this.client);
        psetex = (a10, b10, c10) => new es([a10, b10, c10], this.opts).exec(this.client);
        psubscribe = (a10) => {
          let b10 = Array.isArray(a10) ? a10 : [a10];
          return new fH(this.client, b10, true, this.opts);
        };
        pttl = (...a10) => new et(a10, this.opts).exec(this.client);
        publish = (...a10) => new eu(a10, this.opts).exec(this.client);
        randomkey = () => new ev().exec(this.client);
        rename = (...a10) => new ew(a10, this.opts).exec(this.client);
        renamenx = (...a10) => new ex(a10, this.opts).exec(this.client);
        rpop = (...a10) => new ey(a10, this.opts).exec(this.client);
        rpush = (a10, ...b10) => new ez([a10, ...b10], this.opts).exec(this.client);
        rpushx = (a10, ...b10) => new eA([a10, ...b10], this.opts).exec(this.client);
        sadd = (a10, b10, ...c10) => new eB([a10, b10, ...c10], this.opts).exec(this.client);
        scan(a10, b10) {
          return new eC([a10, b10], this.opts).exec(this.client);
        }
        scard = (...a10) => new eD(a10, this.opts).exec(this.client);
        scriptExists = (...a10) => new eE(a10, this.opts).exec(this.client);
        scriptFlush = (...a10) => new eF(a10, this.opts).exec(this.client);
        scriptLoad = (...a10) => new eG(a10, this.opts).exec(this.client);
        sdiff = (...a10) => new eH(a10, this.opts).exec(this.client);
        sdiffstore = (...a10) => new eI(a10, this.opts).exec(this.client);
        set = (a10, b10, c10) => new eJ([a10, b10, c10], this.opts).exec(this.client);
        setbit = (...a10) => new eK(a10, this.opts).exec(this.client);
        setex = (a10, b10, c10) => new eL([a10, b10, c10], this.opts).exec(this.client);
        setnx = (a10, b10) => new eM([a10, b10], this.opts).exec(this.client);
        setrange = (...a10) => new eN(a10, this.opts).exec(this.client);
        sinter = (...a10) => new eO(a10, this.opts).exec(this.client);
        sinterstore = (...a10) => new eP(a10, this.opts).exec(this.client);
        sismember = (a10, b10) => new eQ([a10, b10], this.opts).exec(this.client);
        smismember = (a10, b10) => new eS([a10, b10], this.opts).exec(this.client);
        smembers = (...a10) => new eR(a10, this.opts).exec(this.client);
        smove = (a10, b10, c10) => new eT([a10, b10, c10], this.opts).exec(this.client);
        spop = (...a10) => new eU(a10, this.opts).exec(this.client);
        srandmember = (...a10) => new eV(a10, this.opts).exec(this.client);
        srem = (a10, ...b10) => new eW([a10, ...b10], this.opts).exec(this.client);
        sscan = (...a10) => new eX(a10, this.opts).exec(this.client);
        strlen = (...a10) => new eY(a10, this.opts).exec(this.client);
        subscribe = (a10) => {
          let b10 = Array.isArray(a10) ? a10 : [a10];
          return new fH(this.client, b10, false, this.opts);
        };
        sunion = (...a10) => new eZ(a10, this.opts).exec(this.client);
        sunionstore = (...a10) => new e$(a10, this.opts).exec(this.client);
        time = () => new e_().exec(this.client);
        touch = (...a10) => new e0(a10, this.opts).exec(this.client);
        ttl = (...a10) => new e1(a10, this.opts).exec(this.client);
        type = (...a10) => new e2(a10, this.opts).exec(this.client);
        unlink = (...a10) => new e3(a10, this.opts).exec(this.client);
        xadd = (...a10) => new e5(a10, this.opts).exec(this.client);
        xack = (...a10) => new e4(a10, this.opts).exec(this.client);
        xdel = (...a10) => new e8(a10, this.opts).exec(this.client);
        xgroup = (...a10) => new e9(a10, this.opts).exec(this.client);
        xread = (...a10) => new fe(a10, this.opts).exec(this.client);
        xreadgroup = (...a10) => new ff(a10, this.opts).exec(this.client);
        xinfo = (...a10) => new fa(a10, this.opts).exec(this.client);
        xlen = (...a10) => new fb(a10, this.opts).exec(this.client);
        xpending = (...a10) => new fc(a10, this.opts).exec(this.client);
        xclaim = (...a10) => new e7(a10, this.opts).exec(this.client);
        xautoclaim = (...a10) => new e6(a10, this.opts).exec(this.client);
        xtrim = (...a10) => new fh(a10, this.opts).exec(this.client);
        xrange = (...a10) => new fd(a10, this.opts).exec(this.client);
        xrevrange = (...a10) => new fg(a10, this.opts).exec(this.client);
        zadd = (...a10) => ("score" in a10[1], new fi([a10[0], a10[1], ...a10.slice(2)], this.opts).exec(this.client));
        zcard = (...a10) => new fj(a10, this.opts).exec(this.client);
        zcount = (...a10) => new fk(a10, this.opts).exec(this.client);
        zdiffstore = (...a10) => new fB(a10, this.opts).exec(this.client);
        zincrby = (a10, b10, c10) => new fl([a10, b10, c10], this.opts).exec(this.client);
        zinterstore = (...a10) => new fm(a10, this.opts).exec(this.client);
        zlexcount = (...a10) => new fn(a10, this.opts).exec(this.client);
        zmscore = (...a10) => new fC(a10, this.opts).exec(this.client);
        zpopmax = (...a10) => new fo(a10, this.opts).exec(this.client);
        zpopmin = (...a10) => new fp(a10, this.opts).exec(this.client);
        zrange = (...a10) => new fq(a10, this.opts).exec(this.client);
        zrank = (a10, b10) => new fr([a10, b10], this.opts).exec(this.client);
        zrem = (a10, ...b10) => new fs([a10, ...b10], this.opts).exec(this.client);
        zremrangebylex = (...a10) => new ft(a10, this.opts).exec(this.client);
        zremrangebyrank = (...a10) => new fu(a10, this.opts).exec(this.client);
        zremrangebyscore = (...a10) => new fv(a10, this.opts).exec(this.client);
        zrevrank = (a10, b10) => new fw([a10, b10], this.opts).exec(this.client);
        zscan = (...a10) => new fx(a10, this.opts).exec(this.client);
        zscore = (a10, b10) => new fy([a10, b10], this.opts).exec(this.client);
        zunion = (...a10) => new fz(a10, this.opts).exec(this.client);
        zunionstore = (...a10) => new fA(a10, this.opts).exec(this.client);
      }, fN = class a10 extends fM {
        constructor(a11, b10) {
          if (a11.url ? (a11.url.startsWith(" ") || a11.url.endsWith(" ") || /\r|\n/.test(a11.url)) && console.warn("[Upstash Redis] The redis url contains whitespace or newline, which can cause errors!") : console.warn("[Upstash Redis] The 'url' property is missing or undefined in your Redis config."), a11.token ? (a11.token.startsWith(" ") || a11.token.endsWith(" ") || /\r|\n/.test(a11.token)) && console.warn("[Upstash Redis] The redis token contains whitespace or newline, which can cause errors!") : console.warn("[Upstash Redis] The 'token' property is missing or undefined in your Redis config."), super(new cw({ retry: a11.retry, baseUrl: a11.url, headers: { authorization: `Bearer ${a11.token}` }, responseEncoding: a11.responseEncoding, signal: a11.signal, keepAlive: a11.keepAlive, readYourWrites: a11.readYourWrites }), { enableTelemetry: a11.enableTelemetry ?? !b10?.UPSTASH_DISABLE_TELEMETRY, automaticDeserialization: a11.automaticDeserialization, latencyLogging: a11.latencyLogging, enableAutoPipelining: a11.enableAutoPipelining }), this.addTelemetry({ platform: "cloudflare", sdk: "@upstash/redis@v1.36.1" }), this.enableAutoPipelining) return this.autoPipeline();
        }
        static fromEnv(b10, c10) {
          let d10 = b10?.UPSTASH_REDIS_REST_URL ?? ("string" == typeof UPSTASH_REDIS_REST_URL ? UPSTASH_REDIS_REST_URL : void 0), e10 = b10?.UPSTASH_REDIS_REST_TOKEN ?? ("string" == typeof UPSTASH_REDIS_REST_TOKEN ? UPSTASH_REDIS_REST_TOKEN : void 0), f6 = d10 || e10 ? d10 ? e10 ? void 0 : "Unable to find environment variable: `UPSTASH_REDIS_REST_TOKEN`" : "Unable to find environment variable: `UPSTASH_REDIS_REST_URL`" : "Unable to find environment variables: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`";
          return f6 && console.warn(`[Upstash Redis] ${f6}. Please add it via \`wrangler secret put ${d10 ? "UPSTASH_REDIS_REST_TOKEN" : "UPSTASH_REDIS_REST_URL"}\` and provide it as an argument to the \`Redis.fromEnv\` function`), new a10({ ...c10, url: d10, token: e10 }, b10);
        }
      };
      let fO = null;
      function fP() {
        if (fO) return fO;
        let a10 = !!process.env.UPSTASH_REDIS_REST_URL, b10 = !!process.env.UPSTASH_REDIS_REST_TOKEN, c10 = !!process.env.KV_REST_API_URL, d10 = !!process.env.KV_REST_API_TOKEN, e10 = process.env.KV_REST_API_READ_ONLY_TOKEN, f6 = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN, g2 = e10 && f6 && f6 === e10;
        if ((g2 || !d10 && !b10 && e10) && console.log("\u{1F50D} Redis token diagnostics:", { hasKVUrl: c10, hasKVToken: d10, hasUpstashUrl: a10, hasUpstashToken: b10, hasReadOnlyToken: !!e10, tokensMatch: g2, writeTokenLength: f6?.length || 0, readOnlyTokenLength: e10?.length || 0 }), !d10 && !b10 && e10) return console.error("\u274C ERROR: Only KV_REST_API_READ_ONLY_TOKEN is set, but KV_REST_API_TOKEN is missing!"), console.error("   Write operations will fail. Please set KV_REST_API_TOKEN in Vercel environment variables."), null;
        if (g2) return console.error("\u274C ERROR: KV_REST_API_TOKEN \u0438 KV_REST_API_READ_ONLY_TOKEN \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0442!"), console.error("   KV_REST_API_TOKEN \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0442\u043E\u043A\u0435\u043D\u043E\u043C \u0434\u043B\u044F \u0437\u0430\u043F\u0438\u0441\u0438, \u0430 \u043D\u0435 read-only \u0442\u043E\u043A\u0435\u043D\u043E\u043C."), console.error("   Please check your Vercel environment variables."), null;
        if (!c10 && !a10) return null;
        let h2 = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL, i2 = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
        if (!h2 || !i2) return console.error("\u274C Redis URL or token missing", { hasKVUrl: c10, hasKVToken: d10, hasUpstashUrl: a10, hasUpstashToken: b10 }), null;
        if (e10 && i2 === e10) return console.error("\u274C ERROR: Attempting to use read-only token for write operations!"), console.error("   The token matches KV_REST_API_READ_ONLY_TOKEN. Please use KV_REST_API_TOKEN with write permissions."), null;
        try {
          return fO = new fN({ url: h2, token: i2 });
        } catch (e11) {
          return console.error("\u274C Failed to create Redis instance:", { error: e11?.message, stack: e11?.stack, hasKVUrl: c10, hasKVToken: d10, hasUpstashUrl: a10, hasUpstashToken: b10 }), null;
        }
      }
      fP();
      let fQ = false, fR = false, fS = null, fT = null, fU = /* @__PURE__ */ new Map();
      if (!fR) try {
        let a10 = fP(), b10 = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
        if (a10 && b10) {
          let { Ratelimit: b11 } = c(286);
          fT = b11, fS = a10, fQ = true, console.log("\u2705 Using Upstash Redis for rate limiting");
        } else console.log("\u2139\uFE0F Redis not configured, using in-memory fallback for rate limiting");
      } catch (a10) {
        console.warn("\u26A0\uFE0F Upstash Redis not available, using in-memory fallback:", a10), fQ = false, fR = true, fS = null, fT = null;
      }
      let fV = {};
      async function fW(a10, b10, c10 = "default") {
        var d10;
        let e10, f6;
        if (fQ && fS && fT) try {
          let d11 = `${c10}:${b10.maxRequests}:${b10.interval}`, e11 = fU.get(d11);
          e11 || (e11 = new fT({ redis: fS, limiter: fT.slidingWindow(b10.maxRequests, function(a11) {
            if (a11 <= 0) return "60 s";
            if (a11 % 6e4 == 0) return `${Math.max(1, Math.round(a11 / 6e4))} m`;
            let b11 = Math.max(1, Math.ceil(a11 / 1e3));
            return `${b11} s`;
          }(b10.interval)), analytics: true }), fU.set(d11, e11));
          let f7 = await e11.limit(a10);
          return { success: f7.success, remaining: f7.remaining, resetAt: f7.reset ? new Date(f7.reset).getTime() : Date.now() + b10.interval };
        } catch (a11) {
          (a11?.message?.includes("NOPERM") || a11?.message?.includes("evalsha") || a11?.code === "NOPERM") && !fR ? (fQ = false, fR = true, fS = null, fT = null, fU.clear()) : fR || console.error("Redis rate limit error, falling back to in-memory:", a11);
        }
        return d10 = `${c10}:${a10}`, e10 = Date.now(), fV[d10] && fV[d10].resetAt < e10 && delete fV[d10], fV[d10] || (fV[d10] = { count: 0, resetAt: e10 + b10.interval }), (f6 = fV[d10]).count >= b10.maxRequests ? { success: false, remaining: 0, resetAt: f6.resetAt } : (f6.count++, { success: true, remaining: b10.maxRequests - f6.count, resetAt: f6.resetAt });
      }
      let fX = { "/api/plan/generate": { maxRequests: 10, interval: 6e4 }, "/api/questionnaire/answers": { maxRequests: 15, interval: 6e4 }, "/api/questionnaire/partial-update": { maxRequests: 10, interval: 6e4 }, "/api/products/batch": { maxRequests: 30, interval: 6e4 }, "/api/recommendations": { maxRequests: 20, interval: 6e4 }, "/api/admin/login": { maxRequests: 5, interval: 9e5 }, "/api/admin/login-email": { maxRequests: 10, interval: 6e4 }, "/api/wishlist": { maxRequests: 30, interval: 6e4 }, "/api/cart": { maxRequests: 30, interval: 6e4 }, "/api/plan/progress": { maxRequests: 30, interval: 6e4 } }, fY = ["/api/questionnaire/active", "/api/questionnaire/answers", "/api/questionnaire/progress", "/api/plan/generate", "/api/recommendations", "/api/profile/current", "/api/cart", "/api/wishlist", "/api/telegram/webhook", "/api/logs", "/api/admin/login", "/api/admin/login-email", "/api/admin/auth", "/api/admin/verify", "/admin/login", "/admin/set-webhook", "/admin/webhook-status", "/api/debug", "/debug", "/logs"];
      async function fZ(a10) {
        let { pathname: b10 } = a10.nextUrl;
        for (let [c11, d10] of Object.entries(fX)) if (b10 === c11 || b10.startsWith(c11 + "/")) {
          let b11 = function(a11) {
            let b12 = function(a12) {
              if (!a12) return null;
              let b13 = a12.match(/user=%7B%22id%22%3A(\d+)/) || decodeURIComponent(a12).match(/"id"\s*:\s*(\d+)/);
              return b13 ? `tg:${b13[1]}` : null;
            }(a11.headers.get("x-telegram-init-data") || a11.headers.get("X-Telegram-Init-Data"));
            if (b12) return b12;
            let c12 = a11.headers.get("x-forwarded-for");
            if (c12) return c12.split(",")[0].trim();
            let d11 = a11.headers.get("x-real-ip");
            return d11 || (a11.headers.get("user-agent") || "unknown").substring(0, 50);
          }(a10), e10 = await fW(b11, d10, c11);
          if (!e10.success) {
            let a11 = Math.max(1, Math.ceil((e10.resetAt - Date.now()) / 1e3));
            return ak.json({ error: "Too many requests. Please try again later.", retryAfter: a11 }, { status: 429, headers: { "Retry-After": String(a11), "X-RateLimit-Limit": String(d10.maxRequests), "X-RateLimit-Remaining": String(e10.remaining), "X-RateLimit-Reset": String(Math.ceil(e10.resetAt / 1e3)) } });
          }
          break;
        }
        let c10 = new Headers(a10.headers);
        if (c10.set("x-pathname", b10), fY.some((a11) => b10.startsWith(a11))) return ak.next({ request: { headers: c10 } });
        if (b10.startsWith("/api/")) {
          if (fY.some((a11) => b10.startsWith(a11))) return ak.next({ request: { headers: c10 } });
          if (b10.startsWith("/api/admin/") && !b10.startsWith("/api/admin/auth")) {
            let b11 = a10.cookies.get("admin_token")?.value, c11 = a10.headers.get("authorization"), d10 = c11?.startsWith("Bearer ") ? c11.slice(7) : null;
            if (!(b11 ?? d10)) return ak.json({ error: "Unauthorized" }, { status: 401 });
          }
        }
        return ak.next({ request: { headers: c10 } });
      }
      let f$ = { matcher: ["/api/:path*", "/admin", "/admin/:path*", "/((?!_next/static|_next/image|favicon.ico|icons|fonts|sw.js).*)"] };
      Object.values({ NOT_FOUND: 404, FORBIDDEN: 403, UNAUTHORIZED: 401 });
      let f_ = { ...v }, f0 = "/middleware", f1 = (0, f_.middleware || f_.default);
      class f2 extends Error {
        constructor(a10) {
          super(a10), this.stack = "";
        }
      }
      if ("function" != typeof f1) throw new f2(`The Middleware file "${f0}" must export a function named \`middleware\` or a default function.`);
      let f3 = (a10) => bG({ ...a10, IncrementalCache: ci, incrementalCacheHandler: null, page: f0, handler: async (...a11) => {
        try {
          return await f1(...a11);
        } catch (e10) {
          let b10 = a11[0], c10 = new URL(b10.url), d10 = c10.pathname + c10.search;
          throw await z(e10, { path: d10, method: b10.method, headers: Object.fromEntries(b10.headers.entries()) }, { routerKind: "Pages Router", routePath: "/proxy", routeType: "proxy", revalidateReason: void 0 }), e10;
        }
      } });
      async function f4(a10, b10) {
        let c10 = await f3({ request: { url: a10.url, method: a10.method, headers: N(a10.headers), nextConfig: { basePath: "", i18n: "", trailingSlash: false, experimental: { cacheLife: { default: { stale: 300, revalidate: 900, expire: 4294967294 }, seconds: { stale: 30, revalidate: 1, expire: 60 }, minutes: { stale: 300, revalidate: 60, expire: 3600 }, hours: { stale: 300, revalidate: 3600, expire: 86400 }, days: { stale: 300, revalidate: 86400, expire: 604800 }, weeks: { stale: 300, revalidate: 604800, expire: 2592e3 }, max: { stale: 300, revalidate: 2592e3, expire: 31536e3 } }, authInterrupts: false, clientParamParsingOrigins: [] } }, page: { name: f0 }, body: "GET" !== a10.method && "HEAD" !== a10.method ? a10.body ?? void 0 : void 0, waitUntil: b10.waitUntil, requestMeta: b10.requestMeta, signal: b10.signal || new AbortController().signal } });
        return null == b10.waitUntil || b10.waitUntil.call(b10, c10.waitUntil), c10.response;
      }
      let f5 = f3;
    }, 709: (a) => {
      "use strict";
      var b = Object.defineProperty, c = Object.getOwnPropertyDescriptor, d = Object.getOwnPropertyNames, e = Object.prototype.hasOwnProperty, f = {}, g = { Analytics: () => l };
      for (var h in g) b(f, h, { get: g[h], enumerable: true });
      a.exports = ((a2, f2, g2, h2) => {
        if (f2 && "object" == typeof f2 || "function" == typeof f2) for (let i2 of d(f2)) e.call(a2, i2) || i2 === g2 || b(a2, i2, { get: () => f2[i2], enumerable: !(h2 = c(f2, i2)) || h2.enumerable });
        return a2;
      })(b({}, "__esModule", { value: true }), f);
      var i = `
local key = KEYS[1]
local field = ARGV[1]

local data = redis.call("ZRANGE", key, 0, -1, "WITHSCORES")
local count = {}

for i = 1, #data, 2 do
  local json_str = data[i]
  local score = tonumber(data[i + 1])
  local obj = cjson.decode(json_str)

  local fieldValue = obj[field]

  if count[fieldValue] == nil then
    count[fieldValue] = score
  else
    count[fieldValue] = count[fieldValue] + score
  end
end

local result = {}
for k, v in pairs(count) do
  table.insert(result, {k, v})
end

return result
`, j = `
local prefix = KEYS[1]
local first_timestamp = tonumber(ARGV[1]) -- First timestamp to check
local increment = tonumber(ARGV[2])       -- Increment between each timestamp
local num_timestamps = tonumber(ARGV[3])  -- Number of timestampts to check (24 for a day and 24 * 7 for a week)
local num_elements = tonumber(ARGV[4])    -- Number of elements to fetch in each category
local check_at_most = tonumber(ARGV[5])   -- Number of elements to check at most.

local keys = {}
for i = 1, num_timestamps do
  local timestamp = first_timestamp - (i - 1) * increment
  table.insert(keys, prefix .. ":" .. timestamp)
end

-- get the union of the groups
local zunion_params = {"ZUNION", num_timestamps, unpack(keys)}
table.insert(zunion_params, "WITHSCORES")
local result = redis.call(unpack(zunion_params))

-- select num_elements many items
local true_group = {}
local false_group = {}
local denied_group = {}
local true_count = 0
local false_count = 0
local denied_count = 0
local i = #result - 1

-- index to stop at after going through "checkAtMost" many items:
local cutoff_index = #result - 2 * check_at_most

-- iterate over the results
while (true_count + false_count + denied_count) < (num_elements * 3) and 1 <= i and i >= cutoff_index do
  local score = tonumber(result[i + 1])
  if score > 0 then
    local element = result[i]
    if string.find(element, "success\\":true") and true_count < num_elements then
      table.insert(true_group, {score, element})
      true_count = true_count + 1
    elseif string.find(element, "success\\":false") and false_count < num_elements then
      table.insert(false_group, {score, element})
      false_count = false_count + 1
    elseif string.find(element, "success\\":\\"denied") and denied_count < num_elements then
      table.insert(denied_group, {score, element})
      denied_count = denied_count + 1
    end
  end
  i = i - 2
end

return {true_group, false_group, denied_group}
`, k = `
local prefix = KEYS[1]
local first_timestamp = tonumber(ARGV[1])
local increment = tonumber(ARGV[2])
local num_timestamps = tonumber(ARGV[3])

local keys = {}
for i = 1, num_timestamps do
  local timestamp = first_timestamp - (i - 1) * increment
  table.insert(keys, prefix .. ":" .. timestamp)
end

-- get the union of the groups
local zunion_params = {"ZUNION", num_timestamps, unpack(keys)}
table.insert(zunion_params, "WITHSCORES")
local result = redis.call(unpack(zunion_params))

return result
`, l = class {
        redis;
        prefix;
        bucketSize;
        constructor(a2) {
          this.redis = a2.redis, this.prefix = a2.prefix ?? "@upstash/analytics", this.bucketSize = this.parseWindow(a2.window);
        }
        validateTableName(a2) {
          if (!/^[a-zA-Z0-9_-]+$/.test(a2)) throw Error(`Invalid table name: ${a2}. Table names can only contain letters, numbers, dashes and underscores.`);
        }
        parseWindow(a2) {
          if ("number" == typeof a2) {
            if (a2 <= 0) throw Error(`Invalid window: ${a2}`);
            return a2;
          }
          let b2 = /^(\d+)([smhd])$/;
          if (!b2.test(a2)) throw Error(`Invalid window: ${a2}`);
          let [, c2, d2] = a2.match(b2), e2 = parseInt(c2);
          switch (d2) {
            case "s":
              return 1e3 * e2;
            case "m":
              return 1e3 * e2 * 60;
            case "h":
              return 1e3 * e2 * 3600;
            case "d":
              return 1e3 * e2 * 86400;
            default:
              throw Error(`Invalid window unit: ${d2}`);
          }
        }
        getBucket(a2) {
          return Math.floor((a2 ?? Date.now()) / this.bucketSize) * this.bucketSize;
        }
        async ingest(a2, ...b2) {
          this.validateTableName(a2), await Promise.all(b2.map(async (b3) => {
            let c2 = this.getBucket(b3.time), d2 = [this.prefix, a2, c2].join(":");
            await this.redis.zincrby(d2, 1, JSON.stringify({ ...b3, time: void 0 }));
          }));
        }
        formatBucketAggregate(a2, b2, c2) {
          let d2 = {};
          return a2.forEach(([a3, c3]) => {
            "success" == b2 && (a3 = 1 === a3 ? "true" : null === a3 ? "false" : a3), d2[b2] = d2[b2] || {}, d2[b2][(a3 ?? "null").toString()] = c3;
          }), { time: c2, ...d2 };
        }
        async aggregateBucket(a2, b2, c2) {
          this.validateTableName(a2);
          let d2 = this.getBucket(c2), e2 = [this.prefix, a2, d2].join(":"), f2 = await this.redis.eval(i, [e2], [b2]);
          return this.formatBucketAggregate(f2, b2, d2);
        }
        async aggregateBuckets(a2, b2, c2, d2) {
          this.validateTableName(a2);
          let e2 = this.getBucket(d2), f2 = [];
          for (let d3 = 0; d3 < c2; d3 += 1) f2.push(this.aggregateBucket(a2, b2, e2)), e2 -= this.bucketSize;
          return Promise.all(f2);
        }
        async aggregateBucketsWithPipeline(a2, b2, c2, d2, e2) {
          this.validateTableName(a2), e2 = e2 ?? 48;
          let f2 = this.getBucket(d2), g2 = [], h2 = this.redis.pipeline(), j2 = [];
          for (let d3 = 1; d3 <= c2; d3 += 1) {
            let k2 = [this.prefix, a2, f2].join(":");
            h2.eval(i, [k2], [b2]), g2.push(f2), f2 -= this.bucketSize, (d3 % e2 == 0 || d3 == c2) && (j2.push(h2.exec()), h2 = this.redis.pipeline());
          }
          return (await Promise.all(j2)).flat().map((a3, c3) => this.formatBucketAggregate(a3, b2, g2[c3]));
        }
        async getAllowedBlocked(a2, b2, c2) {
          this.validateTableName(a2);
          let d2 = [this.prefix, a2].join(":"), e2 = this.getBucket(c2), f2 = await this.redis.eval(k, [d2], [e2, this.bucketSize, b2]), g2 = {};
          for (let a3 = 0; a3 < f2.length; a3 += 2) {
            let b3 = f2[a3], c3 = b3.identifier, d3 = +f2[a3 + 1];
            g2[c3] || (g2[c3] = { success: 0, blocked: 0 }), g2[c3][b3.success ? "success" : "blocked"] = d3;
          }
          return g2;
        }
        async getMostAllowedBlocked(a2, b2, c2, d2, e2) {
          this.validateTableName(a2);
          let f2 = [this.prefix, a2].join(":"), g2 = this.getBucket(d2), [h2, i2, k2] = await this.redis.eval(j, [f2], [g2, this.bucketSize, b2, c2, e2 ?? 5 * c2]);
          return { allowed: this.toDicts(h2), ratelimited: this.toDicts(i2), denied: this.toDicts(k2) };
        }
        toDicts(a2) {
          let b2 = [];
          for (let c2 = 0; c2 < a2.length; c2 += 1) {
            let d2 = +a2[c2][0], e2 = a2[c2][1];
            b2.push({ identifier: e2.identifier, count: d2 });
          }
          return b2;
        }
      };
    }, 852: (a) => {
      (() => {
        "use strict";
        "u" > typeof __nccwpck_require__ && (__nccwpck_require__.ab = "//");
        var b, c, d, e, f = {};
        f.parse = function(a2, c2) {
          if ("string" != typeof a2) throw TypeError("argument str must be a string");
          for (var e2 = {}, f2 = a2.split(d), g = (c2 || {}).decode || b, h = 0; h < f2.length; h++) {
            var i = f2[h], j = i.indexOf("=");
            if (!(j < 0)) {
              var k = i.substr(0, j).trim(), l = i.substr(++j, i.length).trim();
              '"' == l[0] && (l = l.slice(1, -1)), void 0 == e2[k] && (e2[k] = function(a3, b2) {
                try {
                  return b2(a3);
                } catch (b3) {
                  return a3;
                }
              }(l, g));
            }
          }
          return e2;
        }, f.serialize = function(a2, b2, d2) {
          var f2 = d2 || {}, g = f2.encode || c;
          if ("function" != typeof g) throw TypeError("option encode is invalid");
          if (!e.test(a2)) throw TypeError("argument name is invalid");
          var h = g(b2);
          if (h && !e.test(h)) throw TypeError("argument val is invalid");
          var i = a2 + "=" + h;
          if (null != f2.maxAge) {
            var j = f2.maxAge - 0;
            if (isNaN(j) || !isFinite(j)) throw TypeError("option maxAge is invalid");
            i += "; Max-Age=" + Math.floor(j);
          }
          if (f2.domain) {
            if (!e.test(f2.domain)) throw TypeError("option domain is invalid");
            i += "; Domain=" + f2.domain;
          }
          if (f2.path) {
            if (!e.test(f2.path)) throw TypeError("option path is invalid");
            i += "; Path=" + f2.path;
          }
          if (f2.expires) {
            if ("function" != typeof f2.expires.toUTCString) throw TypeError("option expires is invalid");
            i += "; Expires=" + f2.expires.toUTCString();
          }
          if (f2.httpOnly && (i += "; HttpOnly"), f2.secure && (i += "; Secure"), f2.sameSite) switch ("string" == typeof f2.sameSite ? f2.sameSite.toLowerCase() : f2.sameSite) {
            case true:
            case "strict":
              i += "; SameSite=Strict";
              break;
            case "lax":
              i += "; SameSite=Lax";
              break;
            case "none":
              i += "; SameSite=None";
              break;
            default:
              throw TypeError("option sameSite is invalid");
          }
          return i;
        }, b = decodeURIComponent, c = encodeURIComponent, d = /; */, e = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/, a.exports = f;
      })();
    }, 918: (a) => {
      "use strict";
      var b = Object.defineProperty, c = Object.getOwnPropertyDescriptor, d = Object.getOwnPropertyNames, e = Object.prototype.hasOwnProperty, f = {}, g = { RequestCookies: () => n, ResponseCookies: () => o, parseCookie: () => j, parseSetCookie: () => k, stringifyCookie: () => i };
      for (var h in g) b(f, h, { get: g[h], enumerable: true });
      function i(a2) {
        var b2;
        let c2 = ["path" in a2 && a2.path && `Path=${a2.path}`, "expires" in a2 && (a2.expires || 0 === a2.expires) && `Expires=${("number" == typeof a2.expires ? new Date(a2.expires) : a2.expires).toUTCString()}`, "maxAge" in a2 && "number" == typeof a2.maxAge && `Max-Age=${a2.maxAge}`, "domain" in a2 && a2.domain && `Domain=${a2.domain}`, "secure" in a2 && a2.secure && "Secure", "httpOnly" in a2 && a2.httpOnly && "HttpOnly", "sameSite" in a2 && a2.sameSite && `SameSite=${a2.sameSite}`, "partitioned" in a2 && a2.partitioned && "Partitioned", "priority" in a2 && a2.priority && `Priority=${a2.priority}`].filter(Boolean), d2 = `${a2.name}=${encodeURIComponent(null != (b2 = a2.value) ? b2 : "")}`;
        return 0 === c2.length ? d2 : `${d2}; ${c2.join("; ")}`;
      }
      function j(a2) {
        let b2 = /* @__PURE__ */ new Map();
        for (let c2 of a2.split(/; */)) {
          if (!c2) continue;
          let a3 = c2.indexOf("=");
          if (-1 === a3) {
            b2.set(c2, "true");
            continue;
          }
          let [d2, e2] = [c2.slice(0, a3), c2.slice(a3 + 1)];
          try {
            b2.set(d2, decodeURIComponent(null != e2 ? e2 : "true"));
          } catch {
          }
        }
        return b2;
      }
      function k(a2) {
        if (!a2) return;
        let [[b2, c2], ...d2] = j(a2), { domain: e2, expires: f2, httponly: g2, maxage: h2, path: i2, samesite: k2, secure: n2, partitioned: o2, priority: p } = Object.fromEntries(d2.map(([a3, b3]) => [a3.toLowerCase().replace(/-/g, ""), b3]));
        {
          var q, r, s = { name: b2, value: decodeURIComponent(c2), domain: e2, ...f2 && { expires: new Date(f2) }, ...g2 && { httpOnly: true }, ..."string" == typeof h2 && { maxAge: Number(h2) }, path: i2, ...k2 && { sameSite: l.includes(q = (q = k2).toLowerCase()) ? q : void 0 }, ...n2 && { secure: true }, ...p && { priority: m.includes(r = (r = p).toLowerCase()) ? r : void 0 }, ...o2 && { partitioned: true } };
          let a3 = {};
          for (let b3 in s) s[b3] && (a3[b3] = s[b3]);
          return a3;
        }
      }
      a.exports = ((a2, f2, g2, h2) => {
        if (f2 && "object" == typeof f2 || "function" == typeof f2) for (let i2 of d(f2)) e.call(a2, i2) || i2 === g2 || b(a2, i2, { get: () => f2[i2], enumerable: !(h2 = c(f2, i2)) || h2.enumerable });
        return a2;
      })(b({}, "__esModule", { value: true }), f);
      var l = ["strict", "lax", "none"], m = ["low", "medium", "high"], n = class {
        constructor(a2) {
          this._parsed = /* @__PURE__ */ new Map(), this._headers = a2;
          const b2 = a2.get("cookie");
          if (b2) for (const [a3, c2] of j(b2)) this._parsed.set(a3, { name: a3, value: c2 });
        }
        [Symbol.iterator]() {
          return this._parsed[Symbol.iterator]();
        }
        get size() {
          return this._parsed.size;
        }
        get(...a2) {
          let b2 = "string" == typeof a2[0] ? a2[0] : a2[0].name;
          return this._parsed.get(b2);
        }
        getAll(...a2) {
          var b2;
          let c2 = Array.from(this._parsed);
          if (!a2.length) return c2.map(([a3, b3]) => b3);
          let d2 = "string" == typeof a2[0] ? a2[0] : null == (b2 = a2[0]) ? void 0 : b2.name;
          return c2.filter(([a3]) => a3 === d2).map(([a3, b3]) => b3);
        }
        has(a2) {
          return this._parsed.has(a2);
        }
        set(...a2) {
          let [b2, c2] = 1 === a2.length ? [a2[0].name, a2[0].value] : a2, d2 = this._parsed;
          return d2.set(b2, { name: b2, value: c2 }), this._headers.set("cookie", Array.from(d2).map(([a3, b3]) => i(b3)).join("; ")), this;
        }
        delete(a2) {
          let b2 = this._parsed, c2 = Array.isArray(a2) ? a2.map((a3) => b2.delete(a3)) : b2.delete(a2);
          return this._headers.set("cookie", Array.from(b2).map(([a3, b3]) => i(b3)).join("; ")), c2;
        }
        clear() {
          return this.delete(Array.from(this._parsed.keys())), this;
        }
        [Symbol.for("edge-runtime.inspect.custom")]() {
          return `RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`;
        }
        toString() {
          return [...this._parsed.values()].map((a2) => `${a2.name}=${encodeURIComponent(a2.value)}`).join("; ");
        }
      }, o = class {
        constructor(a2) {
          var b2, c2, d2;
          this._parsed = /* @__PURE__ */ new Map(), this._headers = a2;
          const e2 = null != (d2 = null != (c2 = null == (b2 = a2.getSetCookie) ? void 0 : b2.call(a2)) ? c2 : a2.get("set-cookie")) ? d2 : [];
          for (const a3 of Array.isArray(e2) ? e2 : function(a4) {
            if (!a4) return [];
            var b3, c3, d3, e3, f2, g2 = [], h2 = 0;
            function i2() {
              for (; h2 < a4.length && /\s/.test(a4.charAt(h2)); ) h2 += 1;
              return h2 < a4.length;
            }
            for (; h2 < a4.length; ) {
              for (b3 = h2, f2 = false; i2(); ) if ("," === (c3 = a4.charAt(h2))) {
                for (d3 = h2, h2 += 1, i2(), e3 = h2; h2 < a4.length && "=" !== (c3 = a4.charAt(h2)) && ";" !== c3 && "," !== c3; ) h2 += 1;
                h2 < a4.length && "=" === a4.charAt(h2) ? (f2 = true, h2 = e3, g2.push(a4.substring(b3, d3)), b3 = h2) : h2 = d3 + 1;
              } else h2 += 1;
              (!f2 || h2 >= a4.length) && g2.push(a4.substring(b3, a4.length));
            }
            return g2;
          }(e2)) {
            const b3 = k(a3);
            b3 && this._parsed.set(b3.name, b3);
          }
        }
        get(...a2) {
          let b2 = "string" == typeof a2[0] ? a2[0] : a2[0].name;
          return this._parsed.get(b2);
        }
        getAll(...a2) {
          var b2;
          let c2 = Array.from(this._parsed.values());
          if (!a2.length) return c2;
          let d2 = "string" == typeof a2[0] ? a2[0] : null == (b2 = a2[0]) ? void 0 : b2.name;
          return c2.filter((a3) => a3.name === d2);
        }
        has(a2) {
          return this._parsed.has(a2);
        }
        set(...a2) {
          let [b2, c2, d2] = 1 === a2.length ? [a2[0].name, a2[0].value, a2[0]] : a2, e2 = this._parsed;
          return e2.set(b2, function(a3 = { name: "", value: "" }) {
            return "number" == typeof a3.expires && (a3.expires = new Date(a3.expires)), a3.maxAge && (a3.expires = new Date(Date.now() + 1e3 * a3.maxAge)), (null === a3.path || void 0 === a3.path) && (a3.path = "/"), a3;
          }({ name: b2, value: c2, ...d2 })), function(a3, b3) {
            for (let [, c3] of (b3.delete("set-cookie"), a3)) {
              let a4 = i(c3);
              b3.append("set-cookie", a4);
            }
          }(e2, this._headers), this;
        }
        delete(...a2) {
          let [b2, c2] = "string" == typeof a2[0] ? [a2[0]] : [a2[0].name, a2[0]];
          return this.set({ ...c2, name: b2, value: "", expires: /* @__PURE__ */ new Date(0) });
        }
        [Symbol.for("edge-runtime.inspect.custom")]() {
          return `ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`;
        }
        toString() {
          return [...this._parsed.values()].map(i).join("; ");
        }
      };
    }, 987: (a, b, c) => {
      "use strict";
      Object.defineProperty(b, "__esModule", { value: true });
      var d = { interceptTestApis: function() {
        return h;
      }, wrapRequestHandler: function() {
        return i;
      } };
      for (var e in d) Object.defineProperty(b, e, { enumerable: true, get: d[e] });
      let f = c(643), g = c(318);
      function h() {
        return (0, g.interceptFetch)(c.g.fetch);
      }
      function i(a2) {
        return (b2, c2) => (0, f.withRequest)(b2, g.reader, () => a2(b2, c2));
      }
    }, 990: (a, b, c) => {
      var d, e = { 226: function(e2, f2) {
        !function(g2) {
          "use strict";
          var h = "function", i = "undefined", j = "object", k = "string", l = "major", m = "model", n = "name", o = "type", p = "vendor", q = "version", r = "architecture", s = "console", t = "mobile", u = "tablet", v = "smarttv", w = "wearable", x = "embedded", y = "Amazon", z = "Apple", A = "ASUS", B = "BlackBerry", C = "Browser", D = "Chrome", E = "Firefox", F = "Google", G = "Huawei", H = "Microsoft", I = "Motorola", J = "Opera", K = "Samsung", L = "Sharp", M = "Sony", N = "Xiaomi", O = "Zebra", P = "Facebook", Q = "Chromium OS", R = "Mac OS", S = function(a2, b2) {
            var c2 = {};
            for (var d2 in a2) b2[d2] && b2[d2].length % 2 == 0 ? c2[d2] = b2[d2].concat(a2[d2]) : c2[d2] = a2[d2];
            return c2;
          }, T = function(a2) {
            for (var b2 = {}, c2 = 0; c2 < a2.length; c2++) b2[a2[c2].toUpperCase()] = a2[c2];
            return b2;
          }, U = function(a2, b2) {
            return typeof a2 === k && -1 !== V(b2).indexOf(V(a2));
          }, V = function(a2) {
            return a2.toLowerCase();
          }, W = function(a2, b2) {
            if (typeof a2 === k) return a2 = a2.replace(/^\s\s*/, ""), typeof b2 === i ? a2 : a2.substring(0, 350);
          }, X = function(a2, b2) {
            for (var c2, d2, e3, f3, g3, i2, k2 = 0; k2 < b2.length && !g3; ) {
              var l2 = b2[k2], m2 = b2[k2 + 1];
              for (c2 = d2 = 0; c2 < l2.length && !g3 && l2[c2]; ) if (g3 = l2[c2++].exec(a2)) for (e3 = 0; e3 < m2.length; e3++) i2 = g3[++d2], typeof (f3 = m2[e3]) === j && f3.length > 0 ? 2 === f3.length ? typeof f3[1] == h ? this[f3[0]] = f3[1].call(this, i2) : this[f3[0]] = f3[1] : 3 === f3.length ? typeof f3[1] !== h || f3[1].exec && f3[1].test ? this[f3[0]] = i2 ? i2.replace(f3[1], f3[2]) : void 0 : this[f3[0]] = i2 ? f3[1].call(this, i2, f3[2]) : void 0 : 4 === f3.length && (this[f3[0]] = i2 ? f3[3].call(this, i2.replace(f3[1], f3[2])) : void 0) : this[f3] = i2 || void 0;
              k2 += 2;
            }
          }, Y = function(a2, b2) {
            for (var c2 in b2) if (typeof b2[c2] === j && b2[c2].length > 0) {
              for (var d2 = 0; d2 < b2[c2].length; d2++) if (U(b2[c2][d2], a2)) return "?" === c2 ? void 0 : c2;
            } else if (U(b2[c2], a2)) return "?" === c2 ? void 0 : c2;
            return a2;
          }, Z = { ME: "4.90", "NT 3.11": "NT3.51", "NT 4.0": "NT4.0", 2e3: "NT 5.0", XP: ["NT 5.1", "NT 5.2"], Vista: "NT 6.0", 7: "NT 6.1", 8: "NT 6.2", 8.1: "NT 6.3", 10: ["NT 6.4", "NT 10.0"], RT: "ARM" }, $ = { browser: [[/\b(?:crmo|crios)\/([\w\.]+)/i], [q, [n, "Chrome"]], [/edg(?:e|ios|a)?\/([\w\.]+)/i], [q, [n, "Edge"]], [/(opera mini)\/([-\w\.]+)/i, /(opera [mobiletab]{3,6})\b.+version\/([-\w\.]+)/i, /(opera)(?:.+version\/|[\/ ]+)([\w\.]+)/i], [n, q], [/opios[\/ ]+([\w\.]+)/i], [q, [n, J + " Mini"]], [/\bopr\/([\w\.]+)/i], [q, [n, J]], [/(kindle)\/([\w\.]+)/i, /(lunascape|maxthon|netfront|jasmine|blazer)[\/ ]?([\w\.]*)/i, /(avant |iemobile|slim)(?:browser)?[\/ ]?([\w\.]*)/i, /(ba?idubrowser)[\/ ]?([\w\.]+)/i, /(?:ms|\()(ie) ([\w\.]+)/i, /(flock|rockmelt|midori|epiphany|silk|skyfire|bolt|iron|vivaldi|iridium|phantomjs|bowser|quark|qupzilla|falkon|rekonq|puffin|brave|whale(?!.+naver)|qqbrowserlite|qq|duckduckgo)\/([-\w\.]+)/i, /(heytap|ovi)browser\/([\d\.]+)/i, /(weibo)__([\d\.]+)/i], [n, q], [/(?:\buc? ?browser|(?:juc.+)ucweb)[\/ ]?([\w\.]+)/i], [q, [n, "UC" + C]], [/microm.+\bqbcore\/([\w\.]+)/i, /\bqbcore\/([\w\.]+).+microm/i], [q, [n, "WeChat(Win) Desktop"]], [/micromessenger\/([\w\.]+)/i], [q, [n, "WeChat"]], [/konqueror\/([\w\.]+)/i], [q, [n, "Konqueror"]], [/trident.+rv[: ]([\w\.]{1,9})\b.+like gecko/i], [q, [n, "IE"]], [/ya(?:search)?browser\/([\w\.]+)/i], [q, [n, "Yandex"]], [/(avast|avg)\/([\w\.]+)/i], [[n, /(.+)/, "$1 Secure " + C], q], [/\bfocus\/([\w\.]+)/i], [q, [n, E + " Focus"]], [/\bopt\/([\w\.]+)/i], [q, [n, J + " Touch"]], [/coc_coc\w+\/([\w\.]+)/i], [q, [n, "Coc Coc"]], [/dolfin\/([\w\.]+)/i], [q, [n, "Dolphin"]], [/coast\/([\w\.]+)/i], [q, [n, J + " Coast"]], [/miuibrowser\/([\w\.]+)/i], [q, [n, "MIUI " + C]], [/fxios\/([-\w\.]+)/i], [q, [n, E]], [/\bqihu|(qi?ho?o?|360)browser/i], [[n, "360 " + C]], [/(oculus|samsung|sailfish|huawei)browser\/([\w\.]+)/i], [[n, /(.+)/, "$1 " + C], q], [/(comodo_dragon)\/([\w\.]+)/i], [[n, /_/g, " "], q], [/(electron)\/([\w\.]+) safari/i, /(tesla)(?: qtcarbrowser|\/(20\d\d\.[-\w\.]+))/i, /m?(qqbrowser|baiduboxapp|2345Explorer)[\/ ]?([\w\.]+)/i], [n, q], [/(metasr)[\/ ]?([\w\.]+)/i, /(lbbrowser)/i, /\[(linkedin)app\]/i], [n], [/((?:fban\/fbios|fb_iab\/fb4a)(?!.+fbav)|;fbav\/([\w\.]+);)/i], [[n, P], q], [/(kakao(?:talk|story))[\/ ]([\w\.]+)/i, /(naver)\(.*?(\d+\.[\w\.]+).*\)/i, /safari (line)\/([\w\.]+)/i, /\b(line)\/([\w\.]+)\/iab/i, /(chromium|instagram)[\/ ]([-\w\.]+)/i], [n, q], [/\bgsa\/([\w\.]+) .*safari\//i], [q, [n, "GSA"]], [/musical_ly(?:.+app_?version\/|_)([\w\.]+)/i], [q, [n, "TikTok"]], [/headlesschrome(?:\/([\w\.]+)| )/i], [q, [n, D + " Headless"]], [/ wv\).+(chrome)\/([\w\.]+)/i], [[n, D + " WebView"], q], [/droid.+ version\/([\w\.]+)\b.+(?:mobile safari|safari)/i], [q, [n, "Android " + C]], [/(chrome|omniweb|arora|[tizenoka]{5} ?browser)\/v?([\w\.]+)/i], [n, q], [/version\/([\w\.\,]+) .*mobile\/\w+ (safari)/i], [q, [n, "Mobile Safari"]], [/version\/([\w(\.|\,)]+) .*(mobile ?safari|safari)/i], [q, n], [/webkit.+?(mobile ?safari|safari)(\/[\w\.]+)/i], [n, [q, Y, { "1.0": "/8", 1.2: "/1", 1.3: "/3", "2.0": "/412", "2.0.2": "/416", "2.0.3": "/417", "2.0.4": "/419", "?": "/" }]], [/(webkit|khtml)\/([\w\.]+)/i], [n, q], [/(navigator|netscape\d?)\/([-\w\.]+)/i], [[n, "Netscape"], q], [/mobile vr; rv:([\w\.]+)\).+firefox/i], [q, [n, E + " Reality"]], [/ekiohf.+(flow)\/([\w\.]+)/i, /(swiftfox)/i, /(icedragon|iceweasel|camino|chimera|fennec|maemo browser|minimo|conkeror|klar)[\/ ]?([\w\.\+]+)/i, /(seamonkey|k-meleon|icecat|iceape|firebird|phoenix|palemoon|basilisk|waterfox)\/([-\w\.]+)$/i, /(firefox)\/([\w\.]+)/i, /(mozilla)\/([\w\.]+) .+rv\:.+gecko\/\d+/i, /(polaris|lynx|dillo|icab|doris|amaya|w3m|netsurf|sleipnir|obigo|mosaic|(?:go|ice|up)[\. ]?browser)[-\/ ]?v?([\w\.]+)/i, /(links) \(([\w\.]+)/i, /panasonic;(viera)/i], [n, q], [/(cobalt)\/([\w\.]+)/i], [n, [q, /master.|lts./, ""]]], cpu: [[/(?:(amd|x(?:(?:86|64)[-_])?|wow|win)64)[;\)]/i], [[r, "amd64"]], [/(ia32(?=;))/i], [[r, V]], [/((?:i[346]|x)86)[;\)]/i], [[r, "ia32"]], [/\b(aarch64|arm(v?8e?l?|_?64))\b/i], [[r, "arm64"]], [/\b(arm(?:v[67])?ht?n?[fl]p?)\b/i], [[r, "armhf"]], [/windows (ce|mobile); ppc;/i], [[r, "arm"]], [/((?:ppc|powerpc)(?:64)?)(?: mac|;|\))/i], [[r, /ower/, "", V]], [/(sun4\w)[;\)]/i], [[r, "sparc"]], [/((?:avr32|ia64(?=;))|68k(?=\))|\barm(?=v(?:[1-7]|[5-7]1)l?|;|eabi)|(?=atmel )avr|(?:irix|mips|sparc)(?:64)?\b|pa-risc)/i], [[r, V]]], device: [[/\b(sch-i[89]0\d|shw-m380s|sm-[ptx]\w{2,4}|gt-[pn]\d{2,4}|sgh-t8[56]9|nexus 10)/i], [m, [p, K], [o, u]], [/\b((?:s[cgp]h|gt|sm)-\w+|sc[g-]?[\d]+a?|galaxy nexus)/i, /samsung[- ]([-\w]+)/i, /sec-(sgh\w+)/i], [m, [p, K], [o, t]], [/(?:\/|\()(ip(?:hone|od)[\w, ]*)(?:\/|;)/i], [m, [p, z], [o, t]], [/\((ipad);[-\w\),; ]+apple/i, /applecoremedia\/[\w\.]+ \((ipad)/i, /\b(ipad)\d\d?,\d\d?[;\]].+ios/i], [m, [p, z], [o, u]], [/(macintosh);/i], [m, [p, z]], [/\b(sh-?[altvz]?\d\d[a-ekm]?)/i], [m, [p, L], [o, t]], [/\b((?:ag[rs][23]?|bah2?|sht?|btv)-a?[lw]\d{2})\b(?!.+d\/s)/i], [m, [p, G], [o, u]], [/(?:huawei|honor)([-\w ]+)[;\)]/i, /\b(nexus 6p|\w{2,4}e?-[atu]?[ln][\dx][012359c][adn]?)\b(?!.+d\/s)/i], [m, [p, G], [o, t]], [/\b(poco[\w ]+)(?: bui|\))/i, /\b; (\w+) build\/hm\1/i, /\b(hm[-_ ]?note?[_ ]?(?:\d\w)?) bui/i, /\b(redmi[\-_ ]?(?:note|k)?[\w_ ]+)(?: bui|\))/i, /\b(mi[-_ ]?(?:a\d|one|one[_ ]plus|note lte|max|cc)?[_ ]?(?:\d?\w?)[_ ]?(?:plus|se|lite)?)(?: bui|\))/i], [[m, /_/g, " "], [p, N], [o, t]], [/\b(mi[-_ ]?(?:pad)(?:[\w_ ]+))(?: bui|\))/i], [[m, /_/g, " "], [p, N], [o, u]], [/; (\w+) bui.+ oppo/i, /\b(cph[12]\d{3}|p(?:af|c[al]|d\w|e[ar])[mt]\d0|x9007|a101op)\b/i], [m, [p, "OPPO"], [o, t]], [/vivo (\w+)(?: bui|\))/i, /\b(v[12]\d{3}\w?[at])(?: bui|;)/i], [m, [p, "Vivo"], [o, t]], [/\b(rmx[12]\d{3})(?: bui|;|\))/i], [m, [p, "Realme"], [o, t]], [/\b(milestone|droid(?:[2-4x]| (?:bionic|x2|pro|razr))?:?( 4g)?)\b[\w ]+build\//i, /\bmot(?:orola)?[- ](\w*)/i, /((?:moto[\w\(\) ]+|xt\d{3,4}|nexus 6)(?= bui|\)))/i], [m, [p, I], [o, t]], [/\b(mz60\d|xoom[2 ]{0,2}) build\//i], [m, [p, I], [o, u]], [/((?=lg)?[vl]k\-?\d{3}) bui| 3\.[-\w; ]{10}lg?-([06cv9]{3,4})/i], [m, [p, "LG"], [o, u]], [/(lm(?:-?f100[nv]?|-[\w\.]+)(?= bui|\))|nexus [45])/i, /\blg[-e;\/ ]+((?!browser|netcast|android tv)\w+)/i, /\blg-?([\d\w]+) bui/i], [m, [p, "LG"], [o, t]], [/(ideatab[-\w ]+)/i, /lenovo ?(s[56]000[-\w]+|tab(?:[\w ]+)|yt[-\d\w]{6}|tb[-\d\w]{6})/i], [m, [p, "Lenovo"], [o, u]], [/(?:maemo|nokia).*(n900|lumia \d+)/i, /nokia[-_ ]?([-\w\.]*)/i], [[m, /_/g, " "], [p, "Nokia"], [o, t]], [/(pixel c)\b/i], [m, [p, F], [o, u]], [/droid.+; (pixel[\daxl ]{0,6})(?: bui|\))/i], [m, [p, F], [o, t]], [/droid.+ (a?\d[0-2]{2}so|[c-g]\d{4}|so[-gl]\w+|xq-a\w[4-7][12])(?= bui|\).+chrome\/(?![1-6]{0,1}\d\.))/i], [m, [p, M], [o, t]], [/sony tablet [ps]/i, /\b(?:sony)?sgp\w+(?: bui|\))/i], [[m, "Xperia Tablet"], [p, M], [o, u]], [/ (kb2005|in20[12]5|be20[12][59])\b/i, /(?:one)?(?:plus)? (a\d0\d\d)(?: b|\))/i], [m, [p, "OnePlus"], [o, t]], [/(alexa)webm/i, /(kf[a-z]{2}wi|aeo[c-r]{2})( bui|\))/i, /(kf[a-z]+)( bui|\)).+silk\//i], [m, [p, y], [o, u]], [/((?:sd|kf)[0349hijorstuw]+)( bui|\)).+silk\//i], [[m, /(.+)/g, "Fire Phone $1"], [p, y], [o, t]], [/(playbook);[-\w\),; ]+(rim)/i], [m, p, [o, u]], [/\b((?:bb[a-f]|st[hv])100-\d)/i, /\(bb10; (\w+)/i], [m, [p, B], [o, t]], [/(?:\b|asus_)(transfo[prime ]{4,10} \w+|eeepc|slider \w+|nexus 7|padfone|p00[cj])/i], [m, [p, A], [o, u]], [/ (z[bes]6[027][012][km][ls]|zenfone \d\w?)\b/i], [m, [p, A], [o, t]], [/(nexus 9)/i], [m, [p, "HTC"], [o, u]], [/(htc)[-;_ ]{1,2}([\w ]+(?=\)| bui)|\w+)/i, /(zte)[- ]([\w ]+?)(?: bui|\/|\))/i, /(alcatel|geeksphone|nexian|panasonic(?!(?:;|\.))|sony(?!-bra))[-_ ]?([-\w]*)/i], [p, [m, /_/g, " "], [o, t]], [/droid.+; ([ab][1-7]-?[0178a]\d\d?)/i], [m, [p, "Acer"], [o, u]], [/droid.+; (m[1-5] note) bui/i, /\bmz-([-\w]{2,})/i], [m, [p, "Meizu"], [o, t]], [/(blackberry|benq|palm(?=\-)|sonyericsson|acer|asus|dell|meizu|motorola|polytron)[-_ ]?([-\w]*)/i, /(hp) ([\w ]+\w)/i, /(asus)-?(\w+)/i, /(microsoft); (lumia[\w ]+)/i, /(lenovo)[-_ ]?([-\w]+)/i, /(jolla)/i, /(oppo) ?([\w ]+) bui/i], [p, m, [o, t]], [/(kobo)\s(ereader|touch)/i, /(archos) (gamepad2?)/i, /(hp).+(touchpad(?!.+tablet)|tablet)/i, /(kindle)\/([\w\.]+)/i, /(nook)[\w ]+build\/(\w+)/i, /(dell) (strea[kpr\d ]*[\dko])/i, /(le[- ]+pan)[- ]+(\w{1,9}) bui/i, /(trinity)[- ]*(t\d{3}) bui/i, /(gigaset)[- ]+(q\w{1,9}) bui/i, /(vodafone) ([\w ]+)(?:\)| bui)/i], [p, m, [o, u]], [/(surface duo)/i], [m, [p, H], [o, u]], [/droid [\d\.]+; (fp\du?)(?: b|\))/i], [m, [p, "Fairphone"], [o, t]], [/(u304aa)/i], [m, [p, "AT&T"], [o, t]], [/\bsie-(\w*)/i], [m, [p, "Siemens"], [o, t]], [/\b(rct\w+) b/i], [m, [p, "RCA"], [o, u]], [/\b(venue[\d ]{2,7}) b/i], [m, [p, "Dell"], [o, u]], [/\b(q(?:mv|ta)\w+) b/i], [m, [p, "Verizon"], [o, u]], [/\b(?:barnes[& ]+noble |bn[rt])([\w\+ ]*) b/i], [m, [p, "Barnes & Noble"], [o, u]], [/\b(tm\d{3}\w+) b/i], [m, [p, "NuVision"], [o, u]], [/\b(k88) b/i], [m, [p, "ZTE"], [o, u]], [/\b(nx\d{3}j) b/i], [m, [p, "ZTE"], [o, t]], [/\b(gen\d{3}) b.+49h/i], [m, [p, "Swiss"], [o, t]], [/\b(zur\d{3}) b/i], [m, [p, "Swiss"], [o, u]], [/\b((zeki)?tb.*\b) b/i], [m, [p, "Zeki"], [o, u]], [/\b([yr]\d{2}) b/i, /\b(dragon[- ]+touch |dt)(\w{5}) b/i], [[p, "Dragon Touch"], m, [o, u]], [/\b(ns-?\w{0,9}) b/i], [m, [p, "Insignia"], [o, u]], [/\b((nxa|next)-?\w{0,9}) b/i], [m, [p, "NextBook"], [o, u]], [/\b(xtreme\_)?(v(1[045]|2[015]|[3469]0|7[05])) b/i], [[p, "Voice"], m, [o, t]], [/\b(lvtel\-)?(v1[12]) b/i], [[p, "LvTel"], m, [o, t]], [/\b(ph-1) /i], [m, [p, "Essential"], [o, t]], [/\b(v(100md|700na|7011|917g).*\b) b/i], [m, [p, "Envizen"], [o, u]], [/\b(trio[-\w\. ]+) b/i], [m, [p, "MachSpeed"], [o, u]], [/\btu_(1491) b/i], [m, [p, "Rotor"], [o, u]], [/(shield[\w ]+) b/i], [m, [p, "Nvidia"], [o, u]], [/(sprint) (\w+)/i], [p, m, [o, t]], [/(kin\.[onetw]{3})/i], [[m, /\./g, " "], [p, H], [o, t]], [/droid.+; (cc6666?|et5[16]|mc[239][23]x?|vc8[03]x?)\)/i], [m, [p, O], [o, u]], [/droid.+; (ec30|ps20|tc[2-8]\d[kx])\)/i], [m, [p, O], [o, t]], [/smart-tv.+(samsung)/i], [p, [o, v]], [/hbbtv.+maple;(\d+)/i], [[m, /^/, "SmartTV"], [p, K], [o, v]], [/(nux; netcast.+smarttv|lg (netcast\.tv-201\d|android tv))/i], [[p, "LG"], [o, v]], [/(apple) ?tv/i], [p, [m, z + " TV"], [o, v]], [/crkey/i], [[m, D + "cast"], [p, F], [o, v]], [/droid.+aft(\w)( bui|\))/i], [m, [p, y], [o, v]], [/\(dtv[\);].+(aquos)/i, /(aquos-tv[\w ]+)\)/i], [m, [p, L], [o, v]], [/(bravia[\w ]+)( bui|\))/i], [m, [p, M], [o, v]], [/(mitv-\w{5}) bui/i], [m, [p, N], [o, v]], [/Hbbtv.*(technisat) (.*);/i], [p, m, [o, v]], [/\b(roku)[\dx]*[\)\/]((?:dvp-)?[\d\.]*)/i, /hbbtv\/\d+\.\d+\.\d+ +\([\w\+ ]*; *([\w\d][^;]*);([^;]*)/i], [[p, W], [m, W], [o, v]], [/\b(android tv|smart[- ]?tv|opera tv|tv; rv:)\b/i], [[o, v]], [/(ouya)/i, /(nintendo) ([wids3utch]+)/i], [p, m, [o, s]], [/droid.+; (shield) bui/i], [m, [p, "Nvidia"], [o, s]], [/(playstation [345portablevi]+)/i], [m, [p, M], [o, s]], [/\b(xbox(?: one)?(?!; xbox))[\); ]/i], [m, [p, H], [o, s]], [/((pebble))app/i], [p, m, [o, w]], [/(watch)(?: ?os[,\/]|\d,\d\/)[\d\.]+/i], [m, [p, z], [o, w]], [/droid.+; (glass) \d/i], [m, [p, F], [o, w]], [/droid.+; (wt63?0{2,3})\)/i], [m, [p, O], [o, w]], [/(quest( 2| pro)?)/i], [m, [p, P], [o, w]], [/(tesla)(?: qtcarbrowser|\/[-\w\.]+)/i], [p, [o, x]], [/(aeobc)\b/i], [m, [p, y], [o, x]], [/droid .+?; ([^;]+?)(?: bui|\) applew).+? mobile safari/i], [m, [o, t]], [/droid .+?; ([^;]+?)(?: bui|\) applew).+?(?! mobile) safari/i], [m, [o, u]], [/\b((tablet|tab)[;\/]|focus\/\d(?!.+mobile))/i], [[o, u]], [/(phone|mobile(?:[;\/]| [ \w\/\.]*safari)|pda(?=.+windows ce))/i], [[o, t]], [/(android[-\w\. ]{0,9});.+buil/i], [m, [p, "Generic"]]], engine: [[/windows.+ edge\/([\w\.]+)/i], [q, [n, "EdgeHTML"]], [/webkit\/537\.36.+chrome\/(?!27)([\w\.]+)/i], [q, [n, "Blink"]], [/(presto)\/([\w\.]+)/i, /(webkit|trident|netfront|netsurf|amaya|lynx|w3m|goanna)\/([\w\.]+)/i, /ekioh(flow)\/([\w\.]+)/i, /(khtml|tasman|links)[\/ ]\(?([\w\.]+)/i, /(icab)[\/ ]([23]\.[\d\.]+)/i, /\b(libweb)/i], [n, q], [/rv\:([\w\.]{1,9})\b.+(gecko)/i], [q, n]], os: [[/microsoft (windows) (vista|xp)/i], [n, q], [/(windows) nt 6\.2; (arm)/i, /(windows (?:phone(?: os)?|mobile))[\/ ]?([\d\.\w ]*)/i, /(windows)[\/ ]?([ntce\d\. ]+\w)(?!.+xbox)/i], [n, [q, Y, Z]], [/(win(?=3|9|n)|win 9x )([nt\d\.]+)/i], [[n, "Windows"], [q, Y, Z]], [/ip[honead]{2,4}\b(?:.*os ([\w]+) like mac|; opera)/i, /ios;fbsv\/([\d\.]+)/i, /cfnetwork\/.+darwin/i], [[q, /_/g, "."], [n, "iOS"]], [/(mac os x) ?([\w\. ]*)/i, /(macintosh|mac_powerpc\b)(?!.+haiku)/i], [[n, R], [q, /_/g, "."]], [/droid ([\w\.]+)\b.+(android[- ]x86|harmonyos)/i], [q, n], [/(android|webos|qnx|bada|rim tablet os|maemo|meego|sailfish)[-\/ ]?([\w\.]*)/i, /(blackberry)\w*\/([\w\.]*)/i, /(tizen|kaios)[\/ ]([\w\.]+)/i, /\((series40);/i], [n, q], [/\(bb(10);/i], [q, [n, B]], [/(?:symbian ?os|symbos|s60(?=;)|series60)[-\/ ]?([\w\.]*)/i], [q, [n, "Symbian"]], [/mozilla\/[\d\.]+ \((?:mobile|tablet|tv|mobile; [\w ]+); rv:.+ gecko\/([\w\.]+)/i], [q, [n, E + " OS"]], [/web0s;.+rt(tv)/i, /\b(?:hp)?wos(?:browser)?\/([\w\.]+)/i], [q, [n, "webOS"]], [/watch(?: ?os[,\/]|\d,\d\/)([\d\.]+)/i], [q, [n, "watchOS"]], [/crkey\/([\d\.]+)/i], [q, [n, D + "cast"]], [/(cros) [\w]+(?:\)| ([\w\.]+)\b)/i], [[n, Q], q], [/panasonic;(viera)/i, /(netrange)mmh/i, /(nettv)\/(\d+\.[\w\.]+)/i, /(nintendo|playstation) ([wids345portablevuch]+)/i, /(xbox); +xbox ([^\);]+)/i, /\b(joli|palm)\b ?(?:os)?\/?([\w\.]*)/i, /(mint)[\/\(\) ]?(\w*)/i, /(mageia|vectorlinux)[; ]/i, /([kxln]?ubuntu|debian|suse|opensuse|gentoo|arch(?= linux)|slackware|fedora|mandriva|centos|pclinuxos|red ?hat|zenwalk|linpus|raspbian|plan 9|minix|risc os|contiki|deepin|manjaro|elementary os|sabayon|linspire)(?: gnu\/linux)?(?: enterprise)?(?:[- ]linux)?(?:-gnu)?[-\/ ]?(?!chrom|package)([-\w\.]*)/i, /(hurd|linux) ?([\w\.]*)/i, /(gnu) ?([\w\.]*)/i, /\b([-frentopcghs]{0,5}bsd|dragonfly)[\/ ]?(?!amd|[ix346]{1,2}86)([\w\.]*)/i, /(haiku) (\w+)/i], [n, q], [/(sunos) ?([\w\.\d]*)/i], [[n, "Solaris"], q], [/((?:open)?solaris)[-\/ ]?([\w\.]*)/i, /(aix) ((\d)(?=\.|\)| )[\w\.])*/i, /\b(beos|os\/2|amigaos|morphos|openvms|fuchsia|hp-ux|serenityos)/i, /(unix) ?([\w\.]*)/i], [n, q]] }, _ = function(a2, b2) {
            if (typeof a2 === j && (b2 = a2, a2 = void 0), !(this instanceof _)) return new _(a2, b2).getResult();
            var c2 = typeof g2 !== i && g2.navigator ? g2.navigator : void 0, d2 = a2 || (c2 && c2.userAgent ? c2.userAgent : ""), e3 = c2 && c2.userAgentData ? c2.userAgentData : void 0, f3 = b2 ? S($, b2) : $, s2 = c2 && c2.userAgent == d2;
            return this.getBrowser = function() {
              var a3, b3 = {};
              return b3[n] = void 0, b3[q] = void 0, X.call(b3, d2, f3.browser), b3[l] = typeof (a3 = b3[q]) === k ? a3.replace(/[^\d\.]/g, "").split(".")[0] : void 0, s2 && c2 && c2.brave && typeof c2.brave.isBrave == h && (b3[n] = "Brave"), b3;
            }, this.getCPU = function() {
              var a3 = {};
              return a3[r] = void 0, X.call(a3, d2, f3.cpu), a3;
            }, this.getDevice = function() {
              var a3 = {};
              return a3[p] = void 0, a3[m] = void 0, a3[o] = void 0, X.call(a3, d2, f3.device), s2 && !a3[o] && e3 && e3.mobile && (a3[o] = t), s2 && "Macintosh" == a3[m] && c2 && typeof c2.standalone !== i && c2.maxTouchPoints && c2.maxTouchPoints > 2 && (a3[m] = "iPad", a3[o] = u), a3;
            }, this.getEngine = function() {
              var a3 = {};
              return a3[n] = void 0, a3[q] = void 0, X.call(a3, d2, f3.engine), a3;
            }, this.getOS = function() {
              var a3 = {};
              return a3[n] = void 0, a3[q] = void 0, X.call(a3, d2, f3.os), s2 && !a3[n] && e3 && "Unknown" != e3.platform && (a3[n] = e3.platform.replace(/chrome os/i, Q).replace(/macos/i, R)), a3;
            }, this.getResult = function() {
              return { ua: this.getUA(), browser: this.getBrowser(), engine: this.getEngine(), os: this.getOS(), device: this.getDevice(), cpu: this.getCPU() };
            }, this.getUA = function() {
              return d2;
            }, this.setUA = function(a3) {
              return d2 = typeof a3 === k && a3.length > 350 ? W(a3, 350) : a3, this;
            }, this.setUA(d2), this;
          };
          _.VERSION = "1.0.35", _.BROWSER = T([n, q, l]), _.CPU = T([r]), _.DEVICE = T([m, p, o, s, t, v, u, w, x]), _.ENGINE = _.OS = T([n, q]), typeof f2 !== i ? (e2.exports && (f2 = e2.exports = _), f2.UAParser = _) : c.amdO ? void 0 === (d = function() {
            return _;
          }.call(b, c, b, a)) || (a.exports = d) : typeof g2 !== i && (g2.UAParser = _);
          var aa = typeof g2 !== i && (g2.jQuery || g2.Zepto);
          if (aa && !aa.ua) {
            var ab = new _();
            aa.ua = ab.getResult(), aa.ua.get = function() {
              return ab.getUA();
            }, aa.ua.set = function(a2) {
              ab.setUA(a2);
              var b2 = ab.getResult();
              for (var c2 in b2) aa.ua[c2] = b2[c2];
            };
          }
        }("object" == typeof window ? window : this);
      } }, f = {};
      function g(a2) {
        var b2 = f[a2];
        if (void 0 !== b2) return b2.exports;
        var c2 = f[a2] = { exports: {} }, d2 = true;
        try {
          e[a2].call(c2.exports, c2, c2.exports, g), d2 = false;
        } finally {
          d2 && delete f[a2];
        }
        return c2.exports;
      }
      g.ab = "//", a.exports = g(226);
    } }, (a) => {
      var b = a(a.s = 691);
      (_ENTRIES = "u" < typeof _ENTRIES ? {} : _ENTRIES).middleware_middleware = b;
    }]);
  }
});

// node_modules/@opennextjs/aws/dist/core/edgeFunctionHandler.js
var edgeFunctionHandler_exports = {};
__export(edgeFunctionHandler_exports, {
  default: () => edgeFunctionHandler
});
async function edgeFunctionHandler(request) {
  const path3 = new URL(request.url).pathname;
  const routes = globalThis._ROUTES;
  const correspondingRoute = routes.find((route) => route.regex.some((r) => new RegExp(r).test(path3)));
  if (!correspondingRoute) {
    throw new Error(`No route found for ${request.url}`);
  }
  const entry = await self._ENTRIES[`middleware_${correspondingRoute.name}`];
  const result = await entry.default({
    page: correspondingRoute.page,
    request: {
      ...request,
      page: {
        name: correspondingRoute.name
      }
    }
  });
  globalThis.__openNextAls.getStore()?.pendingPromiseRunner.add(result.waitUntil);
  const response = result.response;
  return response;
}
var init_edgeFunctionHandler = __esm({
  "node_modules/@opennextjs/aws/dist/core/edgeFunctionHandler.js"() {
    globalThis._ENTRIES = {};
    globalThis.self = globalThis;
    globalThis._ROUTES = [{ "name": "middleware", "page": "/", "regex": ["^(?:\\/(_next\\/data\\/[^/]{1,}))?\\/api(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?(\\.json)?[\\/#\\?]?$", "^(?:\\/(_next\\/data\\/[^/]{1,}))?\\/admin(\\.json)?[\\/#\\?]?$", "^(?:\\/(_next\\/data\\/[^/]{1,}))?\\/admin(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?(\\.json)?[\\/#\\?]?$", "^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/((?!_next\\/static|_next\\/image|favicon.ico|icons|fonts|sw.js).*))(\\.json)?[\\/#\\?]?$"] }];
    require_edge_runtime_webpack();
    require_middleware();
  }
});

// node_modules/@opennextjs/aws/dist/utils/promise.js
init_logger();

// node_modules/@opennextjs/aws/dist/utils/requestCache.js
var RequestCache = class {
  _caches = /* @__PURE__ */ new Map();
  /**
   * Returns the Map registered under `key`.
   * If no Map exists yet for that key, a new empty Map is created, stored, and returned.
   * Repeated calls with the same key always return the **same** Map instance.
   */
  getOrCreate(key) {
    let cache = this._caches.get(key);
    if (!cache) {
      cache = /* @__PURE__ */ new Map();
      this._caches.set(key, cache);
    }
    return cache;
  }
};

// node_modules/@opennextjs/aws/dist/utils/promise.js
var DetachedPromise = class {
  resolve;
  reject;
  promise;
  constructor() {
    let resolve;
    let reject;
    this.promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.resolve = resolve;
    this.reject = reject;
  }
};
var DetachedPromiseRunner = class {
  promises = [];
  withResolvers() {
    const detachedPromise = new DetachedPromise();
    this.promises.push(detachedPromise);
    return detachedPromise;
  }
  add(promise) {
    const detachedPromise = new DetachedPromise();
    this.promises.push(detachedPromise);
    promise.then(detachedPromise.resolve, detachedPromise.reject);
  }
  async await() {
    debug(`Awaiting ${this.promises.length} detached promises`);
    const results = await Promise.allSettled(this.promises.map((p) => p.promise));
    const rejectedPromises = results.filter((r) => r.status === "rejected");
    rejectedPromises.forEach((r) => {
      error(r.reason);
    });
  }
};
async function awaitAllDetachedPromise() {
  const store = globalThis.__openNextAls.getStore();
  const promisesToAwait = store?.pendingPromiseRunner.await() ?? Promise.resolve();
  if (store?.waitUntil) {
    store.waitUntil(promisesToAwait);
    return;
  }
  await promisesToAwait;
}
function provideNextAfterProvider() {
  const NEXT_REQUEST_CONTEXT_SYMBOL = Symbol.for("@next/request-context");
  const VERCEL_REQUEST_CONTEXT_SYMBOL = Symbol.for("@vercel/request-context");
  const store = globalThis.__openNextAls.getStore();
  const waitUntil = store?.waitUntil ?? ((promise) => store?.pendingPromiseRunner.add(promise));
  const nextAfterContext = {
    get: () => ({
      waitUntil
    })
  };
  globalThis[NEXT_REQUEST_CONTEXT_SYMBOL] = nextAfterContext;
  if (process.env.EMULATE_VERCEL_REQUEST_CONTEXT) {
    globalThis[VERCEL_REQUEST_CONTEXT_SYMBOL] = nextAfterContext;
  }
}
function runWithOpenNextRequestContext({ isISRRevalidation, waitUntil, requestId = Math.random().toString(36) }, fn) {
  return globalThis.__openNextAls.run({
    requestId,
    pendingPromiseRunner: new DetachedPromiseRunner(),
    isISRRevalidation,
    waitUntil,
    writtenTags: /* @__PURE__ */ new Set(),
    requestCache: new RequestCache()
  }, async () => {
    provideNextAfterProvider();
    let result;
    try {
      result = await fn();
    } finally {
      await awaitAllDetachedPromise();
    }
    return result;
  });
}

// node_modules/@opennextjs/aws/dist/adapters/middleware.js
init_logger();

// node_modules/@opennextjs/aws/dist/core/createGenericHandler.js
init_logger();

// node_modules/@opennextjs/aws/dist/core/resolve.js
async function resolveConverter(converter2) {
  if (typeof converter2 === "function") {
    return converter2();
  }
  const m_1 = await Promise.resolve().then(() => (init_edge(), edge_exports));
  return m_1.default;
}
async function resolveWrapper(wrapper) {
  if (typeof wrapper === "function") {
    return wrapper();
  }
  const m_1 = await Promise.resolve().then(() => (init_cloudflare_edge(), cloudflare_edge_exports));
  return m_1.default;
}
async function resolveOriginResolver(originResolver) {
  if (typeof originResolver === "function") {
    return originResolver();
  }
  const m_1 = await Promise.resolve().then(() => (init_pattern_env(), pattern_env_exports));
  return m_1.default;
}
async function resolveAssetResolver(assetResolver) {
  if (typeof assetResolver === "function") {
    return assetResolver();
  }
  const m_1 = await Promise.resolve().then(() => (init_dummy(), dummy_exports));
  return m_1.default;
}
async function resolveProxyRequest(proxyRequest) {
  if (typeof proxyRequest === "function") {
    return proxyRequest();
  }
  const m_1 = await Promise.resolve().then(() => (init_fetch(), fetch_exports));
  return m_1.default;
}

// node_modules/@opennextjs/aws/dist/core/createGenericHandler.js
async function createGenericHandler(handler3) {
  const config = await import("./open-next.config.mjs").then((m) => m.default);
  globalThis.openNextConfig = config;
  const handlerConfig = config[handler3.type];
  const override = handlerConfig && "override" in handlerConfig ? handlerConfig.override : void 0;
  const converter2 = await resolveConverter(override?.converter);
  const { name, wrapper } = await resolveWrapper(override?.wrapper);
  debug("Using wrapper", name);
  return wrapper(handler3.handler, converter2);
}

// node_modules/@opennextjs/aws/dist/core/routing/util.js
import crypto2 from "node:crypto";
import { parse as parseQs, stringify as stringifyQs } from "node:querystring";

// node_modules/@opennextjs/aws/dist/adapters/config/index.js
init_logger();
import path from "node:path";
globalThis.__dirname ??= "";
var NEXT_DIR = path.join(__dirname, ".next");
var OPEN_NEXT_DIR = path.join(__dirname, ".open-next");
debug({ NEXT_DIR, OPEN_NEXT_DIR });
var NextConfig = { "env": {}, "typescript": { "ignoreBuildErrors": false }, "typedRoutes": false, "distDir": ".next", "cleanDistDir": true, "assetPrefix": "", "cacheMaxMemorySize": 52428800, "configOrigin": "next.config.mjs", "useFileSystemPublicRoutes": true, "generateEtags": true, "pageExtensions": ["tsx", "ts"], "poweredByHeader": true, "compress": true, "images": { "deviceSizes": [640, 750, 828, 1080, 1200, 1920, 2048, 3840], "imageSizes": [32, 48, 64, 96, 128, 256, 384], "path": "/_next/image", "loader": "default", "loaderFile": "", "domains": [], "disableStaticImages": false, "minimumCacheTTL": 14400, "formats": ["image/webp"], "maximumRedirects": 3, "maximumResponseBody": 5e7, "dangerouslyAllowLocalIP": false, "dangerouslyAllowSVG": false, "contentSecurityPolicy": "script-src 'none'; frame-src 'none'; sandbox;", "contentDispositionType": "attachment", "localPatterns": [{ "pathname": "**", "search": "" }], "remotePatterns": [{ "protocol": "https", "hostname": "**.telegram.org" }, { "protocol": "https", "hostname": "**.telegramcdn.org" }], "qualities": [75], "unoptimized": true, "customCacheHandler": false }, "devIndicators": { "position": "bottom-left" }, "onDemandEntries": { "maxInactiveAge": 6e4, "pagesBufferLength": 5 }, "basePath": "", "sassOptions": {}, "trailingSlash": false, "i18n": null, "productionBrowserSourceMaps": false, "excludeDefaultMomentLocales": true, "reactProductionProfiling": false, "reactStrictMode": true, "reactMaxHeadersLength": 6e3, "httpAgentOptions": { "keepAlive": true }, "logging": { "serverFunctions": true, "browserToTerminal": "warn" }, "compiler": {}, "expireTime": 31536e3, "staticPageGenerationTimeout": 60, "output": "standalone", "modularizeImports": { "@mui/icons-material": { "transform": "@mui/icons-material/{{member}}" }, "lodash": { "transform": "lodash/{{member}}" } }, "outputFileTracingRoot": "/Users/sofasokolova/skinplan-mini/.claude/worktrees/strange-gould", "cacheComponents": false, "cacheLife": { "default": { "stale": 300, "revalidate": 900, "expire": 4294967294 }, "seconds": { "stale": 30, "revalidate": 1, "expire": 60 }, "minutes": { "stale": 300, "revalidate": 60, "expire": 3600 }, "hours": { "stale": 300, "revalidate": 3600, "expire": 86400 }, "days": { "stale": 300, "revalidate": 86400, "expire": 604800 }, "weeks": { "stale": 300, "revalidate": 604800, "expire": 2592e3 }, "max": { "stale": 300, "revalidate": 2592e3, "expire": 31536e3 } }, "cacheHandlers": {}, "experimental": { "appNewScrollHandler": false, "useSkewCookie": false, "cssChunking": true, "multiZoneDraftMode": false, "appNavFailHandling": false, "prerenderEarlyExit": true, "serverMinification": true, "linkNoTouchStart": false, "caseSensitiveRoutes": false, "cachedNavigations": false, "partialFallbacks": false, "dynamicOnHover": false, "varyParams": false, "prefetchInlining": false, "preloadEntriesOnStart": true, "clientRouterFilter": true, "clientRouterFilterRedirects": false, "fetchCacheKeyPrefix": "", "proxyPrefetch": "flexible", "optimisticClientCache": true, "manualClientBasePath": false, "cpus": 7, "memoryBasedWorkersCount": false, "imgOptConcurrency": null, "imgOptTimeoutInSeconds": 7, "imgOptMaxInputPixels": 268402689, "imgOptSequentialRead": null, "imgOptSkipMetadata": null, "isrFlushToDisk": true, "workerThreads": false, "optimizeCss": false, "nextScriptWorkers": false, "scrollRestoration": false, "externalDir": false, "disableOptimizedLoading": false, "gzipSize": true, "craCompat": false, "esmExternals": true, "fullySpecified": false, "swcTraceProfiling": false, "forceSwcTransforms": false, "largePageDataBytes": 128e3, "typedEnv": false, "parallelServerCompiles": false, "parallelServerBuildTraces": false, "ppr": false, "authInterrupts": false, "webpackMemoryOptimizations": false, "optimizeServerReact": true, "strictRouteTypes": false, "viewTransition": false, "removeUncaughtErrorAndRejectionListeners": false, "validateRSCRequestHeaders": false, "staleTimes": { "dynamic": 0, "static": 300 }, "reactDebugChannel": true, "serverComponentsHmrCache": true, "staticGenerationMaxConcurrency": 8, "staticGenerationMinPagesPerWorker": 25, "transitionIndicator": false, "gestureTransition": false, "inlineCss": false, "useCache": false, "globalNotFound": false, "browserDebugInfoInTerminal": "warn", "lockDistDir": true, "proxyClientMaxBodySize": 10485760, "hideLogsAfterAbort": false, "mcpServer": true, "turbopackFileSystemCacheForDev": true, "turbopackFileSystemCacheForBuild": false, "turbopackInferModuleSideEffects": true, "turbopackPluginRuntimeStrategy": "childProcesses", "optimizePackageImports": ["lucide-react", "date-fns", "lodash-es", "ramda", "antd", "react-bootstrap", "ahooks", "@ant-design/icons", "@headlessui/react", "@headlessui-float/react", "@heroicons/react/20/solid", "@heroicons/react/24/solid", "@heroicons/react/24/outline", "@visx/visx", "@tremor/react", "rxjs", "@mui/material", "@mui/icons-material", "recharts", "react-use", "effect", "@effect/schema", "@effect/platform", "@effect/platform-node", "@effect/platform-browser", "@effect/platform-bun", "@effect/sql", "@effect/sql-mssql", "@effect/sql-mysql2", "@effect/sql-pg", "@effect/sql-sqlite-node", "@effect/sql-sqlite-bun", "@effect/sql-sqlite-wasm", "@effect/sql-sqlite-react-native", "@effect/rpc", "@effect/rpc-http", "@effect/typeclass", "@effect/experimental", "@effect/opentelemetry", "@material-ui/core", "@material-ui/icons", "@tabler/icons-react", "mui-core", "react-icons/ai", "react-icons/bi", "react-icons/bs", "react-icons/cg", "react-icons/ci", "react-icons/di", "react-icons/fa", "react-icons/fa6", "react-icons/fc", "react-icons/fi", "react-icons/gi", "react-icons/go", "react-icons/gr", "react-icons/hi", "react-icons/hi2", "react-icons/im", "react-icons/io", "react-icons/io5", "react-icons/lia", "react-icons/lib", "react-icons/lu", "react-icons/md", "react-icons/pi", "react-icons/ri", "react-icons/rx", "react-icons/si", "react-icons/sl", "react-icons/tb", "react-icons/tfi", "react-icons/ti", "react-icons/vsc", "react-icons/wi"], "trustHostHeader": false, "isExperimentalCompile": false }, "htmlLimitedBots": "[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight", "bundlePagesRouterDependencies": false, "configFileName": "next.config.mjs", "turbopack": { "root": "/Users/sofasokolova/skinplan-mini/.claude/worktrees/strange-gould" }, "distDirRoot": ".next" };
var BuildId = "xlpsENM6Eg8HmX7vnvoqW";
var RoutesManifest = { "basePath": "", "rewrites": { "beforeFiles": [], "afterFiles": [], "fallback": [] }, "redirects": [{ "source": "/:path+/", "destination": "/:path+", "internal": true, "priority": true, "statusCode": 308, "regex": "^(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))/$" }], "routes": { "static": [{ "page": "/", "regex": "^/(?:/)?$", "routeKeys": {}, "namedRegex": "^/(?:/)?$" }, { "page": "/_global-error", "regex": "^/_global\\-error(?:/)?$", "routeKeys": {}, "namedRegex": "^/_global\\-error(?:/)?$" }, { "page": "/_not-found", "regex": "^/_not\\-found(?:/)?$", "routeKeys": {}, "namedRegex": "^/_not\\-found(?:/)?$" }, { "page": "/admin", "regex": "^/admin(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin(?:/)?$" }, { "page": "/admin/analytics", "regex": "^/admin/analytics(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/analytics(?:/)?$" }, { "page": "/admin/brands", "regex": "^/admin/brands(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/brands(?:/)?$" }, { "page": "/admin/broadcast", "regex": "^/admin/broadcast(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/broadcast(?:/)?$" }, { "page": "/admin/broadcasts", "regex": "^/admin/broadcasts(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/broadcasts(?:/)?$" }, { "page": "/admin/debug", "regex": "^/admin/debug(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/debug(?:/)?$" }, { "page": "/admin/feedback", "regex": "^/admin/feedback(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/feedback(?:/)?$" }, { "page": "/admin/funnel", "regex": "^/admin/funnel(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/funnel(?:/)?$" }, { "page": "/admin/login", "regex": "^/admin/login(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/login(?:/)?$" }, { "page": "/admin/logs", "regex": "^/admin/logs(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/logs(?:/)?$" }, { "page": "/admin/products", "regex": "^/admin/products(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/products(?:/)?$" }, { "page": "/admin/products/new", "regex": "^/admin/products/new(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/products/new(?:/)?$" }, { "page": "/admin/questionnaire", "regex": "^/admin/questionnaire(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/questionnaire(?:/)?$" }, { "page": "/admin/replacements", "regex": "^/admin/replacements(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/replacements(?:/)?$" }, { "page": "/admin/rules", "regex": "^/admin/rules(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/rules(?:/)?$" }, { "page": "/admin/set-webhook", "regex": "^/admin/set\\-webhook(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/set\\-webhook(?:/)?$" }, { "page": "/admin/support", "regex": "^/admin/support(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/support(?:/)?$" }, { "page": "/admin/telegram-callback", "regex": "^/admin/telegram\\-callback(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/telegram\\-callback(?:/)?$" }, { "page": "/admin/telegram-setup", "regex": "^/admin/telegram\\-setup(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/telegram\\-setup(?:/)?$" }, { "page": "/admin/users", "regex": "^/admin/users(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/users(?:/)?$" }, { "page": "/admin/webhook-status", "regex": "^/admin/webhook\\-status(?:/)?$", "routeKeys": {}, "namedRegex": "^/admin/webhook\\-status(?:/)?$" }, { "page": "/analysis", "regex": "^/analysis(?:/)?$", "routeKeys": {}, "namedRegex": "^/analysis(?:/)?$" }, { "page": "/api/admin/auth", "regex": "^/api/admin/auth(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/auth(?:/)?$" }, { "page": "/api/admin/brands", "regex": "^/api/admin/brands(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/brands(?:/)?$" }, { "page": "/api/admin/broadcast/count", "regex": "^/api/admin/broadcast/count(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/broadcast/count(?:/)?$" }, { "page": "/api/admin/broadcast/send", "regex": "^/api/admin/broadcast/send(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/broadcast/send(?:/)?$" }, { "page": "/api/admin/broadcasts", "regex": "^/api/admin/broadcasts(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/broadcasts(?:/)?$" }, { "page": "/api/admin/broadcasts/worker", "regex": "^/api/admin/broadcasts/worker(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/broadcasts/worker(?:/)?$" }, { "page": "/api/admin/cleanup-logs", "regex": "^/api/admin/cleanup\\-logs(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/cleanup\\-logs(?:/)?$" }, { "page": "/api/admin/clear-cache", "regex": "^/api/admin/clear\\-cache(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/clear\\-cache(?:/)?$" }, { "page": "/api/admin/feedback", "regex": "^/api/admin/feedback(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/feedback(?:/)?$" }, { "page": "/api/admin/funnel", "regex": "^/api/admin/funnel(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/funnel(?:/)?$" }, { "page": "/api/admin/login", "regex": "^/api/admin/login(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/login(?:/)?$" }, { "page": "/api/admin/login-email", "regex": "^/api/admin/login\\-email(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/login\\-email(?:/)?$" }, { "page": "/api/admin/logs", "regex": "^/api/admin/logs(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/logs(?:/)?$" }, { "page": "/api/admin/products", "regex": "^/api/admin/products(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/products(?:/)?$" }, { "page": "/api/admin/products/export", "regex": "^/api/admin/products/export(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/products/export(?:/)?$" }, { "page": "/api/admin/replacements", "regex": "^/api/admin/replacements(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/replacements(?:/)?$" }, { "page": "/api/admin/rules", "regex": "^/api/admin/rules(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/rules(?:/)?$" }, { "page": "/api/admin/stats", "regex": "^/api/admin/stats(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/stats(?:/)?$" }, { "page": "/api/admin/support/chats", "regex": "^/api/admin/support/chats(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/support/chats(?:/)?$" }, { "page": "/api/admin/support/close", "regex": "^/api/admin/support/close(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/support/close(?:/)?$" }, { "page": "/api/admin/support/messages", "regex": "^/api/admin/support/messages(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/support/messages(?:/)?$" }, { "page": "/api/admin/support/send", "regex": "^/api/admin/support/send(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/support/send(?:/)?$" }, { "page": "/api/admin/support/status", "regex": "^/api/admin/support/status(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/support/status(?:/)?$" }, { "page": "/api/admin/telegram-callback", "regex": "^/api/admin/telegram\\-callback(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/telegram\\-callback(?:/)?$" }, { "page": "/api/admin/users", "regex": "^/api/admin/users(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/users(?:/)?$" }, { "page": "/api/admin/verify", "regex": "^/api/admin/verify(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/admin/verify(?:/)?$" }, { "page": "/api/ai/daily-tip", "regex": "^/api/ai/daily\\-tip(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/ai/daily\\-tip(?:/)?$" }, { "page": "/api/analysis", "regex": "^/api/analysis(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/analysis(?:/)?$" }, { "page": "/api/auth/telegram", "regex": "^/api/auth/telegram(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/auth/telegram(?:/)?$" }, { "page": "/api/cart", "regex": "^/api/cart(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/cart(?:/)?$" }, { "page": "/api/cron/broadcasts", "regex": "^/api/cron/broadcasts(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/cron/broadcasts(?:/)?$" }, { "page": "/api/cron/cleanup-logs", "regex": "^/api/cron/cleanup\\-logs(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/cron/cleanup\\-logs(?:/)?$" }, { "page": "/api/debug/test-plan", "regex": "^/api/debug/test\\-plan(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/debug/test\\-plan(?:/)?$" }, { "page": "/api/feedback", "regex": "^/api/feedback(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/feedback(?:/)?$" }, { "page": "/api/health", "regex": "^/api/health(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/health(?:/)?$" }, { "page": "/api/logs", "regex": "^/api/logs(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/logs(?:/)?$" }, { "page": "/api/me/entitlements", "regex": "^/api/me/entitlements(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/me/entitlements(?:/)?$" }, { "page": "/api/payment/check-status", "regex": "^/api/payment/check\\-status(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/payment/check\\-status(?:/)?$" }, { "page": "/api/payment/set-status", "regex": "^/api/payment/set\\-status(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/payment/set\\-status(?:/)?$" }, { "page": "/api/payments/create", "regex": "^/api/payments/create(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/payments/create(?:/)?$" }, { "page": "/api/payments/test-webhook", "regex": "^/api/payments/test\\-webhook(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/payments/test\\-webhook(?:/)?$" }, { "page": "/api/payments/webhook", "regex": "^/api/payments/webhook(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/payments/webhook(?:/)?$" }, { "page": "/api/ping", "regex": "^/api/ping(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/ping(?:/)?$" }, { "page": "/api/plan", "regex": "^/api/plan(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/plan(?:/)?$" }, { "page": "/api/plan/generate", "regex": "^/api/plan/generate(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/plan/generate(?:/)?$" }, { "page": "/api/plan/progress", "regex": "^/api/plan/progress(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/plan/progress(?:/)?$" }, { "page": "/api/plan/replace-product", "regex": "^/api/plan/replace\\-product(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/plan/replace\\-product(?:/)?$" }, { "page": "/api/plan/status", "regex": "^/api/plan/status(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/plan/status(?:/)?$" }, { "page": "/api/products/batch", "regex": "^/api/products/batch(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/products/batch(?:/)?$" }, { "page": "/api/profile/current", "regex": "^/api/profile/current(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/profile/current(?:/)?$" }, { "page": "/api/profile/user", "regex": "^/api/profile/user(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/profile/user(?:/)?$" }, { "page": "/api/questionnaire/active", "regex": "^/api/questionnaire/active(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/questionnaire/active(?:/)?$" }, { "page": "/api/questionnaire/answers", "regex": "^/api/questionnaire/answers(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/questionnaire/answers(?:/)?$" }, { "page": "/api/questionnaire/answers/cleanup", "regex": "^/api/questionnaire/answers/cleanup(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/questionnaire/answers/cleanup(?:/)?$" }, { "page": "/api/questionnaire/partial-update", "regex": "^/api/questionnaire/partial\\-update(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/questionnaire/partial\\-update(?:/)?$" }, { "page": "/api/questionnaire/progress", "regex": "^/api/questionnaire/progress(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/questionnaire/progress(?:/)?$" }, { "page": "/api/questionnaire/update-partial", "regex": "^/api/questionnaire/update\\-partial(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/questionnaire/update\\-partial(?:/)?$" }, { "page": "/api/recommendations", "regex": "^/api/recommendations(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/recommendations(?:/)?$" }, { "page": "/api/recommendations/build", "regex": "^/api/recommendations/build(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/recommendations/build(?:/)?$" }, { "page": "/api/telegram/webhook", "regex": "^/api/telegram/webhook(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/telegram/webhook(?:/)?$" }, { "page": "/api/user/clear-data", "regex": "^/api/user/clear\\-data(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/user/clear\\-data(?:/)?$" }, { "page": "/api/user/preferences", "regex": "^/api/user/preferences(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/user/preferences(?:/)?$" }, { "page": "/api/wishlist", "regex": "^/api/wishlist(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/wishlist(?:/)?$" }, { "page": "/api/wishlist/feedback", "regex": "^/api/wishlist/feedback(?:/)?$", "routeKeys": {}, "namedRegex": "^/api/wishlist/feedback(?:/)?$" }, { "page": "/cart", "regex": "^/cart(?:/)?$", "routeKeys": {}, "namedRegex": "^/cart(?:/)?$" }, { "page": "/cart-new", "regex": "^/cart\\-new(?:/)?$", "routeKeys": {}, "namedRegex": "^/cart\\-new(?:/)?$" }, { "page": "/clear-storage", "regex": "^/clear\\-storage(?:/)?$", "routeKeys": {}, "namedRegex": "^/clear\\-storage(?:/)?$" }, { "page": "/debug", "regex": "^/debug(?:/)?$", "routeKeys": {}, "namedRegex": "^/debug(?:/)?$" }, { "page": "/dev/clear", "regex": "^/dev/clear(?:/)?$", "routeKeys": {}, "namedRegex": "^/dev/clear(?:/)?$" }, { "page": "/faq", "regex": "^/faq(?:/)?$", "routeKeys": {}, "namedRegex": "^/faq(?:/)?$" }, { "page": "/home", "regex": "^/home(?:/)?$", "routeKeys": {}, "namedRegex": "^/home(?:/)?$" }, { "page": "/insights", "regex": "^/insights(?:/)?$", "routeKeys": {}, "namedRegex": "^/insights(?:/)?$" }, { "page": "/loading", "regex": "^/loading(?:/)?$", "routeKeys": {}, "namedRegex": "^/loading(?:/)?$" }, { "page": "/logs", "regex": "^/logs(?:/)?$", "routeKeys": {}, "namedRegex": "^/logs(?:/)?$" }, { "page": "/miniapp-ping", "regex": "^/miniapp\\-ping(?:/)?$", "routeKeys": {}, "namedRegex": "^/miniapp\\-ping(?:/)?$" }, { "page": "/payments/return", "regex": "^/payments/return(?:/)?$", "routeKeys": {}, "namedRegex": "^/payments/return(?:/)?$" }, { "page": "/plan", "regex": "^/plan(?:/)?$", "routeKeys": {}, "namedRegex": "^/plan(?:/)?$" }, { "page": "/plan/calendar", "regex": "^/plan/calendar(?:/)?$", "routeKeys": {}, "namedRegex": "^/plan/calendar(?:/)?$" }, { "page": "/profile", "regex": "^/profile(?:/)?$", "routeKeys": {}, "namedRegex": "^/profile(?:/)?$" }, { "page": "/quiz", "regex": "^/quiz(?:/)?$", "routeKeys": {}, "namedRegex": "^/quiz(?:/)?$" }, { "page": "/quiz/update", "regex": "^/quiz/update(?:/)?$", "routeKeys": {}, "namedRegex": "^/quiz/update(?:/)?$" }, { "page": "/quiz/update/result", "regex": "^/quiz/update/result(?:/)?$", "routeKeys": {}, "namedRegex": "^/quiz/update/result(?:/)?$" }, { "page": "/terms", "regex": "^/terms(?:/)?$", "routeKeys": {}, "namedRegex": "^/terms(?:/)?$" }], "dynamic": [{ "page": "/admin/products/[id]", "regex": "^/admin/products/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/admin/products/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/admin/brands/[id]", "regex": "^/api/admin/brands/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/admin/brands/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/admin/broadcasts/[id]", "regex": "^/api/admin/broadcasts/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/admin/broadcasts/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/admin/products/[id]", "regex": "^/api/admin/products/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/admin/products/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/admin/rules/[id]", "regex": "^/api/admin/rules/([^/]+?)(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/admin/rules/(?<nxtPid>[^/]+?)(?:/)?$" }, { "page": "/api/admin/rules/[id]/test", "regex": "^/api/admin/rules/([^/]+?)/test(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/admin/rules/(?<nxtPid>[^/]+?)/test(?:/)?$" }, { "page": "/api/admin/users/[id]/clear-data", "regex": "^/api/admin/users/([^/]+?)/clear\\-data(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/admin/users/(?<nxtPid>[^/]+?)/clear\\-data(?:/)?$" }, { "page": "/api/admin/users/[id]/plan", "regex": "^/api/admin/users/([^/]+?)/plan(?:/)?$", "routeKeys": { "nxtPid": "nxtPid" }, "namedRegex": "^/api/admin/users/(?<nxtPid>[^/]+?)/plan(?:/)?$" }, { "page": "/api/products/alternatives/[productId]", "regex": "^/api/products/alternatives/([^/]+?)(?:/)?$", "routeKeys": { "nxtPproductId": "nxtPproductId" }, "namedRegex": "^/api/products/alternatives/(?<nxtPproductId>[^/]+?)(?:/)?$" }, { "page": "/quiz/update/[topicId]", "regex": "^/quiz/update/([^/]+?)(?:/)?$", "routeKeys": { "nxtPtopicId": "nxtPtopicId" }, "namedRegex": "^/quiz/update/(?<nxtPtopicId>[^/]+?)(?:/)?$" }], "data": { "static": [], "dynamic": [] } }, "locales": [] };
var ConfigHeaders = [{ "source": "/_next/static/:path*", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }], "regex": "^/_next/static(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))?(?:/)?$" }, { "source": "/", "headers": [{ "key": "Cache-Control", "value": "no-store, no-cache, max-age=0" }, { "key": "X-DNS-Prefetch-Control", "value": "on" }, { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }, { "key": "X-Content-Type-Options", "value": "nosniff" }, { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }, { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }, { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://*.telegram.org data:; connect-src 'self' https://telegram.org https://api.telegram.org https://*.telegram.org https://fonts.googleapis.com https://fonts.gstatic.com ws: wss:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://api.fontshare.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://api.fontshare.com; style-src-attr 'self' 'unsafe-inline'; font-src 'self' data: https://fonts.gstatic.com https://api.fontshare.com; img-src 'self' data: https: blob:; frame-src https://telegram.org https://*.telegram.org; frame-ancestors *; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:" }], "regex": "^/(?:/)?$" }, { "source": "/home", "headers": [{ "key": "Cache-Control", "value": "no-store, no-cache, max-age=0" }, { "key": "X-DNS-Prefetch-Control", "value": "on" }, { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }, { "key": "X-Content-Type-Options", "value": "nosniff" }, { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }, { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }, { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://*.telegram.org data:; connect-src 'self' https://telegram.org https://api.telegram.org https://*.telegram.org https://fonts.googleapis.com https://fonts.gstatic.com ws: wss:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://api.fontshare.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://api.fontshare.com; style-src-attr 'self' 'unsafe-inline'; font-src 'self' data: https://fonts.gstatic.com https://api.fontshare.com; img-src 'self' data: https: blob:; frame-src https://telegram.org https://*.telegram.org; frame-ancestors *; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:" }], "regex": "^/home(?:/)?$" }, { "source": "/:path*", "headers": [{ "key": "Cache-Control", "value": "no-store, no-cache, max-age=0, must-revalidate" }, { "key": "X-DNS-Prefetch-Control", "value": "on" }, { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }, { "key": "X-Content-Type-Options", "value": "nosniff" }, { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }, { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }, { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://*.telegram.org data:; connect-src 'self' https://telegram.org https://api.telegram.org https://*.telegram.org https://fonts.googleapis.com https://fonts.gstatic.com ws: wss:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://api.fontshare.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://api.fontshare.com; style-src-attr 'self' 'unsafe-inline'; font-src 'self' data: https://fonts.gstatic.com https://api.fontshare.com; img-src 'self' data: https: blob:; frame-src https://telegram.org https://*.telegram.org; frame-ancestors *; object-src 'none'; base-uri 'self'; form-action 'self'; worker-src 'self' blob:" }], "regex": "^(?:/((?:[^/]+?)(?:/(?:[^/]+?))*))?(?:/)?$" }];
var PrerenderManifest = { "version": 4, "routes": { "/_global-error": { "experimentalBypassFor": [{ "type": "header", "key": "next-action" }, { "type": "header", "key": "content-type", "value": "multipart/form-data;.*" }], "initialRevalidateSeconds": false, "srcRoute": "/_global-error", "dataRoute": "/_global-error.rsc", "allowHeader": ["host", "x-matched-path", "x-prerender-revalidate", "x-prerender-revalidate-if-generated", "x-next-revalidated-tags", "x-next-revalidate-tag-token"] } }, "dynamicRoutes": {}, "notFoundRoutes": [], "preview": { "previewModeId": "472d3698bf623628066f56c410db9fe6", "previewModeSigningKey": "dddd37122a3606ce6073d77663e953ac2501315e97d6787c3aef98ec099598fe", "previewModeEncryptionKey": "166018bc070f049b8934b44a0deda399eed7937cc9417807ddd964360edc2cbc" } };
var MiddlewareManifest = { "version": 3, "middleware": { "/": { "files": ["server/edge-runtime-webpack.js", "server/middleware.js"], "entrypoint": "server/middleware.js", "name": "middleware", "page": "/", "matchers": [{ "regexp": "^(?:\\/(_next\\/data\\/[^/]{1,}))?\\/api(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?(\\.json)?[\\/#\\?]?$", "originalSource": "/api/:path*" }, { "regexp": "^(?:\\/(_next\\/data\\/[^/]{1,}))?\\/admin(\\.json)?[\\/#\\?]?$", "originalSource": "/admin" }, { "regexp": "^(?:\\/(_next\\/data\\/[^/]{1,}))?\\/admin(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?(\\.json)?[\\/#\\?]?$", "originalSource": "/admin/:path*" }, { "regexp": "^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/((?!_next\\/static|_next\\/image|favicon.ico|icons|fonts|sw.js).*))(\\.json)?[\\/#\\?]?$", "originalSource": "/((?!_next/static|_next/image|favicon.ico|icons|fonts|sw.js).*)" }], "wasm": [], "assets": [], "env": { "__NEXT_BUILD_ID": "xlpsENM6Eg8HmX7vnvoqW", "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY": "tolOYVGjVwAuCOoJ7ajt1QaKb9100ZrJmtvCEiKaWes=", "__NEXT_PREVIEW_MODE_ID": "472d3698bf623628066f56c410db9fe6", "__NEXT_PREVIEW_MODE_SIGNING_KEY": "dddd37122a3606ce6073d77663e953ac2501315e97d6787c3aef98ec099598fe", "__NEXT_PREVIEW_MODE_ENCRYPTION_KEY": "166018bc070f049b8934b44a0deda399eed7937cc9417807ddd964360edc2cbc" } } }, "functions": {}, "sortedMiddleware": ["/"] };
var AppPathRoutesManifest = { "/_not-found/page": "/_not-found", "/_global-error/page": "/_global-error", "/api/admin/auth/route": "/api/admin/auth", "/api/admin/brands/[id]/route": "/api/admin/brands/[id]", "/api/admin/brands/route": "/api/admin/brands", "/api/admin/broadcast/count/route": "/api/admin/broadcast/count", "/api/admin/broadcast/send/route": "/api/admin/broadcast/send", "/api/admin/broadcasts/[id]/route": "/api/admin/broadcasts/[id]", "/api/admin/broadcasts/route": "/api/admin/broadcasts", "/api/admin/broadcasts/worker/route": "/api/admin/broadcasts/worker", "/api/admin/cleanup-logs/route": "/api/admin/cleanup-logs", "/api/admin/clear-cache/route": "/api/admin/clear-cache", "/api/admin/feedback/route": "/api/admin/feedback", "/api/admin/funnel/route": "/api/admin/funnel", "/api/admin/login-email/route": "/api/admin/login-email", "/api/admin/login/route": "/api/admin/login", "/api/admin/logs/route": "/api/admin/logs", "/api/admin/products/[id]/route": "/api/admin/products/[id]", "/api/admin/products/export/route": "/api/admin/products/export", "/api/admin/products/route": "/api/admin/products", "/api/admin/replacements/route": "/api/admin/replacements", "/api/admin/rules/[id]/route": "/api/admin/rules/[id]", "/api/admin/rules/[id]/test/route": "/api/admin/rules/[id]/test", "/api/admin/rules/route": "/api/admin/rules", "/api/admin/stats/route": "/api/admin/stats", "/api/admin/support/chats/route": "/api/admin/support/chats", "/api/admin/support/close/route": "/api/admin/support/close", "/api/admin/support/messages/route": "/api/admin/support/messages", "/api/admin/support/send/route": "/api/admin/support/send", "/api/admin/support/status/route": "/api/admin/support/status", "/api/admin/telegram-callback/route": "/api/admin/telegram-callback", "/api/admin/users/[id]/plan/route": "/api/admin/users/[id]/plan", "/api/admin/users/route": "/api/admin/users", "/api/admin/verify/route": "/api/admin/verify", "/api/ai/daily-tip/route": "/api/ai/daily-tip", "/api/analysis/route": "/api/analysis", "/api/cart/route": "/api/cart", "/api/cron/broadcasts/route": "/api/cron/broadcasts", "/api/debug/test-plan/route": "/api/debug/test-plan", "/api/feedback/route": "/api/feedback", "/api/health/route": "/api/health", "/api/logs/route": "/api/logs", "/api/me/entitlements/route": "/api/me/entitlements", "/api/payment/check-status/route": "/api/payment/check-status", "/api/payment/set-status/route": "/api/payment/set-status", "/api/payments/create/route": "/api/payments/create", "/api/payments/test-webhook/route": "/api/payments/test-webhook", "/api/payments/webhook/route": "/api/payments/webhook", "/api/ping/route": "/api/ping", "/api/plan/generate/route": "/api/plan/generate", "/api/plan/progress/route": "/api/plan/progress", "/api/plan/replace-product/route": "/api/plan/replace-product", "/api/products/alternatives/[productId]/route": "/api/products/alternatives/[productId]", "/api/products/batch/route": "/api/products/batch", "/api/profile/user/route": "/api/profile/user", "/api/questionnaire/active/route": "/api/questionnaire/active", "/api/questionnaire/answers/cleanup/route": "/api/questionnaire/answers/cleanup", "/api/questionnaire/partial-update/route": "/api/questionnaire/partial-update", "/api/questionnaire/progress/route": "/api/questionnaire/progress", "/api/questionnaire/update-partial/route": "/api/questionnaire/update-partial", "/api/recommendations/build/route": "/api/recommendations/build", "/api/recommendations/route": "/api/recommendations", "/api/telegram/webhook/route": "/api/telegram/webhook", "/api/user/preferences/route": "/api/user/preferences", "/api/wishlist/feedback/route": "/api/wishlist/feedback", "/api/wishlist/route": "/api/wishlist", "/miniapp-ping/route": "/miniapp-ping", "/api/admin/users/[id]/clear-data/route": "/api/admin/users/[id]/clear-data", "/api/auth/telegram/route": "/api/auth/telegram", "/api/cron/cleanup-logs/route": "/api/cron/cleanup-logs", "/api/plan/route": "/api/plan", "/api/plan/status/route": "/api/plan/status", "/api/profile/current/route": "/api/profile/current", "/api/questionnaire/answers/route": "/api/questionnaire/answers", "/api/user/clear-data/route": "/api/user/clear-data", "/dev/clear/page": "/dev/clear", "/payments/return/page": "/payments/return", "/(miniapp)/analysis/page": "/analysis", "/(miniapp)/cart/page": "/cart", "/(miniapp)/clear-storage/page": "/clear-storage", "/(miniapp)/debug/page": "/debug", "/(miniapp)/faq/page": "/faq", "/(miniapp)/home/page": "/home", "/(miniapp)/insights/page": "/insights", "/(miniapp)/loading/page": "/loading", "/(miniapp)/logs/page": "/logs", "/(miniapp)/page": "/", "/(miniapp)/plan/calendar/page": "/plan/calendar", "/(miniapp)/plan/page": "/plan", "/(miniapp)/profile/page": "/profile", "/(miniapp)/quiz/page": "/quiz", "/(miniapp)/quiz/update/[topicId]/page": "/quiz/update/[topicId]", "/(miniapp)/quiz/update/page": "/quiz/update", "/(miniapp)/terms/page": "/terms", "/admin/analytics/page": "/admin/analytics", "/admin/brands/page": "/admin/brands", "/admin/broadcast/page": "/admin/broadcast", "/admin/broadcasts/page": "/admin/broadcasts", "/admin/debug/page": "/admin/debug", "/admin/feedback/page": "/admin/feedback", "/admin/funnel/page": "/admin/funnel", "/admin/login/page": "/admin/login", "/admin/logs/page": "/admin/logs", "/admin/page": "/admin", "/admin/products/[id]/page": "/admin/products/[id]", "/admin/products/new/page": "/admin/products/new", "/admin/products/page": "/admin/products", "/admin/questionnaire/page": "/admin/questionnaire", "/admin/replacements/page": "/admin/replacements", "/admin/rules/page": "/admin/rules", "/admin/set-webhook/page": "/admin/set-webhook", "/admin/support/page": "/admin/support", "/admin/telegram-callback/page": "/admin/telegram-callback", "/admin/telegram-setup/page": "/admin/telegram-setup", "/admin/users/page": "/admin/users", "/admin/webhook-status/page": "/admin/webhook-status", "/(miniapp)/cart-new/page": "/cart-new", "/(miniapp)/quiz/update/result/page": "/quiz/update/result" };
var FunctionsConfigManifest = { "version": 1, "functions": {} };
var PagesManifest = { "/500": "pages/500.html" };
process.env.NEXT_BUILD_ID = BuildId;
process.env.NEXT_PREVIEW_MODE_ID = PrerenderManifest?.preview?.previewModeId;

// node_modules/@opennextjs/aws/dist/http/openNextResponse.js
init_logger();
init_util();
import { Transform } from "node:stream";

// node_modules/@opennextjs/aws/dist/core/routing/util.js
init_util();
init_logger();
import { ReadableStream as ReadableStream3 } from "node:stream/web";

// node_modules/@opennextjs/aws/dist/utils/binary.js
var commonBinaryMimeTypes = /* @__PURE__ */ new Set([
  "application/octet-stream",
  // Docs
  "application/epub+zip",
  "application/msword",
  "application/pdf",
  "application/rtf",
  "application/vnd.amazon.ebook",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Fonts
  "font/otf",
  "font/woff",
  "font/woff2",
  // Images
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/vnd.microsoft.icon",
  "image/webp",
  // Audio
  "audio/3gpp",
  "audio/aac",
  "audio/basic",
  "audio/flac",
  "audio/mpeg",
  "audio/ogg",
  "audio/wavaudio/webm",
  "audio/x-aiff",
  "audio/x-midi",
  "audio/x-wav",
  // Video
  "video/3gpp",
  "video/mp2t",
  "video/mpeg",
  "video/ogg",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  // Archives
  "application/java-archive",
  "application/vnd.apple.installer+xml",
  "application/x-7z-compressed",
  "application/x-apple-diskimage",
  "application/x-bzip",
  "application/x-bzip2",
  "application/x-gzip",
  "application/x-java-archive",
  "application/x-rar-compressed",
  "application/x-tar",
  "application/x-zip",
  "application/zip",
  // Serialized data
  "application/x-protobuf"
]);
function isBinaryContentType(contentType) {
  if (!contentType)
    return false;
  const value = contentType.split(";")[0];
  return commonBinaryMimeTypes.has(value);
}

// node_modules/@opennextjs/aws/dist/core/routing/i18n/index.js
init_stream();
init_logger();

// node_modules/@opennextjs/aws/dist/core/routing/i18n/accept-header.js
function parse(raw, preferences, options) {
  const lowers = /* @__PURE__ */ new Map();
  const header = raw.replace(/[ \t]/g, "");
  if (preferences) {
    let pos = 0;
    for (const preference of preferences) {
      const lower = preference.toLowerCase();
      lowers.set(lower, { orig: preference, pos: pos++ });
      if (options.prefixMatch) {
        const parts2 = lower.split("-");
        while (parts2.pop(), parts2.length > 0) {
          const joined = parts2.join("-");
          if (!lowers.has(joined)) {
            lowers.set(joined, { orig: preference, pos: pos++ });
          }
        }
      }
    }
  }
  const parts = header.split(",");
  const selections = [];
  const map = /* @__PURE__ */ new Set();
  for (let i = 0; i < parts.length; ++i) {
    const part = parts[i];
    if (!part) {
      continue;
    }
    const params = part.split(";");
    if (params.length > 2) {
      throw new Error(`Invalid ${options.type} header`);
    }
    const token = params[0].toLowerCase();
    if (!token) {
      throw new Error(`Invalid ${options.type} header`);
    }
    const selection = { token, pos: i, q: 1 };
    if (preferences && lowers.has(token)) {
      selection.pref = lowers.get(token).pos;
    }
    map.add(selection.token);
    if (params.length === 2) {
      const q = params[1];
      const [key, value] = q.split("=");
      if (!value || key !== "q" && key !== "Q") {
        throw new Error(`Invalid ${options.type} header`);
      }
      const score = Number.parseFloat(value);
      if (score === 0) {
        continue;
      }
      if (Number.isFinite(score) && score <= 1 && score >= 1e-3) {
        selection.q = score;
      }
    }
    selections.push(selection);
  }
  selections.sort((a, b) => {
    if (b.q !== a.q) {
      return b.q - a.q;
    }
    if (b.pref !== a.pref) {
      if (a.pref === void 0) {
        return 1;
      }
      if (b.pref === void 0) {
        return -1;
      }
      return a.pref - b.pref;
    }
    return a.pos - b.pos;
  });
  const values = selections.map((selection) => selection.token);
  if (!preferences || !preferences.length) {
    return values;
  }
  const preferred = [];
  for (const selection of values) {
    if (selection === "*") {
      for (const [preference, value] of lowers) {
        if (!map.has(preference)) {
          preferred.push(value.orig);
        }
      }
    } else {
      const lower = selection.toLowerCase();
      if (lowers.has(lower)) {
        preferred.push(lowers.get(lower).orig);
      }
    }
  }
  return preferred;
}
function acceptLanguage(header = "", preferences) {
  return parse(header, preferences, {
    type: "accept-language",
    prefixMatch: true
  })[0] || void 0;
}

// node_modules/@opennextjs/aws/dist/core/routing/i18n/index.js
function isLocalizedPath(path3) {
  return NextConfig.i18n?.locales.includes(path3.split("/")[1].toLowerCase()) ?? false;
}
function getLocaleFromCookie(cookies) {
  const i18n = NextConfig.i18n;
  const nextLocale = cookies.NEXT_LOCALE?.toLowerCase();
  return nextLocale ? i18n?.locales.find((locale) => nextLocale === locale.toLowerCase()) : void 0;
}
function detectDomainLocale({ hostname, detectedLocale }) {
  const i18n = NextConfig.i18n;
  const domains = i18n?.domains;
  if (!domains) {
    return;
  }
  const lowercasedLocale = detectedLocale?.toLowerCase();
  for (const domain of domains) {
    const domainHostname = domain.domain.split(":", 1)[0].toLowerCase();
    if (hostname === domainHostname || lowercasedLocale === domain.defaultLocale.toLowerCase() || domain.locales?.some((locale) => lowercasedLocale === locale.toLowerCase())) {
      return domain;
    }
  }
}
function detectLocale(internalEvent, i18n) {
  const domainLocale = detectDomainLocale({
    hostname: internalEvent.headers.host
  });
  if (i18n.localeDetection === false) {
    return domainLocale?.defaultLocale ?? i18n.defaultLocale;
  }
  const cookiesLocale = getLocaleFromCookie(internalEvent.cookies);
  const preferredLocale = acceptLanguage(internalEvent.headers["accept-language"], i18n?.locales);
  debug({
    cookiesLocale,
    preferredLocale,
    defaultLocale: i18n.defaultLocale,
    domainLocale
  });
  return domainLocale?.defaultLocale ?? cookiesLocale ?? preferredLocale ?? i18n.defaultLocale;
}
function localizePath(internalEvent) {
  const i18n = NextConfig.i18n;
  if (!i18n) {
    return internalEvent.rawPath;
  }
  if (isLocalizedPath(internalEvent.rawPath)) {
    return internalEvent.rawPath;
  }
  const detectedLocale = detectLocale(internalEvent, i18n);
  return `/${detectedLocale}${internalEvent.rawPath}`;
}
function handleLocaleRedirect(internalEvent) {
  const i18n = NextConfig.i18n;
  if (!i18n || i18n.localeDetection === false || internalEvent.rawPath !== "/") {
    return false;
  }
  const preferredLocale = acceptLanguage(internalEvent.headers["accept-language"], i18n?.locales);
  const detectedLocale = detectLocale(internalEvent, i18n);
  const domainLocale = detectDomainLocale({
    hostname: internalEvent.headers.host
  });
  const preferredDomain = detectDomainLocale({
    detectedLocale: preferredLocale
  });
  if (domainLocale && preferredDomain) {
    const isPDomain = preferredDomain.domain === domainLocale.domain;
    const isPLocale = preferredDomain.defaultLocale === preferredLocale;
    if (!isPDomain || !isPLocale) {
      const scheme = `http${preferredDomain.http ? "" : "s"}`;
      const rlocale = isPLocale ? "" : preferredLocale;
      return {
        type: "core",
        statusCode: 307,
        headers: {
          Location: `${scheme}://${preferredDomain.domain}/${rlocale}`
        },
        body: emptyReadableStream(),
        isBase64Encoded: false
      };
    }
  }
  const defaultLocale = domainLocale?.defaultLocale ?? i18n.defaultLocale;
  if (detectedLocale.toLowerCase() !== defaultLocale.toLowerCase()) {
    const nextUrl = constructNextUrl(internalEvent.url, `/${detectedLocale}${NextConfig.trailingSlash ? "/" : ""}`);
    const queryString = convertToQueryString(internalEvent.query);
    return {
      type: "core",
      statusCode: 307,
      headers: {
        Location: `${nextUrl}${queryString}`
      },
      body: emptyReadableStream(),
      isBase64Encoded: false
    };
  }
  return false;
}

// node_modules/@opennextjs/aws/dist/core/routing/queue.js
function generateShardId(rawPath, maxConcurrency, prefix) {
  let a = cyrb128(rawPath);
  let t = a += 1831565813;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  const randomFloat = ((t ^ t >>> 14) >>> 0) / 4294967296;
  const randomInt = Math.floor(randomFloat * maxConcurrency);
  return `${prefix}-${randomInt}`;
}
function generateMessageGroupId(rawPath) {
  const maxConcurrency = Number.parseInt(process.env.MAX_REVALIDATE_CONCURRENCY ?? "10");
  return generateShardId(rawPath, maxConcurrency, "revalidate");
}
function cyrb128(str) {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ h1 >>> 18, 597399067);
  h2 = Math.imul(h4 ^ h2 >>> 22, 2869860233);
  h3 = Math.imul(h1 ^ h3 >>> 17, 951274213);
  h4 = Math.imul(h2 ^ h4 >>> 19, 2716044179);
  h1 ^= h2 ^ h3 ^ h4, h2 ^= h1, h3 ^= h1, h4 ^= h1;
  return h1 >>> 0;
}

// node_modules/@opennextjs/aws/dist/core/routing/util.js
function isExternal(url, host) {
  if (!url)
    return false;
  const pattern = /^https?:\/\//;
  if (!pattern.test(url))
    return false;
  if (host) {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.host !== host;
    } catch {
      return !url.includes(host);
    }
  }
  return true;
}
function convertFromQueryString(query) {
  if (query === "")
    return {};
  const queryParts = query.split("&");
  return getQueryFromIterator(queryParts.map((p) => {
    const [key, value] = p.split("=");
    return [key, value];
  }));
}
function getUrlParts(url, isExternal2) {
  if (!isExternal2) {
    const regex2 = /\/([^?]*)\??(.*)/;
    const match3 = url.match(regex2);
    return {
      hostname: "",
      pathname: match3?.[1] ? `/${match3[1]}` : url,
      protocol: "",
      queryString: match3?.[2] ?? ""
    };
  }
  const regex = /^(https?:)\/\/?([^\/\s]+)(\/[^?]*)?(\?.*)?/;
  const match2 = url.match(regex);
  if (!match2) {
    throw new Error(`Invalid external URL: ${url}`);
  }
  return {
    protocol: match2[1] ?? "https:",
    hostname: match2[2],
    pathname: match2[3] ?? "",
    queryString: match2[4]?.slice(1) ?? ""
  };
}
function constructNextUrl(baseUrl, path3) {
  const nextBasePath = NextConfig.basePath ?? "";
  const url = new URL(`${nextBasePath}${path3}`, baseUrl);
  return url.href;
}
function convertToQueryString(query) {
  const queryStrings = [];
  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => queryStrings.push(`${key}=${entry}`));
    } else {
      queryStrings.push(`${key}=${value}`);
    }
  });
  return queryStrings.length > 0 ? `?${queryStrings.join("&")}` : "";
}
function getMiddlewareMatch(middlewareManifest2, functionsManifest) {
  if (functionsManifest?.functions?.["/_middleware"]) {
    return functionsManifest.functions["/_middleware"].matchers?.map(({ regexp }) => new RegExp(regexp)) ?? [/.*/];
  }
  const rootMiddleware = middlewareManifest2.middleware["/"];
  if (!rootMiddleware?.matchers)
    return [];
  return rootMiddleware.matchers.map(({ regexp }) => new RegExp(regexp));
}
function escapeRegex(str, { isPath } = {}) {
  const result = str.replaceAll("(.)", "_\xB51_").replaceAll("(..)", "_\xB52_").replaceAll("(...)", "_\xB53_");
  return isPath ? result : result.replaceAll("+", "_\xB54_");
}
function unescapeRegex(str) {
  return str.replaceAll("_\xB51_", "(.)").replaceAll("_\xB52_", "(..)").replaceAll("_\xB53_", "(...)").replaceAll("_\xB54_", "+");
}
function convertBodyToReadableStream(method, body) {
  if (method === "GET" || method === "HEAD")
    return void 0;
  if (!body)
    return void 0;
  return new ReadableStream3({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    }
  });
}
var CommonHeaders;
(function(CommonHeaders2) {
  CommonHeaders2["CACHE_CONTROL"] = "cache-control";
  CommonHeaders2["NEXT_CACHE"] = "x-nextjs-cache";
})(CommonHeaders || (CommonHeaders = {}));
function normalizeLocationHeader(location, baseUrl, encodeQuery = false) {
  if (!URL.canParse(location)) {
    return location;
  }
  const locationURL = new URL(location);
  const origin = new URL(baseUrl).origin;
  let search = locationURL.search;
  if (encodeQuery && search) {
    search = `?${stringifyQs(parseQs(search.slice(1)))}`;
  }
  const href = `${locationURL.origin}${locationURL.pathname}${search}${locationURL.hash}`;
  if (locationURL.origin === origin) {
    return href.slice(origin.length);
  }
  return href;
}

// node_modules/@opennextjs/aws/dist/core/routingHandler.js
init_logger();

// node_modules/@opennextjs/aws/dist/core/routing/cacheInterceptor.js
import { createHash } from "node:crypto";
init_stream();

// node_modules/@opennextjs/aws/dist/utils/cache.js
init_logger();
async function hasBeenRevalidated(key, tags, cacheEntry) {
  if (globalThis.openNextConfig.dangerous?.disableTagCache) {
    return false;
  }
  const value = cacheEntry.value;
  if (!value) {
    return true;
  }
  if ("type" in cacheEntry && cacheEntry.type === "page") {
    return false;
  }
  const lastModified = cacheEntry.lastModified ?? Date.now();
  if (globalThis.tagCache.mode === "nextMode") {
    return tags.length === 0 ? false : await globalThis.tagCache.hasBeenRevalidated(tags, lastModified);
  }
  const _lastModified = await globalThis.tagCache.getLastModified(key, lastModified);
  return _lastModified === -1;
}
function getTagsFromValue(value) {
  if (!value) {
    return [];
  }
  try {
    const cacheTags = value.meta?.headers?.["x-next-cache-tags"]?.split(",") ?? [];
    delete value.meta?.headers?.["x-next-cache-tags"];
    return cacheTags;
  } catch (e) {
    return [];
  }
}

// node_modules/@opennextjs/aws/dist/core/routing/cacheInterceptor.js
init_logger();
var CACHE_ONE_YEAR = 60 * 60 * 24 * 365;
var CACHE_ONE_MONTH = 60 * 60 * 24 * 30;
var VARY_HEADER = "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Next-Url";
var NEXT_SEGMENT_PREFETCH_HEADER = "next-router-segment-prefetch";
var NEXT_PRERENDER_HEADER = "x-nextjs-prerender";
var NEXT_POSTPONED_HEADER = "x-nextjs-postponed";
async function computeCacheControl(path3, body, host, revalidate, lastModified) {
  let finalRevalidate = CACHE_ONE_YEAR;
  const existingRoute = Object.entries(PrerenderManifest?.routes ?? {}).find((p) => p[0] === path3)?.[1];
  if (revalidate === void 0 && existingRoute) {
    finalRevalidate = existingRoute.initialRevalidateSeconds === false ? CACHE_ONE_YEAR : existingRoute.initialRevalidateSeconds;
  } else if (revalidate !== void 0) {
    finalRevalidate = revalidate === false ? CACHE_ONE_YEAR : revalidate;
  }
  const age = Math.round((Date.now() - (lastModified ?? 0)) / 1e3);
  const hash = (str) => createHash("md5").update(str).digest("hex");
  const etag = hash(body);
  if (revalidate === 0) {
    return {
      "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
      "x-opennext-cache": "ERROR",
      etag
    };
  }
  if (finalRevalidate !== CACHE_ONE_YEAR) {
    const sMaxAge = Math.max(finalRevalidate - age, 1);
    debug("sMaxAge", {
      finalRevalidate,
      age,
      lastModified,
      revalidate
    });
    const isStale = sMaxAge === 1;
    if (isStale) {
      let url = NextConfig.trailingSlash ? `${path3}/` : path3;
      if (NextConfig.basePath) {
        url = `${NextConfig.basePath}${url}`;
      }
      await globalThis.queue.send({
        MessageBody: {
          host,
          url,
          eTag: etag,
          lastModified: lastModified ?? Date.now()
        },
        MessageDeduplicationId: hash(`${path3}-${lastModified}-${etag}`),
        MessageGroupId: generateMessageGroupId(path3)
      });
    }
    return {
      "cache-control": `s-maxage=${sMaxAge}, stale-while-revalidate=${CACHE_ONE_MONTH}`,
      "x-opennext-cache": isStale ? "STALE" : "HIT",
      etag
    };
  }
  return {
    "cache-control": `s-maxage=${CACHE_ONE_YEAR}, stale-while-revalidate=${CACHE_ONE_MONTH}`,
    "x-opennext-cache": "HIT",
    etag
  };
}
function getBodyForAppRouter(event, cachedValue) {
  if (cachedValue.type !== "app") {
    throw new Error("getBodyForAppRouter called with non-app cache value");
  }
  try {
    const segmentHeader = `${event.headers[NEXT_SEGMENT_PREFETCH_HEADER]}`;
    const isSegmentResponse = Boolean(segmentHeader) && segmentHeader in (cachedValue.segmentData || {}) && !NextConfig.experimental?.prefetchInlining;
    const body = isSegmentResponse ? cachedValue.segmentData[segmentHeader] : cachedValue.rsc;
    return {
      body,
      additionalHeaders: isSegmentResponse ? { [NEXT_PRERENDER_HEADER]: "1", [NEXT_POSTPONED_HEADER]: "2" } : {}
    };
  } catch (e) {
    error("Error while getting body for app router from cache:", e);
    return { body: cachedValue.rsc, additionalHeaders: {} };
  }
}
async function generateResult(event, localizedPath, cachedValue, lastModified) {
  debug("Returning result from experimental cache");
  let body = "";
  let type = "application/octet-stream";
  let isDataRequest = false;
  let additionalHeaders = {};
  if (cachedValue.type === "app") {
    isDataRequest = Boolean(event.headers.rsc);
    if (isDataRequest) {
      const { body: appRouterBody, additionalHeaders: appHeaders } = getBodyForAppRouter(event, cachedValue);
      body = appRouterBody;
      additionalHeaders = appHeaders;
    } else {
      body = cachedValue.html;
    }
    type = isDataRequest ? "text/x-component" : "text/html; charset=utf-8";
  } else if (cachedValue.type === "page") {
    isDataRequest = Boolean(event.query.__nextDataReq);
    body = isDataRequest ? JSON.stringify(cachedValue.json) : cachedValue.html;
    type = isDataRequest ? "application/json" : "text/html; charset=utf-8";
  } else {
    throw new Error("generateResult called with unsupported cache value type, only 'app' and 'page' are supported");
  }
  const cacheControl = await computeCacheControl(localizedPath, body, event.headers.host, cachedValue.revalidate, lastModified);
  return {
    type: "core",
    // Sometimes other status codes can be cached, like 404. For these cases, we should return the correct status code
    // Also set the status code to the rewriteStatusCode if defined
    // This can happen in handleMiddleware in routingHandler.
    // `NextResponse.rewrite(url, { status: xxx})
    // The rewrite status code should take precedence over the cached one
    statusCode: event.rewriteStatusCode ?? cachedValue.meta?.status ?? 200,
    body: toReadableStream(body, false),
    isBase64Encoded: false,
    headers: {
      ...cacheControl,
      "content-type": type,
      ...cachedValue.meta?.headers,
      vary: VARY_HEADER,
      ...additionalHeaders
    }
  };
}
function escapePathDelimiters(segment, escapeEncoded) {
  return segment.replace(new RegExp(`([/#?]${escapeEncoded ? "|%(2f|23|3f|5c)" : ""})`, "gi"), (char) => encodeURIComponent(char));
}
function decodePathParams(pathname) {
  return pathname.split("/").map((segment) => {
    try {
      return escapePathDelimiters(decodeURIComponent(segment), true);
    } catch (e) {
      return segment;
    }
  }).join("/");
}
async function cacheInterceptor(event) {
  if (Boolean(event.headers["next-action"]) || Boolean(event.headers["x-prerender-revalidate"]))
    return event;
  const cookies = event.headers.cookie || "";
  const hasPreviewData = cookies.includes("__prerender_bypass") || cookies.includes("__next_preview_data");
  if (hasPreviewData) {
    debug("Preview mode detected, passing through to handler");
    return event;
  }
  let localizedPath = localizePath(event);
  if (NextConfig.basePath) {
    localizedPath = localizedPath.replace(NextConfig.basePath, "");
  }
  localizedPath = localizedPath.replace(/\/$/, "");
  localizedPath = decodePathParams(localizedPath);
  debug("Checking cache for", localizedPath, PrerenderManifest);
  const isISR = Object.keys(PrerenderManifest?.routes ?? {}).includes(localizedPath ?? "/") || Object.values(PrerenderManifest?.dynamicRoutes ?? {}).some((dr) => new RegExp(dr.routeRegex).test(localizedPath));
  debug("isISR", isISR);
  if (isISR) {
    try {
      const cachedData = await globalThis.incrementalCache.get(localizedPath ?? "/index");
      debug("cached data in interceptor", cachedData);
      if (!cachedData?.value) {
        return event;
      }
      if (cachedData.value?.type === "app" || cachedData.value?.type === "route") {
        const tags = getTagsFromValue(cachedData.value);
        const _hasBeenRevalidated = cachedData.shouldBypassTagCache ? false : await hasBeenRevalidated(localizedPath, tags, cachedData);
        if (_hasBeenRevalidated) {
          return event;
        }
      }
      const host = event.headers.host;
      switch (cachedData?.value?.type) {
        case "app":
        case "page":
          return generateResult(event, localizedPath, cachedData.value, cachedData.lastModified);
        case "redirect": {
          const cacheControl = await computeCacheControl(localizedPath, "", host, cachedData.value.revalidate, cachedData.lastModified);
          return {
            type: "core",
            statusCode: cachedData.value.meta?.status ?? 307,
            body: emptyReadableStream(),
            headers: {
              ...cachedData.value.meta?.headers ?? {},
              ...cacheControl
            },
            isBase64Encoded: false
          };
        }
        case "route": {
          const cacheControl = await computeCacheControl(localizedPath, cachedData.value.body, host, cachedData.value.revalidate, cachedData.lastModified);
          const isBinary = isBinaryContentType(String(cachedData.value.meta?.headers?.["content-type"]));
          return {
            type: "core",
            statusCode: event.rewriteStatusCode ?? cachedData.value.meta?.status ?? 200,
            body: toReadableStream(cachedData.value.body, isBinary),
            headers: {
              ...cacheControl,
              ...cachedData.value.meta?.headers,
              vary: VARY_HEADER
            },
            isBase64Encoded: isBinary
          };
        }
        default:
          return event;
      }
    } catch (e) {
      debug("Error while fetching cache", e);
      return event;
    }
  }
  return event;
}

// node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
function parse2(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path3 = "";
  var tryConsume = function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  };
  var mustConsume = function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  };
  var consumeText = function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  };
  var isSafe = function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  };
  var safePattern = function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  };
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path3 += prefix;
        prefix = "";
      }
      if (path3) {
        result.push(path3);
        path3 = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path3 += value;
      continue;
    }
    if (path3) {
      result.push(path3);
      path3 = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
function compile(str, options) {
  return tokensToFunction(parse2(str, options), options);
}
function tokensToFunction(tokens, options) {
  if (options === void 0) {
    options = {};
  }
  var reFlags = flags(options);
  var _a = options.encode, encode = _a === void 0 ? function(x) {
    return x;
  } : _a, _b = options.validate, validate = _b === void 0 ? true : _b;
  var matches = tokens.map(function(token) {
    if (typeof token === "object") {
      return new RegExp("^(?:".concat(token.pattern, ")$"), reFlags);
    }
  });
  return function(data) {
    var path3 = "";
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      if (typeof token === "string") {
        path3 += token;
        continue;
      }
      var value = data ? data[token.name] : void 0;
      var optional = token.modifier === "?" || token.modifier === "*";
      var repeat = token.modifier === "*" || token.modifier === "+";
      if (Array.isArray(value)) {
        if (!repeat) {
          throw new TypeError('Expected "'.concat(token.name, '" to not repeat, but got an array'));
        }
        if (value.length === 0) {
          if (optional)
            continue;
          throw new TypeError('Expected "'.concat(token.name, '" to not be empty'));
        }
        for (var j = 0; j < value.length; j++) {
          var segment = encode(value[j], token);
          if (validate && !matches[i].test(segment)) {
            throw new TypeError('Expected all "'.concat(token.name, '" to match "').concat(token.pattern, '", but got "').concat(segment, '"'));
          }
          path3 += token.prefix + segment + token.suffix;
        }
        continue;
      }
      if (typeof value === "string" || typeof value === "number") {
        var segment = encode(String(value), token);
        if (validate && !matches[i].test(segment)) {
          throw new TypeError('Expected "'.concat(token.name, '" to match "').concat(token.pattern, '", but got "').concat(segment, '"'));
        }
        path3 += token.prefix + segment + token.suffix;
        continue;
      }
      if (optional)
        continue;
      var typeOfMessage = repeat ? "an array" : "a string";
      throw new TypeError('Expected "'.concat(token.name, '" to be ').concat(typeOfMessage));
    }
    return path3;
  };
}
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path3 = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    };
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path: path3, index, params };
  };
}
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
function regexpToRegexp(path3, keys) {
  if (!keys)
    return path3;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path3.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path3.source);
  }
  return path3;
}
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path3) {
    return pathToRegexp(path3, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
function stringToRegexp(path3, keys, options) {
  return tokensToRegexp(parse2(path3, options), keys, options);
}
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
function pathToRegexp(path3, keys, options) {
  if (path3 instanceof RegExp)
    return regexpToRegexp(path3, keys);
  if (Array.isArray(path3))
    return arrayToRegexp(path3, keys, options);
  return stringToRegexp(path3, keys, options);
}

// node_modules/@opennextjs/aws/dist/utils/normalize-path.js
import path2 from "node:path";
function normalizeRepeatedSlashes(url) {
  const urlNoQuery = url.host + url.pathname;
  return `${url.protocol}//${urlNoQuery.replace(/\\/g, "/").replace(/\/\/+/g, "/")}${url.search}`;
}

// node_modules/@opennextjs/aws/dist/core/routing/matcher.js
init_stream();
init_logger();

// node_modules/@opennextjs/aws/dist/core/routing/routeMatcher.js
var optionalLocalePrefixRegex = `^/(?:${RoutesManifest.locales.map((locale) => `${locale}/?`).join("|")})?`;
var optionalBasepathPrefixRegex = RoutesManifest.basePath ? `^${RoutesManifest.basePath}/?` : "^/";
var optionalPrefix = optionalLocalePrefixRegex.replace("^/", optionalBasepathPrefixRegex);
function routeMatcher(routeDefinitions) {
  const regexp = routeDefinitions.map((route) => ({
    page: route.page,
    regexp: new RegExp(route.regex.replace("^/", optionalPrefix))
  }));
  const appPathsSet = /* @__PURE__ */ new Set();
  const routePathsSet = /* @__PURE__ */ new Set();
  for (const [k, v] of Object.entries(AppPathRoutesManifest)) {
    if (k.endsWith("page")) {
      appPathsSet.add(v);
    } else if (k.endsWith("route")) {
      routePathsSet.add(v);
    }
  }
  return function matchRoute(path3) {
    const foundRoutes = regexp.filter((route) => route.regexp.test(path3));
    return foundRoutes.map((foundRoute) => {
      let routeType = "page";
      if (appPathsSet.has(foundRoute.page)) {
        routeType = "app";
      } else if (routePathsSet.has(foundRoute.page)) {
        routeType = "route";
      }
      return {
        route: foundRoute.page,
        type: routeType
      };
    });
  };
}
var staticRouteMatcher = routeMatcher([
  ...RoutesManifest.routes.static,
  ...getStaticAPIRoutes()
]);
var dynamicRouteMatcher = routeMatcher(RoutesManifest.routes.dynamic);
function getStaticAPIRoutes() {
  const createRouteDefinition = (route) => ({
    page: route,
    regex: `^${route}(?:/)?$`
  });
  const dynamicRoutePages = new Set(RoutesManifest.routes.dynamic.map(({ page }) => page));
  const pagesStaticAPIRoutes = Object.keys(PagesManifest).filter((route) => route.startsWith("/api/") && !dynamicRoutePages.has(route)).map(createRouteDefinition);
  const appPathsStaticAPIRoutes = Object.values(AppPathRoutesManifest).filter((route) => (route.startsWith("/api/") || route === "/api") && !dynamicRoutePages.has(route)).map(createRouteDefinition);
  return [...pagesStaticAPIRoutes, ...appPathsStaticAPIRoutes];
}

// node_modules/@opennextjs/aws/dist/core/routing/matcher.js
var routeHasMatcher = (headers, cookies, query) => (redirect) => {
  switch (redirect.type) {
    case "header":
      return !!headers?.[redirect.key.toLowerCase()] && new RegExp(redirect.value ?? "").test(headers[redirect.key.toLowerCase()] ?? "");
    case "cookie":
      return !!cookies?.[redirect.key] && new RegExp(redirect.value ?? "").test(cookies[redirect.key] ?? "");
    case "query":
      return query[redirect.key] && Array.isArray(redirect.value) ? redirect.value.reduce((prev, current) => prev || new RegExp(current).test(query[redirect.key]), false) : new RegExp(redirect.value ?? "").test(query[redirect.key] ?? "");
    case "host":
      return headers?.host !== "" && new RegExp(redirect.value ?? "").test(headers.host);
    default:
      return false;
  }
};
function checkHas(matcher, has, inverted = false) {
  return has ? has.reduce((acc, cur) => {
    if (acc === false)
      return false;
    return inverted ? !matcher(cur) : matcher(cur);
  }, true) : true;
}
var getParamsFromSource = (source) => (value) => {
  debug("value", value);
  const _match = source(value);
  return _match ? _match.params : {};
};
var computeParamHas = (headers, cookies, query) => (has) => {
  if (!has.value)
    return {};
  const matcher = new RegExp(`^${has.value}$`);
  const fromSource = (value) => {
    const matches = value.match(matcher);
    return matches?.groups ?? {};
  };
  switch (has.type) {
    case "header":
      return fromSource(headers[has.key.toLowerCase()] ?? "");
    case "cookie":
      return fromSource(cookies[has.key] ?? "");
    case "query":
      return Array.isArray(query[has.key]) ? fromSource(query[has.key].join(",")) : fromSource(query[has.key] ?? "");
    case "host":
      return fromSource(headers.host ?? "");
  }
};
function convertMatch(match2, toDestination, destination) {
  if (!match2) {
    return destination;
  }
  const { params } = match2;
  const isUsingParams = Object.keys(params).length > 0;
  return isUsingParams ? toDestination(params) : destination;
}
function getNextConfigHeaders(event, configHeaders) {
  if (!configHeaders) {
    return {};
  }
  const matcher = routeHasMatcher(event.headers, event.cookies, event.query);
  const requestHeaders = {};
  const localizedRawPath = localizePath(event);
  for (const { headers, has, missing, regex, source, locale } of configHeaders) {
    const path3 = locale === false ? event.rawPath : localizedRawPath;
    if (new RegExp(regex).test(path3) && checkHas(matcher, has) && checkHas(matcher, missing, true)) {
      const fromSource = match(source);
      const _match = fromSource(path3);
      headers.forEach((h) => {
        try {
          const key = convertMatch(_match, compile(h.key), h.key);
          const value = convertMatch(_match, compile(h.value), h.value);
          requestHeaders[key] = value;
        } catch {
          debug(`Error matching header ${h.key} with value ${h.value}`);
          requestHeaders[h.key] = h.value;
        }
      });
    }
  }
  return requestHeaders;
}
function handleRewrites(event, rewrites) {
  const { rawPath, headers, query, cookies, url } = event;
  const localizedRawPath = localizePath(event);
  const matcher = routeHasMatcher(headers, cookies, query);
  const computeHas = computeParamHas(headers, cookies, query);
  const rewrite = rewrites.find((route) => {
    const path3 = route.locale === false ? rawPath : localizedRawPath;
    return new RegExp(route.regex).test(path3) && checkHas(matcher, route.has) && checkHas(matcher, route.missing, true);
  });
  let finalQuery = query;
  let rewrittenUrl = url;
  const isExternalRewrite = isExternal(rewrite?.destination);
  debug("isExternalRewrite", isExternalRewrite);
  if (rewrite) {
    const { pathname, protocol, hostname, queryString } = getUrlParts(rewrite.destination, isExternalRewrite);
    const pathToUse = rewrite.locale === false ? rawPath : localizedRawPath;
    debug("urlParts", { pathname, protocol, hostname, queryString });
    const toDestinationPath = compile(escapeRegex(pathname, { isPath: true }));
    const toDestinationHost = compile(escapeRegex(hostname));
    const toDestinationQuery = compile(escapeRegex(queryString));
    const params = {
      // params for the source
      ...getParamsFromSource(match(escapeRegex(rewrite.source, { isPath: true })))(pathToUse),
      // params for the has
      ...rewrite.has?.reduce((acc, cur) => {
        return Object.assign(acc, computeHas(cur));
      }, {}),
      // params for the missing
      ...rewrite.missing?.reduce((acc, cur) => {
        return Object.assign(acc, computeHas(cur));
      }, {})
    };
    const isUsingParams = Object.keys(params).length > 0;
    let rewrittenQuery = queryString;
    let rewrittenHost = hostname;
    let rewrittenPath = pathname;
    if (isUsingParams) {
      rewrittenPath = unescapeRegex(toDestinationPath(params));
      rewrittenHost = unescapeRegex(toDestinationHost(params));
      rewrittenQuery = unescapeRegex(toDestinationQuery(params));
    }
    if (NextConfig.i18n && !isExternalRewrite) {
      const strippedPathLocale = rewrittenPath.replace(new RegExp(`^/(${NextConfig.i18n.locales.join("|")})`), "");
      if (strippedPathLocale.startsWith("/api/")) {
        rewrittenPath = strippedPathLocale;
      }
    }
    rewrittenUrl = isExternalRewrite ? `${protocol}//${rewrittenHost}${rewrittenPath}` : new URL(rewrittenPath, event.url).href;
    finalQuery = {
      ...query,
      ...convertFromQueryString(rewrittenQuery)
    };
    rewrittenUrl += convertToQueryString(finalQuery);
    debug("rewrittenUrl", { rewrittenUrl, finalQuery, isUsingParams });
  }
  return {
    internalEvent: {
      ...event,
      query: finalQuery,
      rawPath: new URL(rewrittenUrl).pathname,
      url: rewrittenUrl
    },
    __rewrite: rewrite,
    isExternalRewrite
  };
}
function handleRepeatedSlashRedirect(event) {
  if (event.rawPath.match(/(\\|\/\/)/)) {
    return {
      type: event.type,
      statusCode: 308,
      headers: {
        Location: normalizeRepeatedSlashes(new URL(event.url))
      },
      body: emptyReadableStream(),
      isBase64Encoded: false
    };
  }
  return false;
}
function handleTrailingSlashRedirect(event) {
  const url = new URL(event.rawPath, "http://localhost");
  if (
    // Someone is trying to redirect to a different origin, let's not do that
    url.host !== "localhost" || NextConfig.skipTrailingSlashRedirect || // We should not apply trailing slash redirect to API routes
    event.rawPath.startsWith("/api/")
  ) {
    return false;
  }
  const emptyBody = emptyReadableStream();
  if (NextConfig.trailingSlash && !event.headers["x-nextjs-data"] && !event.rawPath.endsWith("/") && !event.rawPath.match(/[\w-]+\.[\w]+$/g)) {
    const headersLocation = event.url.split("?");
    return {
      type: event.type,
      statusCode: 308,
      headers: {
        Location: `${headersLocation[0]}/${headersLocation[1] ? `?${headersLocation[1]}` : ""}`
      },
      body: emptyBody,
      isBase64Encoded: false
    };
  }
  if (!NextConfig.trailingSlash && event.rawPath.endsWith("/") && event.rawPath !== "/") {
    const headersLocation = event.url.split("?");
    return {
      type: event.type,
      statusCode: 308,
      headers: {
        Location: `${headersLocation[0].replace(/\/$/, "")}${headersLocation[1] ? `?${headersLocation[1]}` : ""}`
      },
      body: emptyBody,
      isBase64Encoded: false
    };
  }
  return false;
}
function handleRedirects(event, redirects) {
  const repeatedSlashRedirect = handleRepeatedSlashRedirect(event);
  if (repeatedSlashRedirect)
    return repeatedSlashRedirect;
  const trailingSlashRedirect = handleTrailingSlashRedirect(event);
  if (trailingSlashRedirect)
    return trailingSlashRedirect;
  const localeRedirect = handleLocaleRedirect(event);
  if (localeRedirect)
    return localeRedirect;
  const { internalEvent, __rewrite } = handleRewrites(event, redirects.filter((r) => !r.internal));
  if (__rewrite && !__rewrite.internal) {
    return {
      type: event.type,
      statusCode: __rewrite.statusCode ?? 308,
      headers: {
        Location: internalEvent.url
      },
      body: emptyReadableStream(),
      isBase64Encoded: false
    };
  }
}
function fixDataPage(internalEvent, buildId) {
  const { rawPath, query } = internalEvent;
  const basePath = NextConfig.basePath ?? "";
  const dataPattern = `${basePath}/_next/data/${buildId}`;
  if (rawPath.startsWith("/_next/data") && !rawPath.startsWith(dataPattern)) {
    return {
      type: internalEvent.type,
      statusCode: 404,
      body: toReadableStream("{}"),
      headers: {
        "Content-Type": "application/json"
      },
      isBase64Encoded: false
    };
  }
  if (rawPath.startsWith(dataPattern) && rawPath.endsWith(".json")) {
    const newPath = `${basePath}${rawPath.slice(dataPattern.length, -".json".length).replace(/^\/index$/, "/")}`;
    query.__nextDataReq = "1";
    return {
      ...internalEvent,
      rawPath: newPath,
      query,
      url: new URL(`${newPath}${convertToQueryString(query)}`, internalEvent.url).href
    };
  }
  return internalEvent;
}
function handleFallbackFalse(internalEvent, prerenderManifest) {
  const { rawPath } = internalEvent;
  const { dynamicRoutes = {}, routes = {} } = prerenderManifest ?? {};
  const prerenderedFallbackRoutes = Object.entries(dynamicRoutes).filter(([, { fallback }]) => fallback === false);
  const routeFallback = prerenderedFallbackRoutes.some(([, { routeRegex }]) => {
    const routeRegexExp = new RegExp(routeRegex);
    return routeRegexExp.test(rawPath);
  });
  const locales = NextConfig.i18n?.locales;
  const routesAlreadyHaveLocale = locales?.includes(rawPath.split("/")[1]) || // If we don't use locales, we don't need to add the default locale
  locales === void 0;
  let localizedPath = routesAlreadyHaveLocale ? rawPath : `/${NextConfig.i18n?.defaultLocale}${rawPath}`;
  if (
    // Not if localizedPath is "/" tho, because that would not make it find `isPregenerated` below since it would be try to match an empty string.
    localizedPath !== "/" && NextConfig.trailingSlash && localizedPath.endsWith("/")
  ) {
    localizedPath = localizedPath.slice(0, -1);
  }
  const matchedStaticRoute = staticRouteMatcher(localizedPath);
  const prerenderedFallbackRoutesName = prerenderedFallbackRoutes.map(([name]) => name);
  const matchedDynamicRoute = dynamicRouteMatcher(localizedPath).filter(({ route }) => !prerenderedFallbackRoutesName.includes(route));
  const isPregenerated = Object.keys(routes).includes(localizedPath);
  if (routeFallback && !isPregenerated && matchedStaticRoute.length === 0 && matchedDynamicRoute.length === 0) {
    return {
      event: {
        ...internalEvent,
        rawPath: "/404",
        url: constructNextUrl(internalEvent.url, "/404"),
        headers: {
          ...internalEvent.headers,
          "x-invoke-status": "404"
        }
      },
      isISR: false
    };
  }
  return {
    event: internalEvent,
    isISR: routeFallback || isPregenerated
  };
}

// node_modules/@opennextjs/aws/dist/core/routing/middleware.js
init_stream();
init_utils();
var middlewareManifest = MiddlewareManifest;
var functionsConfigManifest = FunctionsConfigManifest;
var middleMatch = getMiddlewareMatch(middlewareManifest, functionsConfigManifest);
var REDIRECTS = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
function defaultMiddlewareLoader() {
  return Promise.resolve().then(() => (init_edgeFunctionHandler(), edgeFunctionHandler_exports));
}
async function handleMiddleware(internalEvent, initialSearch, middlewareLoader = defaultMiddlewareLoader) {
  const headers = internalEvent.headers;
  if (headers["x-isr"] && headers["x-prerender-revalidate"] === PrerenderManifest?.preview?.previewModeId)
    return internalEvent;
  const normalizedPath = localizePath(internalEvent);
  const hasMatch = middleMatch.some((r) => r.test(normalizedPath));
  if (!hasMatch)
    return internalEvent;
  const initialUrl = new URL(normalizedPath, internalEvent.url);
  initialUrl.search = initialSearch;
  const url = initialUrl.href;
  const middleware = await middlewareLoader();
  const result = await middleware.default({
    // `geo` is pre Next 15.
    geo: {
      // The city name is percent-encoded.
      // See https://github.com/vercel/vercel/blob/4cb6143/packages/functions/src/headers.ts#L94C19-L94C37
      city: decodeURIComponent(headers["x-open-next-city"]),
      country: headers["x-open-next-country"],
      region: headers["x-open-next-region"],
      latitude: headers["x-open-next-latitude"],
      longitude: headers["x-open-next-longitude"]
    },
    headers,
    method: internalEvent.method || "GET",
    nextConfig: {
      basePath: NextConfig.basePath,
      i18n: NextConfig.i18n,
      trailingSlash: NextConfig.trailingSlash
    },
    url,
    body: convertBodyToReadableStream(internalEvent.method, internalEvent.body)
  });
  const statusCode = result.status;
  const responseHeaders = result.headers;
  const reqHeaders = {};
  const resHeaders = {};
  const filteredHeaders = [
    "x-middleware-override-headers",
    "x-middleware-next",
    "x-middleware-rewrite",
    // We need to drop `content-encoding` because it will be decoded
    "content-encoding"
  ];
  const xMiddlewareKey = "x-middleware-request-";
  responseHeaders.forEach((value, key) => {
    if (key.startsWith(xMiddlewareKey)) {
      const k = key.substring(xMiddlewareKey.length);
      reqHeaders[k] = value;
    } else {
      if (filteredHeaders.includes(key.toLowerCase()))
        return;
      if (key.toLowerCase() === "set-cookie") {
        resHeaders[key] = resHeaders[key] ? [...resHeaders[key], value] : [value];
      } else if (REDIRECTS.has(statusCode) && key.toLowerCase() === "location") {
        resHeaders[key] = normalizeLocationHeader(value, internalEvent.url);
      } else {
        resHeaders[key] = value;
      }
    }
  });
  const rewriteUrl = responseHeaders.get("x-middleware-rewrite");
  let isExternalRewrite = false;
  let middlewareQuery = internalEvent.query;
  let newUrl = internalEvent.url;
  if (rewriteUrl) {
    newUrl = rewriteUrl;
    if (isExternal(newUrl, internalEvent.headers.host)) {
      isExternalRewrite = true;
    } else {
      const rewriteUrlObject = new URL(rewriteUrl);
      middlewareQuery = getQueryFromSearchParams(rewriteUrlObject.searchParams);
      if ("__nextDataReq" in internalEvent.query) {
        middlewareQuery.__nextDataReq = internalEvent.query.__nextDataReq;
      }
    }
  }
  if (!rewriteUrl && !responseHeaders.get("x-middleware-next")) {
    const body = result.body ?? emptyReadableStream();
    return {
      type: internalEvent.type,
      statusCode,
      headers: resHeaders,
      body,
      isBase64Encoded: false
    };
  }
  return {
    responseHeaders: resHeaders,
    url: newUrl,
    rawPath: new URL(newUrl).pathname,
    type: internalEvent.type,
    headers: { ...internalEvent.headers, ...reqHeaders },
    body: internalEvent.body,
    method: internalEvent.method,
    query: middlewareQuery,
    cookies: internalEvent.cookies,
    remoteAddress: internalEvent.remoteAddress,
    isExternalRewrite,
    rewriteStatusCode: rewriteUrl && !isExternalRewrite ? statusCode : void 0
  };
}

// node_modules/@opennextjs/aws/dist/core/routingHandler.js
var MIDDLEWARE_HEADER_PREFIX = "x-middleware-response-";
var MIDDLEWARE_HEADER_PREFIX_LEN = MIDDLEWARE_HEADER_PREFIX.length;
var INTERNAL_HEADER_PREFIX = "x-opennext-";
var INTERNAL_HEADER_INITIAL_URL = `${INTERNAL_HEADER_PREFIX}initial-url`;
var INTERNAL_HEADER_LOCALE = `${INTERNAL_HEADER_PREFIX}locale`;
var INTERNAL_HEADER_RESOLVED_ROUTES = `${INTERNAL_HEADER_PREFIX}resolved-routes`;
var INTERNAL_HEADER_REWRITE_STATUS_CODE = `${INTERNAL_HEADER_PREFIX}rewrite-status-code`;
var INTERNAL_EVENT_REQUEST_ID = `${INTERNAL_HEADER_PREFIX}request-id`;
var geoHeaderToNextHeader = {
  "x-open-next-city": "x-vercel-ip-city",
  "x-open-next-country": "x-vercel-ip-country",
  "x-open-next-region": "x-vercel-ip-country-region",
  "x-open-next-latitude": "x-vercel-ip-latitude",
  "x-open-next-longitude": "x-vercel-ip-longitude"
};
function applyMiddlewareHeaders(eventOrResult, middlewareHeaders) {
  const isResult = isInternalResult(eventOrResult);
  const headers = eventOrResult.headers;
  const keyPrefix = isResult ? "" : MIDDLEWARE_HEADER_PREFIX;
  Object.entries(middlewareHeaders).forEach(([key, value]) => {
    if (value) {
      headers[keyPrefix + key] = Array.isArray(value) ? value.join(",") : value;
    }
  });
}
async function routingHandler(event, { assetResolver }) {
  try {
    for (const [openNextGeoName, nextGeoName] of Object.entries(geoHeaderToNextHeader)) {
      const value = event.headers[openNextGeoName];
      if (value) {
        event.headers[nextGeoName] = value;
      }
    }
    for (const key of Object.keys(event.headers)) {
      if (key.startsWith(INTERNAL_HEADER_PREFIX) || key.startsWith(MIDDLEWARE_HEADER_PREFIX)) {
        delete event.headers[key];
      }
    }
    let headers = getNextConfigHeaders(event, ConfigHeaders);
    let eventOrResult = fixDataPage(event, BuildId);
    if (isInternalResult(eventOrResult)) {
      return eventOrResult;
    }
    const redirect = handleRedirects(eventOrResult, RoutesManifest.redirects);
    if (redirect) {
      redirect.headers.Location = normalizeLocationHeader(redirect.headers.Location, event.url, true);
      debug("redirect", redirect);
      return redirect;
    }
    const middlewareEventOrResult = await handleMiddleware(
      eventOrResult,
      // We need to pass the initial search without any decoding
      // TODO: we'd need to refactor InternalEvent to include the initial querystring directly
      // Should be done in another PR because it is a breaking change
      new URL(event.url).search
    );
    if (isInternalResult(middlewareEventOrResult)) {
      return middlewareEventOrResult;
    }
    const middlewareHeadersPrioritized = globalThis.openNextConfig.dangerous?.middlewareHeadersOverrideNextConfigHeaders ?? false;
    if (middlewareHeadersPrioritized) {
      headers = {
        ...headers,
        ...middlewareEventOrResult.responseHeaders
      };
    } else {
      headers = {
        ...middlewareEventOrResult.responseHeaders,
        ...headers
      };
    }
    let isExternalRewrite = middlewareEventOrResult.isExternalRewrite ?? false;
    eventOrResult = middlewareEventOrResult;
    if (!isExternalRewrite) {
      const beforeRewrite = handleRewrites(eventOrResult, RoutesManifest.rewrites.beforeFiles);
      eventOrResult = beforeRewrite.internalEvent;
      isExternalRewrite = beforeRewrite.isExternalRewrite;
      if (!isExternalRewrite) {
        const assetResult = await assetResolver?.maybeGetAssetResult?.(eventOrResult);
        if (assetResult) {
          applyMiddlewareHeaders(assetResult, headers);
          return assetResult;
        }
      }
    }
    const foundStaticRoute = staticRouteMatcher(eventOrResult.rawPath);
    const isStaticRoute = !isExternalRewrite && foundStaticRoute.length > 0;
    if (!(isStaticRoute || isExternalRewrite)) {
      const afterRewrite = handleRewrites(eventOrResult, RoutesManifest.rewrites.afterFiles);
      eventOrResult = afterRewrite.internalEvent;
      isExternalRewrite = afterRewrite.isExternalRewrite;
    }
    let isISR = false;
    if (!isExternalRewrite) {
      const fallbackResult = handleFallbackFalse(eventOrResult, PrerenderManifest);
      eventOrResult = fallbackResult.event;
      isISR = fallbackResult.isISR;
    }
    const foundDynamicRoute = dynamicRouteMatcher(eventOrResult.rawPath);
    const isDynamicRoute = !isExternalRewrite && foundDynamicRoute.length > 0;
    if (!(isDynamicRoute || isStaticRoute || isExternalRewrite)) {
      const fallbackRewrites = handleRewrites(eventOrResult, RoutesManifest.rewrites.fallback);
      eventOrResult = fallbackRewrites.internalEvent;
      isExternalRewrite = fallbackRewrites.isExternalRewrite;
    }
    const isNextImageRoute = eventOrResult.rawPath.startsWith("/_next/image");
    const isRouteFoundBeforeAllRewrites = isStaticRoute || isDynamicRoute || isExternalRewrite;
    if (!(isRouteFoundBeforeAllRewrites || isNextImageRoute || // We need to check again once all rewrites have been applied
    staticRouteMatcher(eventOrResult.rawPath).length > 0 || dynamicRouteMatcher(eventOrResult.rawPath).length > 0)) {
      eventOrResult = {
        ...eventOrResult,
        rawPath: "/404",
        url: constructNextUrl(eventOrResult.url, "/404"),
        headers: {
          ...eventOrResult.headers,
          "x-middleware-response-cache-control": "private, no-cache, no-store, max-age=0, must-revalidate"
        }
      };
    }
    if (globalThis.openNextConfig.dangerous?.enableCacheInterception && !isInternalResult(eventOrResult)) {
      debug("Cache interception enabled");
      eventOrResult = await cacheInterceptor(eventOrResult);
      if (isInternalResult(eventOrResult)) {
        applyMiddlewareHeaders(eventOrResult, headers);
        return eventOrResult;
      }
    }
    applyMiddlewareHeaders(eventOrResult, headers);
    const resolvedRoutes = [
      ...foundStaticRoute,
      ...foundDynamicRoute
    ];
    debug("resolvedRoutes", resolvedRoutes);
    return {
      internalEvent: eventOrResult,
      isExternalRewrite,
      origin: false,
      isISR,
      resolvedRoutes,
      initialURL: event.url,
      locale: NextConfig.i18n ? detectLocale(eventOrResult, NextConfig.i18n) : void 0,
      rewriteStatusCode: middlewareEventOrResult.rewriteStatusCode
    };
  } catch (e) {
    error("Error in routingHandler", e);
    return {
      internalEvent: {
        type: "core",
        method: "GET",
        rawPath: "/500",
        url: constructNextUrl(event.url, "/500"),
        headers: {
          ...event.headers
        },
        query: event.query,
        cookies: event.cookies,
        remoteAddress: event.remoteAddress
      },
      isExternalRewrite: false,
      origin: false,
      isISR: false,
      resolvedRoutes: [],
      initialURL: event.url,
      locale: NextConfig.i18n ? detectLocale(event, NextConfig.i18n) : void 0
    };
  }
}
function isInternalResult(eventOrResult) {
  return eventOrResult != null && "statusCode" in eventOrResult;
}

// node_modules/@opennextjs/aws/dist/adapters/middleware.js
globalThis.internalFetch = fetch;
globalThis.__openNextAls = new AsyncLocalStorage();
var defaultHandler = async (internalEvent, options) => {
  const middlewareConfig = globalThis.openNextConfig.middleware;
  const originResolver = await resolveOriginResolver(middlewareConfig?.originResolver);
  const externalRequestProxy = await resolveProxyRequest(middlewareConfig?.override?.proxyExternalRequest);
  const assetResolver = await resolveAssetResolver(middlewareConfig?.assetResolver);
  const requestId = Math.random().toString(36);
  return runWithOpenNextRequestContext({
    isISRRevalidation: internalEvent.headers["x-isr"] === "1",
    waitUntil: options?.waitUntil,
    requestId
  }, async () => {
    const result = await routingHandler(internalEvent, { assetResolver });
    if ("internalEvent" in result) {
      debug("Middleware intercepted event", internalEvent);
      if (!result.isExternalRewrite) {
        const origin = await originResolver.resolve(result.internalEvent.rawPath);
        return {
          type: "middleware",
          internalEvent: {
            ...result.internalEvent,
            headers: {
              ...result.internalEvent.headers,
              [INTERNAL_HEADER_INITIAL_URL]: internalEvent.url,
              [INTERNAL_HEADER_RESOLVED_ROUTES]: JSON.stringify(result.resolvedRoutes),
              [INTERNAL_EVENT_REQUEST_ID]: requestId,
              [INTERNAL_HEADER_REWRITE_STATUS_CODE]: String(result.rewriteStatusCode)
            }
          },
          isExternalRewrite: result.isExternalRewrite,
          origin,
          isISR: result.isISR,
          initialURL: result.initialURL,
          resolvedRoutes: result.resolvedRoutes
        };
      }
      try {
        return externalRequestProxy.proxy(result.internalEvent);
      } catch (e) {
        error("External request failed.", e);
        return {
          type: "middleware",
          internalEvent: {
            ...result.internalEvent,
            headers: {
              ...result.internalEvent.headers,
              [INTERNAL_EVENT_REQUEST_ID]: requestId
            },
            rawPath: "/500",
            url: constructNextUrl(result.internalEvent.url, "/500"),
            method: "GET"
          },
          // On error we need to rewrite to the 500 page which is an internal rewrite
          isExternalRewrite: false,
          origin: false,
          isISR: result.isISR,
          initialURL: result.internalEvent.url,
          resolvedRoutes: [{ route: "/500", type: "page" }]
        };
      }
    }
    if (process.env.OPEN_NEXT_REQUEST_ID_HEADER || globalThis.openNextDebug) {
      result.headers[INTERNAL_EVENT_REQUEST_ID] = requestId;
    }
    debug("Middleware response", result);
    return result;
  });
};
var handler2 = await createGenericHandler({
  handler: defaultHandler,
  type: "middleware"
});
var middleware_default = {
  fetch: handler2
};
export {
  middleware_default as default,
  handler2 as handler
};
