export type Proposal = { house: string; name: string; concentration: string | null; flanker: string | null; perfumeId: string | null; onShelf: 'owned' | 'wishlist' | null };

/** An edit to the identify proposal. Any edit drops the match; a new house or name also drops the proposed edition. */
export function editProposal(p: Proposal, k: 'house' | 'name' | 'concentration', v: string): Proposal {
  if (k === 'concentration') return { ...p, concentration: v || null, perfumeId: null, onShelf: null };
  return { ...p, [k]: v, flanker: null, perfumeId: null, onShelf: null };
}
