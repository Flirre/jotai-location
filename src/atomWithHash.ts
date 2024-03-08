import { atom } from 'jotai/vanilla';
import type { WritableAtom } from 'jotai/vanilla';
import { RESET } from 'jotai/vanilla/utils';

type SetStateActionWithReset<Value> =
  | Value
  | typeof RESET
  | ((prev: Value) => Value | typeof RESET);

const safeJSONParse = (initialValue: unknown) => (str: string) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return initialValue;
  }
};

type AtomOptions<T> = Pick<Options<T>, 'setHash'>;

type Options<T> = {
  serialize?: (val: T) => string;
  deserialize?: (str: string) => T;
  subscribe?: (callback: () => void) => () => void;
  setHash?: 'default' | 'replaceState' | ((searchParams: string) => void);
};

export function atomWithHash<Value>(
  key: string,
  initialValue: Value,
  options?: Options<Value>,
): WritableAtom<
  Value,
  [SetStateActionWithReset<Value>, AtomOptions<Value>?],
  void
> {
  const serialize = options?.serialize || JSON.stringify;
  const deserialize = options?.deserialize || safeJSONParse(initialValue);
  const subscribe =
    options?.subscribe ||
    ((callback) => {
      window.addEventListener('hashchange', callback);
      return () => {
        window.removeEventListener('hashchange', callback);
      };
    });
  const setHashOption = options?.setHash;
  let setHash = (searchParams: string) => {
    window.location.hash = searchParams;
  };
  if (setHashOption === 'replaceState') {
    setHash = (searchParams) => {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}#${searchParams}`,
      );
    };
  }
  if (typeof setHashOption === 'function') {
    setHash = setHashOption;
  }
  const strAtom = atom<string | null>(null);
  strAtom.onMount = (setAtom) => {
    if (typeof window === 'undefined' || !window.location) {
      return undefined;
    }
    const callback = () => {
      const searchParams = new URLSearchParams(window.location.hash.slice(1));
      const str = searchParams.get(key);
      setAtom(str);
    };
    const unsubscribe = subscribe(callback);
    callback();
    return unsubscribe;
  };
  const valueAtom = atom((get) => {
    const str = get(strAtom);
    return str === null ? initialValue : deserialize(str);
  });
  return atom(
    (get) => get(valueAtom),
    (
      get,
      set,
      update: SetStateActionWithReset<Value>,
      atomOptions: AtomOptions<Value> = {},
    ) => {
      if (atomOptions.setHash) {
        setHash = (searchParams: string) => {
          window.location.hash = searchParams;
        };
        if (setHashOption === 'replaceState') {
          setHash = (searchParams) => {
            window.history.replaceState(
              window.history.state,
              '',
              `${window.location.pathname}${window.location.search}#${searchParams}`,
            );
          };
        }
        if (typeof setHashOption === 'function') {
          setHash = setHashOption;
        }
      }
      const nextValue =
        typeof update === 'function'
          ? (update as (prev: Value) => Value | typeof RESET)(get(valueAtom))
          : update;
      const searchParams = new URLSearchParams(window.location.hash.slice(1));
      if (nextValue === RESET) {
        set(strAtom, null);
        searchParams.delete(key);
      } else {
        const str = serialize(nextValue);
        set(strAtom, str);
        searchParams.set(key, str);
      }
      console.log('setHash');

      setHash(searchParams.toString());
    },
  );
}
