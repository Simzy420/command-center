import { create } from 'zustand';
import { uid } from '@/lib/ids';
import { readJson, writeJson } from '@/store/persist';

export interface LinkTile {
  id: string;
  title: string;
  url: string;
  color: string;
}

const KEY = 'links';
const COLORS = ['#22e9ff', '#e879f9', '#a78bfa', '#f5c542', '#4ade80'];

function load(): LinkTile[] {
  return readJson<LinkTile[]>(KEY, []);
}

interface LinksState {
  tiles: LinkTile[];
  add: (title: string, url: string) => void;
  remove: (id: string) => void;
}

function save(tiles: LinkTile[]) {
  writeJson(KEY, tiles);
}

export const useLinksStore = create<LinksState>((set, get) => ({
  tiles: load(),
  add: (title, url) => {
    const tiles = [
      ...get().tiles,
      {
        id: uid('link'),
        title,
        url,
        color: COLORS[get().tiles.length % COLORS.length],
      },
    ];
    save(tiles);
    set({ tiles });
  },
  remove: (id) => {
    const tiles = get().tiles.filter((t) => t.id !== id);
    save(tiles);
    set({ tiles });
  },
}));
