export const ZONING_CFG = {
  lotMinAreaPx: 48,
  frontageTargetPx: 20,
  depthMinPx: 12,
  depthMaxPx: 40,
  intersectionInfluencePx: 24,
  backboneTag: 'backbone' as const
};

export type ZoningConfig = typeof ZONING_CFG;
