import { ProjectInstance, ProjectTemplate } from '../state/gameState';

export const PROJECT_TEMPLATES: Record<string, ProjectTemplate> = {
  'oxidiser-dispersal': {
    id: 'oxidiser-dispersal',
    name: 'Oxidiser Dispersal',
    description: 'Deploys catalytic spores to accelerate atmospheric oxygenation.',
    launchCost: { credits: 150, research: 10, biomass: 5 },
    durationHours: 24,
    completionEnvironmentDelta: { oxygen: 2.5, hostility: -1 },
    completionResourceDelta: { research: 5 }
  },
  'thermal-relay': {
    id: 'thermal-relay',
    name: 'Thermal Relay Network',
    description: 'Installs orbital mirrors to nudge the average temperature upwards.',
    launchCost: { credits: 220, power: 10, research: 12 },
    durationHours: 36,
    upkeep: { power: -2 },
    completionEnvironmentDelta: { temperature: 4, pressure: 0.05 }
  },
  'rain-seeding': {
    id: 'rain-seeding',
    name: 'Rain Seeding Initiative',
    description: 'Stimulates localised storms to refill aquifers and grow biomass.',
    launchCost: { credits: 200, water: 30, research: 8 },
    durationHours: 30,
    completionEnvironmentDelta: { waterLevel: 6, biomass: 3 },
    completionResourceDelta: { biomass: 10 }
  }
};

export function createProjectInstance(templateId: string, instanceId?: string): ProjectInstance {
  const template = PROJECT_TEMPLATES[templateId];
  if (!template) {
    throw new Error(`Unknown project template: ${templateId}`);
  }

  return {
    id: instanceId ?? `${templateId}-${Math.random().toString(36).slice(2, 8)}`,
    templateId,
    remainingHours: template.durationHours,
    status: 'active',
    progressHours: 0
  };
}
