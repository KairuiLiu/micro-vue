// target: Object => keyMap:(string=>Set)
// keyMap: string => Set
const targetMap: Map<any, Map<string, Set<EffectReactive>>> = new Map();
let activeEffect: EffectReactive | undefined;

export class EffectReactive {
  runner: {
    (...args: any[]): any;
    effect?: EffectReactive;
  };
  scheduler: (...args: any[]) => any | undefined;
  onStop: (...args: any[]) => any | undefined;
  deps: Set<Set<EffectReactive>>;
  active: boolean;

  constructor(public fn, options: any) {
    this.runner = this.run.bind(this);
    this.runner.effect = this;
    this.scheduler = options.scheduler;
    this.onStop = options.onStop;
    this.deps = new Set();
    this.active = true;
    this.run();
  }

  run() {
    if (!this.active) return this.fn();
    activeEffect = this;
    const res = this.fn();
    activeEffect = undefined;
    return res;
  }
}

export function effect(fn, options = {}) {
  return new EffectReactive(fn, options).runner;
}

export function track(target, key) {
  if (!activeEffect) return;
  if (!targetMap.has(target)) targetMap.set(target, new Map());
  const keyMap = targetMap.get(target)!;
  if (!keyMap.has(key)) keyMap.set(key, new Set());
  trackEffect(keyMap.get(key)!);
}

export function trackEffect(dependenceEffect) {
  // 本来只需要在 track 上判断 activeEffect 但是这个函数可能被 track 或者 RefImpl 调用, 所以还需要在判断一次
  if (!activeEffect) return;
  dependenceEffect.add(activeEffect);
  activeEffect.deps.add(dependenceEffect);
}

export function trigger(target, key) {
  const keyMap = targetMap.get(target)!;
  if (!keyMap) return;
  const depSet = keyMap.get(key)!;
  if (!depSet) return;
  triggerEffect(depSet);
}

export function triggerEffect(depSet) {
  [...depSet].forEach((d) => (d.scheduler ? d.scheduler() : d.run()));
}

export function stop(runner) {
  if (!runner.effect.active) return;
  runner.effect.active = false;
  [...runner.effect.deps].forEach((d) => d.delete(runner.effect));
  runner.effect.onStop && runner.effect.onStop();
}
