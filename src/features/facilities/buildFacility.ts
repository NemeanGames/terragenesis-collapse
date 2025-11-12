import { GameState, ResourceType } from '../../state/gameState';
import { FACILITY_TEMPLATES, createFacilityInstance } from '../../content/facilities';

export interface BuildFacilityOptions {
  instanceId?: string;
}

export interface BuildFacilityResult {
  success: boolean;
  message?: string;
}

function hasResources(state: GameState, templateId: string): { ok: boolean; missing?: ResourceType[] } {
  const template = FACILITY_TEMPLATES[templateId];
  if (!template) {
    return { ok: false, missing: [] };
  }

  const missing: ResourceType[] = [];
  for (const [resource, amount] of Object.entries(template.buildCost)) {
    if (!amount) continue;
    const key = resource as ResourceType;
    if ((state.resources[key] ?? 0) < amount) {
      missing.push(key);
    }
  }

  return { ok: missing.length === 0, missing: missing.length ? missing : undefined };
}

export function buildFacility(state: GameState, templateId: string, options: BuildFacilityOptions = {}): BuildFacilityResult {
  const template = FACILITY_TEMPLATES[templateId];
  if (!template) {
    return { success: false, message: `Unknown facility template: ${templateId}` };
  }

  const affordability = hasResources(state, templateId);
  if (!affordability.ok) {
    return {
      success: false,
      message: `Insufficient resources: ${affordability.missing?.join(', ')}`
    };
  }

  for (const [resource, amount] of Object.entries(template.buildCost)) {
    if (!amount) continue;
    const key = resource as ResourceType;
    state.resources[key] -= amount;
  }

  const facility = createFacilityInstance(templateId, options.instanceId);
  state.facilities.push(facility);
  state.population.assignments[facility.id] = 0;
  state.logs.push(`Construction ordered: ${template.name}.`);

  return { success: true };
}
