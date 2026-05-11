export type FishKind = "small" | "mid" | "deep";

export type FishCounts = Record<FishKind, number>;

export type FishMeta = {
  name: string;
  price: number;
  description: string;
  texture: string;
  scale: number;
};

export const FISH_KINDS: FishKind[] = ["small", "mid", "deep"];

export const FISH_META: Record<FishKind, FishMeta> = {
  small: {
    name: "小鱼",
    price: 8,
    description: "常见浅海鱼",
    texture: "fish-small",
    scale: 0.78,
  },
  mid: {
    name: "中层鱼",
    price: 16,
    description: "活跃的中层鱼",
    texture: "fish-mid",
    scale: 0.72,
  },
  deep: {
    name: "深海鱼",
    price: 28,
    description: "危险的深海鱼",
    texture: "fish-deep",
    scale: 0.58,
  },
};
