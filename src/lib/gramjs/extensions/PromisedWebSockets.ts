import { Mutex } from 'async-mutex';

const mutex = new Mutex();

const closeError = new Error('WebSocket was closed');
const CONNECTION_TIMEOUT = 3000;
const MAX_TIMEOUT = 30000;

// Regex to match Telegram WebSocket hostnames
const TELEGRAM_WS_HOST_PATTERN = /^[a-z0-9-]+\.(?:web\.)?telegram\.org$/i;

/**
 * Reads proxy settings from the worker's `self` context.
 * These are set by client.ts during initApi from localStorage values.
 */
function getProxyConfig(): { enabled: boolean; domain: string } {
  try {
    const enabled = Boolean((self as any).proxyEnabled);
    let domain = ((self as any).proxyUrl || '') as string;
    // Clean the domain: strip protocol prefixes and trailing slashes
    domain = domain
      .replace(/^https?:\/\//i, '')
      .replace(/^wss?:\/\//i, '')
      .replace(/\/+$/, '');
    return { enabled, domain };
  } catch {
    return { enabled: false, domain: '' };
  }
}

export default class PromisedWebSockets {
  private closed: boolean;

  private timeout: number;

  private stream: Buffer;

  private canRead?: boolean | Promise<boolean>;

  private resolveRead: ((value?: any) => void) | undefined;

  private client: WebSocket | undefined;

  private website?: string;

  private disconnectedCallback: () => void;

  constructor(disconnectedCallback: () => void) {
    this.client = undefined;
    this.closed = true;
    this.stream = Buffer.alloc(0);
    this.disconnectedCallback = disconnectedCallback;
    this.timeout = CONNECTION_TIMEOUT;
  }

  async readExactly(number: number) {
    let readData = Buffer.alloc(0);

    while (true) {
      const thisTime = await this.read(number);
      readData = Buffer.concat([readData, thisTime]);
      number -= thisTime.length;
      if (!number) {
        return readData;
      }
    }
  }

  async read(number: number) {
    if (this.closed) {
      throw closeError;
    }
    await this.canRead;
    if (this.closed) {
      throw closeError;
    }
    const toReturn = this.stream.slice(0, number);
    this.stream = this.stream.slice(number);
    if (this.stream.length === 0) {
      this.canRead = new Promise((resolve) => {
        this.resolveRead = resolve;
      });
    }

    return toReturn;
  }

  async readAll() {
    if (this.closed || !await this.canRead) {
      throw closeError;
    }
    const toReturn = this.stream;
    this.stream = Buffer.alloc(0);
    this.canRead = new Promise((resolve) => {
      this.resolveRead = resolve;
    });

    return toReturn;
  }

  getWebSocketLink(ip: string, port: number, isTestServer?: boolean, isPremium?: boolean) {
    if (port === 443) {
      return `wss://${ip}:${port}/apiws${isTestServer ? '_test' : ''}${isPremium ? '_premium' : ''}`;
    } else {
      return `ws://${ip}:${port}/apiws${isTestServer ? '_test' : ''}${isPremium ? '_premium' : ''}`;
    }
  }

  connect(port: number, ip: string, isTestServer = false, isPremium = false) {
    this.stream = Buffer.alloc(0);
    this.canRead = new Promise((resolve) => {
      this.resolveRead = resolve;
    });
    this.closed = false;
    this.website = this.getWebSocketLink(ip, port, isTestServer, isPremium);

    // Check if proxy is enabled and the host is a Telegram domain
    const proxy = getProxyConfig();
    if (proxy.enabled && proxy.domain && TELEGRAM_WS_HOST_PATTERN.test(ip)) {
      // Route through the proxy worker:
      // Original: wss://zws1.web.telegram.org:443/apiws
      // Proxied:  wss://<proxy-domain>/zws1.web.telegram.org/apiws
      const path = `/apiws${isTestServer ? '_test' : ''}${isPremium ? '_premium' : ''}`;
      const proxyUrl = `wss://${proxy.domain}/${ip}${path}`;
      // eslint-disable-next-line no-console
      console.log(`[Proxy] 🌐 Routing ${ip}${path} → ${proxy.domain}`);
      this.website = proxyUrl;
      // CF Workers WebSocketPair doesn't support subprotocol negotiation, so omit 'binary'
      this.client = new WebSocket(proxyUrl);
    } else {
      this.client = new WebSocket(this.website, 'binary');
    }
    return new Promise((resolve, reject) => {
      if (!this.client) return;
      let hasResolved = false;
      let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
      this.client.onopen = () => {
        this.receive();
        resolve(this);
        hasResolved = true;
        if (timeout) clearTimeout(timeout);
      };
      this.client.onerror = (error) => {
        // eslint-disable-next-line no-console
        console.error('WebSocket error', error);
        reject(error);
        hasResolved = true;
        if (timeout) clearTimeout(timeout);
      };
      this.client.onclose = (event) => {
        const { code, reason, wasClean } = event;
        if (code !== 1000) {
          // eslint-disable-next-line no-console
          console.error(`Socket ${ip} closed. Code: ${code}, reason: ${reason}, was clean: ${wasClean}`);
        }

        this.resolveRead?.(false);
        this.closed = true;
        if (this.disconnectedCallback) {
          this.disconnectedCallback();
        }
        hasResolved = true;
        if (timeout) clearTimeout(timeout);
      };

      timeout = setTimeout(() => {
        if (hasResolved) return;

        reject(new Error('WebSocket connection timeout'));
        this.resolveRead?.(false);
        this.closed = true;
        if (this.disconnectedCallback) {
          this.disconnectedCallback();
        }
        this.client?.close();
        this.timeout *= 2;
        this.timeout = Math.min(this.timeout, MAX_TIMEOUT);
        timeout = undefined;
      }, this.timeout);

      // CONTEST
      // Seems to not be working, at least in a web worker

      self.addEventListener('offline', () => {
        this.close();
        this.resolveRead?.(false);
      });
    });
  }

  write(data: Buffer<ArrayBuffer>) {
    if (this.closed) {
      throw closeError;
    }
    this.client?.send(data);
  }

  close() {
    this.client?.close();
    this.closed = true;
  }

  receive() {
    if (!this.client) return;
    this.client.onmessage = async (message) => {
      await mutex.runExclusive(async () => {
        const data = message.data instanceof ArrayBuffer
          ? Buffer.from(message.data)
          : Buffer.from(await new Response(message.data).arrayBuffer());
        this.stream = Buffer.concat([this.stream, data]);
        this.resolveRead?.(true);
      });
    };
  }
}
