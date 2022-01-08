import {HttpClient, HttpHeaders, HttpParams} from "@angular/common/http";
import {Injectable} from "@angular/core";
import {timeout} from "rxjs/operators";
import {PlainObject} from "./appService";

export type HttpMethod = 'get' | 'post' | 'put' | 'delete';

export interface HttpSimpleObject {
  [key: string]: string
}

export interface AppHttpResponse {
  success: boolean,
  code: number,
  headers: HttpHeaders,
  body: string | null,
}

export interface AppHttpRequest {
  method: HttpMethod,
  url: string,
  data: object | undefined,
  headers: HttpSimpleObject | undefined,
  payload: HttpSimpleObject | string | undefined,
  timeout?: number
}

@Injectable({providedIn: "root"})

/**
 * Http service
 */
export class HttpService {
  public constructor(private client: HttpClient) {
  }

  /**
   * RFC3986 compatible encodeURIComponent
   * @param str
   */
  public encodeURIComponent(str: string): string {
    return encodeURIComponent(str).replace(/[!'()*]/g, function (c: string) {
      return '%' + c.charCodeAt(0).toString(16);
    });
  }

  /**
   * Sends request with HTTP GET method
   * @param req
   */
  public get(req: AppHttpRequest): Promise<AppHttpResponse> {
    return this.create("get", req);
  }

  /**
   * Sends request with HTTP POST method
   * @param req
   */
  public post(req: AppHttpRequest): Promise<AppHttpResponse> {
    return this.create("post", req);
  }

  /**
   * Alias for request()
   * @param req
   */
  public send(req: AppHttpRequest): Promise<AppHttpResponse> {
    return this.sendHttpRequest(req);
  }

  /**
   * @param method
   * @param req
   */
  private create(method: HttpMethod, req: AppHttpRequest): Promise<AppHttpResponse> {
    req.method = method;
    return this.sendHttpRequest(req);
  }

  /**
   *
   * @param req
   * @private
   */
  private sendHttpRequest(req: AppHttpRequest): Promise<AppHttpResponse> {
    // Headers
    let headers = new HttpHeaders();
    if (req.headers) {
      for (let header in req.headers) {
        if (req.headers.hasOwnProperty(header)) {
          headers = headers.append(header, req.headers[header]);
        }
      }
    }

    // Payload
    let body: string | undefined;
    let params: HttpParams | undefined;
    if (typeof req.payload === "string") {
      body = req.payload;
    } else if (typeof req.payload === "object") {
      let httpParams = new HttpParams();
      for (let param in req.payload) {
        if (req.payload.hasOwnProperty(param)) {
          httpParams = httpParams.append(param, req.payload[param]);
        }
      }

      params = httpParams;
    }

    // Timeout
    let timeOut = req.timeout ? req.timeout : 30000;

    // Send actual request
    return new Promise<AppHttpResponse>((completed) => {
      this.client.request(req.method, req.url, {
        headers: headers,
        observe: 'response',
        body: body,
        params: params,
        reportProgress: false,
        responseType: 'text',
        withCredentials: false
      }).pipe(timeout(timeOut)).subscribe(res => {
        completed(<AppHttpResponse>{
          success: true,
          code: res.status,
          headers: res.headers,
          body: res.body
        });
      }, error => {
        completed(<AppHttpResponse>{
          success: false,
          code: error.status,
          headers: error.headers,
          body: error.error
        });
      });
    });
  }
}
