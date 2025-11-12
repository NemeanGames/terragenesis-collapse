import { GameState } from '../../state/gameState';
import { FACILITY_TEMPLATES } from '../../content/facilities';

export interface AssignSurvivorsOptions {
  facilityId: string;
  survivors: number;
}

export interface AssignSurvivorsResult {
  success: boolean;
  message?: string;
}

export function assignSurvivors(state: GameState, options: AssignSurvivorsOptions): AssignSurvivorsResult {
  const facility = state.facilities.find((f) => f.id === options.facilityId);
  if (!facility) {
    return { success: false, message: `Facility ${options.facilityId} not found.` };
  }

  const template = FACILITY_TEMPLATES[facility.templateId];
  if (!template) {
    return { success: false, message: `Template ${facility.templateId} missing.` };
  }

  if (facility.status !== 'operational' && facility.status !== 'under-construction') {
    return { success: false, message: `${template.name} is not ready for staffing.` };
  }

  const target = Math.max(0, Math.min(options.survivors, template.crewRequired));
  const current = facility.assignedSurvivors;
  const delta = target - current;

  if (delta > 0 && state.population.unassigned < delta) {
    return { success: false, message: 'Not enough unassigned survivors.' };
  }

  facility.assignedSurvivors = target;
  state.population.assignments[facility.id] = target;
  state.population.unassigned -= delta;
  state.population.unassigned = Math.max(0, state.population.unassigned);

  const status = facility.status === 'operational' ? 'operational' : 'construction';
  state.logs.push(`Assigned ${target} survivor(s) to ${template.name} (${status}).`);

  return { success: true };
}
