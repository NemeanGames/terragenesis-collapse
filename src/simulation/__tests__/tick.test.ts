import { describe, expect, it } from 'vitest';

import { createInitialGameState } from '../../state/gameState';
import { createFacilityInstance, FACILITY_TEMPLATES } from '../../content/facilities';
import { processTick } from '../tick';
import { launchProject } from '../../features/projects/launchProject';

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

describe('processTick', () => {
  it('applies facility production and survivor consumption each hour', () => {
    const state = createInitialGameState();
    const facility = createFacilityInstance('hydroponics-lab', 'hydro-1');
    facility.status = 'operational';
    facility.remainingBuildHours = 0;
    facility.assignedSurvivors = FACILITY_TEMPLATES['hydroponics-lab'].crewRequired;
    state.facilities.push(facility);
    state.population.assignments[facility.id] = facility.assignedSurvivors;
    state.population.unassigned -= facility.assignedSurvivors;

    processTick(state, { hours: 5 });

    expect(round(state.resources.biomass, 2)).toBeCloseTo(53, 2);
    expect(round(state.resources.oxygen, 2)).toBeCloseTo(77.5, 2);
    expect(round(state.resources.water, 2)).toBeCloseTo(91, 2);
    expect(round(state.resources.power, 2)).toBeCloseTo(30, 2);
    expect(round(state.environment.metrics.oxygen, 2)).toBeCloseTo(6, 2);
    expect(round(state.environment.metrics.biomass, 2)).toBeCloseTo(7, 2);
  });

  it('completes projects and applies environment adjustments', () => {
    const state = createInitialGameState();
    state.resources.research = 25;
    state.resources.oxygen = 1000;
    state.resources.water = 500;
    state.resources.biomass = 300;

    const result = launchProject(state, 'oxidiser-dispersal', { instanceId: 'proj-1' });
    expect(result.success).toBe(true);

    const project = state.projects[0];
    expect(project.templateId).toBe('oxidiser-dispersal');

    const tickResult = processTick(state, { hours: 24 });
    expect(tickResult.completedProjects).toContain('proj-1');
    expect(project.status).toBe('completed');
    expect(round(state.environment.metrics.oxygen, 2)).toBeCloseTo(7.5, 2);
    expect(round(state.environment.metrics.hostility, 2)).toBeCloseTo(59, 2);
    expect(state.resources.research).toBe(20);
  });

  it('fails upkeep projects when resources run out', () => {
    const state = createInitialGameState();
    state.resources.credits = 400;
    state.resources.research = 30;
    state.resources.power = 12;

    const launchResult = launchProject(state, 'thermal-relay', { instanceId: 'relay-1' });
    expect(launchResult.success).toBe(true);

    const project = state.projects.find((p) => p.id === 'relay-1');
    expect(project).toBeDefined();

    const tickResult = processTick(state, { hours: 3 });
    expect(tickResult.failedProjects).toContain('relay-1');
    expect(project?.status).toBe('failed');
    expect((tickResult.resourceShortages.power ?? 0)).toBeLessThan(0);
    expect(state.logs.some((log) => log.includes('failed due to lack of power'))).toBe(true);
  });

  it('reduces survivors when oxygen is fully depleted', () => {
    const state = createInitialGameState();
    state.resources.oxygen = 1;

    const { resourceShortages } = processTick(state, { hours: 1 });
    expect((resourceShortages.oxygen ?? 0)).toBeLessThan(0);
    expect(state.population.survivors).toBeLessThan(24);
    expect(state.logs.some((log) => log.includes('lost due to oxygen shortage'))).toBe(true);
  });
});
