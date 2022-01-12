import {stringify} from "qs";

type ApiClientFetchOptions = Omit<RequestInit, "method" | "body"> & {
  params: any;
};

type InterposedFunction<Prop, ReturnValue> = (prop: Prop) => ReturnValue;

type ResponseWithData = Response & {
  data: any;
};

const RequestInitKeys: Array<keyof RequestInit> = [
  // "body",
  "cache",
  "credentials",
  "headers",
  "integrity",
  "keepalive",
  "method",
  "mode",
  "redirect",
  "referrer",
  "referrerPolicy",
  "signal",
  "window"
];

const getExtractedRequestInit = (options: any): RequestInit =>
  RequestInitKeys.reduce((requestInitObject: RequestInit, currentKey) => {
    if (options.hasOwnProperty(currentKey)) {
      // @ts-ignore
      requestInitObject[currentKey] = options[currentKey];
    }

    return requestInitObject;
  }, {});

const api = {
  defaultOptions: {},
  interpose: {
    request: (options: RequestInit): RequestInit => options,
    response: (responseWithData: ResponseWithData) => responseWithData.data,

    intoRequest(callback: InterposedFunction<RequestInit, RequestInit>) {
      this.request = callback;
    },
    intoResponse(callback: InterposedFunction<ResponseWithData, any>) {
      this.response = callback;
    }
  },
  async onRequest<ResponseData>(url: string, options: RequestInit) {
    try {
      const processedOptions = this.interpose.request(options);

      const response = await fetch(url, {
        ...processedOptions
      });

      return this.onResponse(response);
    } catch (e) {
      console.log(e);
    }
  },

  async onResponse<ResponseData>(response: Response) {
    try {
      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const data = await response.json();

      return this.interpose.response({...response, data});
    } catch (e) {
      console.log(e);
    }
  },

  get<ResponseData>(url: string, options?: ApiClientFetchOptions): ResponseData {
    let processedUrl = url;

    if (options?.params) {
      processedUrl = `${url}?${stringify(options.params, {
        arrayFormat: "comma"
      })}`;
    }

    return this.onRequest(processedUrl, {
      method: "GET",
      ...(options ? getExtractedRequestInit(options) : null)
    });
  },

  post(url: string, options?: ApiClientFetchOptions) {
    if (options?.params) {
    }

    return this.onRequest(url, {
      method: "post",
      body: JSON.stringify(options.params),
      ...(options ? getExtractedRequestInit(options) : null)
    });
  }
};

api.interpose.intoRequest((config) => {
  return config;
});

api.interpose.intoResponse((response) => {
  console.log("interposedResponse");
  return response.data;
});

type Test = {
  test: 3,
}

const apiClient = {
};

export default apiClient;
