import { FacilityInstance, FacilityTemplate } from '../state/gameState';

export const FACILITY_TEMPLATES: Record<string, FacilityTemplate> = {
  'solar-array': {
    id: 'solar-array',
    name: 'Solar Array',
    description: 'Deployable photovoltaic field that supplies steady daytime power.',
    buildCost: { credits: 120, biomass: 0, water: 10 },
    buildTimeHours: 8,
    crewRequired: 2,
    hourlyEffects: { power: 6 },
    environmentEffects: { hostility: -0.1 }
  },
  'hydroponics-lab': {
    id: 'hydroponics-lab',
    name: 'Hydroponics Lab',
    description: 'Recycles water and nutrients to yield biomass and oxygen.',
    buildCost: { credits: 180, water: 20, power: 5 },
    buildTimeHours: 12,
    crewRequired: 3,
    hourlyEffects: { biomass: 3, oxygen: 1.5, water: -1, power: -2 },
    environmentEffects: { biomass: 0.4, oxygen: 0.2 }
  },
  'hab-dome': {
    id: 'hab-dome',
    name: 'Habitation Dome',
    description: 'Inflatable dome that expands living capacity and boosts morale.',
    buildCost: { credits: 200, biomass: 10, oxygen: 5 },
    buildTimeHours: 16,
    crewRequired: 1,
    hourlyEffects: { power: -1 },
    environmentEffects: { hostility: -0.05 },
    capacityBonus: 12
  },
  'atmo-processor': {
    id: 'atmo-processor',
    name: 'Atmospheric Processor',
    description: 'Scrubs the air and infuses oxygen while stabilising pressure.',
    buildCost: { credits: 220, power: 10, water: 15 },
    buildTimeHours: 20,
    crewRequired: 4,
    hourlyEffects: { power: -4 },
    environmentEffects: { oxygen: 0.5, pressure: 0.03, hostility: -0.15 }
  }
};

export function createFacilityInstance(templateId: string, instanceId?: string): FacilityInstance {
  const template = FACILITY_TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Unknown facility template: ${templateId}`);
  }

  return {
    id: instanceId ?? `${templateId}-${Math.random().toString(36).slice(2, 8)}`,
    templateId,
    status: 'under-construction',
    assignedSurvivors: 0,
    remainingBuildHours: template.buildTimeHours,
    efficiency: 1
  };
}
