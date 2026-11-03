/** Open sheets, newest last: Escape and scroll locking belong to the top one only. */
export function createSheetStack() {
  let next = 0;
  const open: number[] = [];
  return {
    open: () => {
      const id = ++next;
      open.push(id);
      return id;
    },
    close: (id: number) => {
      const i = open.indexOf(id);
      if (i >= 0) open.splice(i, 1);
    },
    isTop: (id: number) => open.at(-1) === id,
    size: () => open.length,
  };
}

export const sheets = createSheetStack();
