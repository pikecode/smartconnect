// Base global types for WeChat miniprogram (fallback when npm not installed)

// Allow any key on App/Page/Component for custom methods
declare function App<T extends Record<string, unknown>>(options: T & ThisType<T>): void;
declare function Component<T extends Record<string, unknown>, D extends Record<string, unknown>, M extends Record<string, unknown>>(options: WechatMiniprogram.Component.Options<T, D, M>): void;
declare function Page<TData extends Record<string, unknown>, TCustom extends Record<string, unknown>>(options: WechatMiniprogram.Page.Options<TData, TCustom> & ThisType<WechatMiniprogram.Page.Instance<TData, TCustom> & TCustom>): void;

declare function getApp<T extends Record<string, unknown> = Record<string, unknown>>(): T;
declare function getCurrentPages(): WechatMiniprogram.Page.Instance<Record<string, unknown>, Record<string, unknown>>[];

declare namespace WechatMiniprogram {
  interface TouchEvent {
    currentTarget: { dataset: Record<string, unknown>; id?: string };
    target: { dataset: Record<string, unknown>; id?: string };
    detail: { value?: string };
  }

  interface Input { detail: { value: string } }

  namespace Page {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Options<TData extends Record<string, unknown>, TCustom extends Record<string, unknown>> {
      data?: TData;
      onLoad?: (options: Record<string, string | undefined>) => void;
      onShow?: () => void;
      onPullDownRefresh?: () => void;
      [key: string]: unknown;
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Instance<TData extends Record<string, unknown>, TCustom extends Record<string, unknown>> {
      setData(data: Partial<TData> & Record<string, unknown>, callback?: () => void): void;
      route: string;
      [key: string]: unknown;
    }
  }

  namespace Component {
    interface Options<T extends Record<string, unknown>, D extends Record<string, unknown>, M extends Record<string, unknown>> {
      properties?: Record<string, unknown>;
      data?: D;
      methods?: M;
      observers?: Record<string, (...args: unknown[]) => void>;
    }
  }
}

declare namespace wx {
  function getStorageSync<T = unknown>(key: string): T;
  function setStorageSync(key: string, value: unknown): void;
  function removeStorageSync(key: string): void;
  function navigateTo(opts: { url: string }): void;
  function showToast(opts: { title: string; icon?: string }): void;
  function login(opts: { success?: (res: { code: string }) => void; fail?: (e: unknown) => void }): void;
  function request(opts: {
    url: string; method?: string; data?: unknown;
    header?: Record<string, string>;
    success?: (res: { data: unknown; statusCode: number }) => void;
    fail?: (e: unknown) => void;
  }): void;
  function stopPullDownRefresh(): void;
  function setClipboardData(opts: { data: string }): void;
}
