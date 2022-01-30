type InterposeFunction<Prop, ReturnValue> = (prop: Prop) => ReturnValue;

type ResponseWithData = Response & {
  data: any;
};

export enum HttpMethod {
  get = "GET",
  post = "POST"
}

interface DefaultOptions {
  baseUrl?: URL;
  headers?: Headers;
}

type FetchiumRequestOptions = Omit<RequestInit, "method" | "body"> & {
  params?: URLSearchParams;
  data?: any;
};

const defaultHeaders = new Headers({
  "Content-Type": "application/json; charset=UTF-8",
  "Accept": "application/json"
});

const isAbsoluteURL = (url: string) => /^[a-z][a-z0-9+.-]*:/.test(url);

const combineUrls = (basePath: URL, relativePath: string) =>
  `${basePath.toString().replace(/\/+$/, "")}/${relativePath.replace(/^\//, "")}`;

export default function compose<T>(...funcs: any[]): T {
  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce((a, b) => (...args: any) => a(b(...args)));
}

class Fetchium {
  defaultOptions: DefaultOptions = {};

  private requestInterposers: InterposeFunction<
    FetchiumRequestOptions,
    FetchiumRequestOptions | null
    > = () => null;
  private responseInterposers: InterposeFunction<any, any> = () => {};

  constructor(baseUrl?: string, headers: Headers = defaultHeaders) {
    this.defaultOptions.baseUrl = new URL(baseUrl);
    this.defaultOptions.headers = headers;
  }

  public composeRequestInterposers(
    ...reqInt: InterposeFunction<
      FetchiumRequestOptions,
      FetchiumRequestOptions
      >[]
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

  private buildUrl(path: string, params: any): string {
    const url =
      isAbsoluteURL(path) || !this.defaultOptions.baseUrl
        ? path
        : combineUrls(this.defaultOptions.baseUrl, path);

    if (!params) {
      return url;
    }

    const fullUrl = new URL(url);
    fullUrl.search = new URLSearchParams(params).toString();

    return fullUrl.toString();
  }

  private async request<T>(
    url: string,
    method: HttpMethod,
    options?: FetchiumRequestOptions
  ): Promise<T> {
      const config = this.requestInterposers(options);
      const completeUrl = this.buildUrl(url, config?.params);

      const request = new Request(completeUrl, {
        method: method,
        headers: config?.headers ?? this.defaultOptions.headers,
        ...(config?.data ? { body: JSON.stringify(config.data) } : null),
        ...(config)
      });

      return fetch(request)
      .then((res) => {
        return this.response<T>(res);
      })
      .catch((err) => {
        throw err;
      })
  }

  private async response<T>(response: Response): Promise<T> {
      return new Promise(async (resolve, reject) => {
        if (!response.ok) {
          reject(response.statusText);
        }

        const data = await response.json();

        resolve(this.responseInterposers(data));
      })
  }

  async get<T>(
    url: string,
    options?: FetchiumRequestOptions
  ): Promise<T | void> {
    return this.request<T>(url, HttpMethod.get, options);
  }
}
