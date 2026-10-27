import type { LoginState } from '../shared/types';

type LoginRunner = (signal: AbortSignal, onOutput: (text: string) => void) => Promise<{ output: string; code: number }>;

export class LoginSession {
  private current: LoginState = { status: 'idle', output: '', revision: 0 };
  private active?: { abort: AbortController; timer: ReturnType<typeof setTimeout> };

  constructor(private run: LoginRunner, private notify: (state: LoginState) => void, private timeout = 600000) {}

  get state(): LoginState { return { ...this.current }; }

  private publish(status: LoginState['status'], output = this.current.output) {
    this.current = { status, output: output.slice(-24000), revision: this.current.revision + 1 };
    this.notify(this.state);
  }

  start(): LoginState {
    if (this.active) return this.state;
    const abort = new AbortController();
    const task = { abort, timer: setTimeout(() => this.stop('timed_out'), this.timeout) };
    this.active = task;
    this.publish('running', '');
    // A session identity keeps late output/exit callbacks from changing a newer login.
    void Promise.resolve().then(() => {
      abort.signal.throwIfAborted();
      return this.run(abort.signal, output => {
        if (this.active === task) this.publish('running', output);
      });
    }).then(result => {
      if (this.active !== task) return;
      clearTimeout(task.timer);
      this.active = undefined;
      this.publish(result.code === 0 ? 'succeeded' : 'failed', result.output || this.current.output);
    }).catch(error => {
      if (this.active !== task) return;
      clearTimeout(task.timer);
      this.active = undefined;
      this.publish('failed', [this.current.output, error instanceof Error ? error.message : String(error)].filter(Boolean).join('\n'));
    });
    return this.state;
  }

  private stop(status: 'cancelled' | 'timed_out') {
    const task = this.active;
    if (!task) return;
    this.active = undefined;
    clearTimeout(task.timer);
    task.abort.abort();
    this.publish(status);
  }

  cancel(): LoginState { this.stop('cancelled'); return this.state; }
}
