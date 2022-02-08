type InterposeFunction<Prop, ReturnValue> = (prop: Prop) => ReturnValue;

type ResponseWithData = Response & {
  data: any;
};

const RequestInitKeys: Array<keyof RequestInit> = [
  "cache",
  "credentials",
  "integrity",
  "keepalive",
  "mode",
  "redirect",
  "referrer",
  "referrerPolicy",
  "signal",
  "window"
];
// "body",

// "headers",

// "method",

const getExtractedRequestInit = (options: any): RequestInit =>
  RequestInitKeys.reduce((requestInitObject: RequestInit, currentKey: string) => {
    if (options.hasOwnProperty(currentKey)) {
      requestInitObject[currentKey] = options[currentKey];
    }

    return requestInitObject;
  }, {});

const getResponseData = (body: any) => {
  if (body instanceof FormData) {
    return body;
  }

  return JSON.stringify(body);
};

export enum HttpMethod {
  get = "GET",
  post = "POST"
}

export interface RequestBody {
  [key: string]: any;
}

export interface Headers {
  [key: string]: string;
}

export interface QueryStringParams {
  [key: string]: any;
}

interface DefaultOptions {
  baseUrl?: string | null;
  headers?: Headers;
}

type FetchiumRequestOptions = Omit<RequestInit, "method" | "body"> & {
  params?: QueryStringParams;
  data?: any;
};

const defaultHeaders = {
  "Content-Type": "application/json; charset=UTF-8",
  Accept: "application/json"
};

const isAbsoluteURL = (url: string) => /^[a-z][a-z0-9+.-]*:/.test(url);

const combineUrls = (basePath: string, relativePath: string) =>
  `${basePath.replace(/\/+$/, "")}/${relativePath.replace(/^\//, "")}`;

export default function compose<T>(...funcs: any[]): T {
  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce((a, b) => (...args: any) => a(b(...args)));
}

class Fetchium {
  defaultOptions: DefaultOptions = {};

  private requestInterposers: InterposeFunction<FetchiumRequestOptions, FetchiumRequestOptions | null> = () => null;

  private responseInterposers: InterposeFunction<any, any> = () => {};

  private errorInterposers: any = () => {};

  constructor(baseUrl?: string, headers: Headers = defaultHeaders) {
    this.defaultOptions.baseUrl = baseUrl ?? null;
    this.defaultOptions.headers = headers;
  }

  public composeRequestInterposers(
    ...reqInt: InterposeFunction<FetchiumRequestOptions,
      FetchiumRequestOptions>[]
  ) {
    this.requestInterposers = compose(...reqInt);
    return this;
  }

  public composeResponseInterposers(
    ...responseInterposerFuncs: InterposeFunction<any, any>[]
  ) {
    this.responseInterposers = compose(...responseInterposerFuncs);
    return this;
  }

  public composeErrorInterposers(
    ...responseErrorFuncs: any[]
  ) {
    this.errorInterposers = compose(...responseErrorFuncs);
    return this;
  }

  private buildUrl(path: string, params: any): string {
    const url = isAbsoluteURL(path) || !this.defaultOptions.baseUrl
      ? path
      : combineUrls(this.defaultOptions.baseUrl, path);

    if (!params) {
      return url;
    }

    const fullUrl = new URL(url);
    fullUrl.search = new URLSearchParams(params).toString();

    return fullUrl.toString();
  }

  private buildHeaders = (headers: HeadersInit): HeadersInit => {
    const requestHeaders: HeadersInit = new Headers();
    Object.entries(headers).forEach(([key, value]) => {
      requestHeaders.set(key, value);
    });

    return requestHeaders;
  };

  private async request<T>(
    url: string,
    method: HttpMethod,
    options?: FetchiumRequestOptions,
  ): Promise<T> {
    try {
      const config = this.requestInterposers({ ...this.defaultOptions, ...options });
      const completeUrl = this.buildUrl(url, config?.params);

      const headers = this.buildHeaders(config.headers);

      const request = new Request(completeUrl, {
        method,
        headers,
        ...(config?.data ? { body: getResponseData(config.data) } : null),
        ...(config ? getExtractedRequestInit(config) : null),
      });

      const response = await fetch(request);

      // This really important disable, cause we don`t must await response func
      // eslint-disable-next-line @typescript-eslint/return-await
      return this.response<T>(response);
    } catch (e) {
      console.log('request Error', e);
      return e;
    }
  }

  private async response<T>(response: Response): Promise<T> {
    try {
      if (!response.ok) {
        this.errorInterposers(response);

        // ¯\_(ツ)_/¯
        // eslint-disable-next-line @typescript-eslint/return-await
        return new Promise((resolve, reject) => {
          reject(response);
        });
      }

      const data = await response.json();

      return this.responseInterposers(data);
    } catch (e) {
      console.log('response Error: ', e);
      return (e);
    }
  }

  async get<T>(
    url: string,
    options?: FetchiumRequestOptions,
  ): Promise<T | void> {
    return this.request<T>(url, HttpMethod.get, options);
  }

  post<T>(url, options?: FetchiumRequestOptions): Promise<T> {
    return this.request(url, HttpMethod.post, options);
  }
}

