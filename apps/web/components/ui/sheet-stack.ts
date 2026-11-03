/**
 * Open sheets, newest last: Escape belongs to the top one only. `lock` runs when the first sheet
 * opens and its undo when the last closes, whatever order sheets unmount in.
 */
export function createSheetStack({ lock }: { lock?: () => () => void } = {}) {
  let next = 0;
  const open: number[] = [];
  let unlock: (() => void) | null = null;
  return {
    open: () => {
      const id = ++next;
      if (open.length === 0 && lock) unlock = lock();
      open.push(id);
      return id;
    },
    close: (id: number) => {
      const i = open.indexOf(id);
      if (i < 0) return;
      open.splice(i, 1);
      if (open.length === 0) {
        unlock?.();
        unlock = null;
      }
    },
    isTop: (id: number) => open.at(-1) === id,
    size: () => open.length,
  };
}

/** The page's sheets: the body doesn't scroll while any is open. */
export const sheets = createSheetStack({
  lock: () => {
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = was;
    };
  },
});
