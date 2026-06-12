// Shared helper: turn a flat category list into level/number-annotated options.
export type FlatCat = { id: string; name: string; parentId: string | null };

export type ParentOption = {
  id: string;
  name: string;
  level: number;
  number: string;
  parentId: string | null;
};

export function buildParentOptions(flat: FlatCat[]): ParentOption[] {
  type N = FlatCat & { children: N[]; level: number; number: string };
  const map = new Map<string, N>();
  for (const c of flat) map.set(c.id, { ...c, children: [], level: 0, number: "" });
  const roots: N[] = [];
  for (const n of map.values()) {
    if (n.parentId && map.has(n.parentId)) map.get(n.parentId)!.children.push(n);
    else roots.push(n);
  }
  const cmp = (a: N, b: N) => a.name.localeCompare(b.name);
  const assign = (nodes: N[], level: number, prefix: string) => {
    nodes.sort(cmp);
    nodes.forEach((n, i) => {
      n.level = level;
      n.number = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      assign(n.children, level + 1, n.number);
    });
  };
  assign(roots, 1, "");
  return [...map.values()].map((n) => ({
    id: n.id,
    name: n.name,
    level: n.level,
    number: n.number,
    parentId: n.parentId,
  }));
}
