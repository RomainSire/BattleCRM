import type { Alert } from '../src/alert.ts';
import type { Hibp } from '../src/auth/index.ts';
import type { Clock } from '../src/clock.ts';
import type { EmailMessage, EmailTransport } from '../src/email/index.ts';
import { cryptoRandom, type Random } from '../src/random.ts';

export type TestClock = Clock & {
  /** Moves time forward by an ISO 8601 duration made of days, hours, minutes and seconds (`P7D`, `PT15M1S`). */
  advance(duration: string): void;
  /** How long the app slept, in milliseconds: each sleep moves the clock at once. */
  slept: number[];
};

export function testClock(start = '2026-01-05T09:00:00Z'): TestClock {
  let now = new Date(start).getTime();
  const slept: number[] = [];
  return {
    now: () => new Date(now),
    slept,
    async sleep(milliseconds) {
      slept.push(milliseconds);
      now += milliseconds;
    },
    advance(duration) {
      const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(duration);
      if (!match || duration === 'P' || duration.endsWith('T'))
        throw new Error(`Unsupported duration: ${duration}`);
      const [days = 0, hours = 0, minutes = 0, seconds = 0] = match
        .slice(1)
        .map(Number)
        .map((n) => n || 0);
      now += (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
    },
  };
}

/** Returns the given values in order, so a test chooses the outcome of every draw; link tokens and bytes stay really random. */
export function scriptedRandom(...values: number[]): Random {
  const queue = [...values];
  return {
    int(min, max) {
      const value = queue.shift();
      if (value === undefined) throw new Error('scriptedRandom: no value left for this draw');
      if (value < min || value >= max)
        throw new Error(`scriptedRandom: ${value} is outside [${min}, ${max})`);
      return value;
    },
    token: () => cryptoRandom.token(),
    bytes: (length) => cryptoRandom.bytes(length),
  };
}

/** Keeps what the API would have sent to uptime-kuma. */
export function recordingAlert(): Alert & { ups: number; downs: string[] } {
  const alert = {
    ups: 0,
    downs: [] as string[],
    up: () => void (alert.ups += 1),
    down: (reason: string) => void alert.downs.push(reason),
  };
  return alert;
}

/** Keeps the e-mails the API would have sent; `failWith` makes the next sends fail. */
export function recordingEmail(): EmailTransport & {
  sent: EmailMessage[];
  failWith: Error | undefined;
} {
  const transport = {
    sent: [] as EmailMessage[],
    failWith: undefined as Error | undefined,
    async send(message: EmailMessage) {
      if (transport.failWith) throw transport.failWith;
      transport.sent.push(message);
    },
  };
  return transport;
}

/** Have I Been Pwned without the network: the listed passwords are breached, `unreachable` makes the check fail. */
export function fakeHibp(...compromised: string[]): Hibp & { unreachable: boolean } {
  const hibp = {
    unreachable: false,
    async isCompromised(password: string) {
      if (hibp.unreachable) throw new Error('HIBP unreachable');
      return compromised.includes(password);
    },
  };
  return hibp;
}
