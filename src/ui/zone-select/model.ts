import {
  GlobalBuff,
  MetaProgressionState,
  ZoneSelectModel,
  buildZoneSelectModel,
  applyZoneReclaimed,
  loadMetaProgression,
  saveMetaProgression,
} from "../../state/persistence";

export interface ZoneDefinition {
  id: string;
  name: string;
  difficulty: "CALM" | "TENSE" | "OVERWHELMING";
  buffs: GlobalBuff[];
  description: string;
}

export interface ZoneSelectViewModel extends ZoneSelectModel {
  /** Optional tooltip text for the selected zone. */
  selectionDetails?: {
    zoneId: string;
    description: string;
    buffs: GlobalBuff[];
  };
}

export class ZoneSelectStore {
  private meta: MetaProgressionState;
  private zones: ZoneDefinition[];
  private selectedId?: string;

  constructor(zones: ZoneDefinition[], persisted?: MetaProgressionState) {
    this.zones = zones;
    this.meta = persisted ?? loadMetaProgression();
  }

  selectZone(zoneId: string): ZoneSelectViewModel {
    this.selectedId = zoneId;
    return this.getViewModel();
  }

  markReclaimed(zoneId: string, buffs: GlobalBuff[]): ZoneSelectViewModel {
    this.meta = applyZoneReclaimed(this.meta, zoneId, buffs);
    saveMetaProgression(this.meta);
    if (this.selectedId !== zoneId) {
      this.selectedId = zoneId;
    }
    return this.getViewModel();
  }

  getViewModel(): ZoneSelectViewModel {
    const base = buildZoneSelectModel(this.zones, this.meta);
    const selected = this.selectedId
      ? this.zones.find((zone) => zone.id === this.selectedId)
      : undefined;

    return {
      ...base,
      selectionDetails: selected
        ? {
            zoneId: selected.id,
            description: selected.description,
            buffs: selected.buffs,
          }
        : undefined,
    };
  }

  getMeta(): MetaProgressionState {
    return this.meta;
  }
}
