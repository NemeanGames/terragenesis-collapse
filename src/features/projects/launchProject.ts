import { GameState, ResourceType } from '../../state/gameState';
import { PROJECT_TEMPLATES, createProjectInstance } from '../../content/projects';

export interface LaunchProjectOptions {
  instanceId?: string;
}

export interface LaunchProjectResult {
  success: boolean;
  message?: string;
}

export function launchProject(state: GameState, templateId: string, options: LaunchProjectOptions = {}): LaunchProjectResult {
  const template = PROJECT_TEMPLATES[templateId];
  if (!template) {
    return { success: false, message: `Unknown project template: ${templateId}` };
  }

  const missing: ResourceType[] = [];
  for (const [resource, amount] of Object.entries(template.launchCost)) {
    if (!amount) continue;
    const key = resource as ResourceType;
    if ((state.resources[key] ?? 0) < amount) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    return { success: false, message: `Insufficient resources: ${missing.join(', ')}` };
  }

  for (const [resource, amount] of Object.entries(template.launchCost)) {
    if (!amount) continue;
    const key = resource as ResourceType;
    state.resources[key] -= amount;
  }

  const project = createProjectInstance(templateId, options.instanceId);
  state.projects.push(project);
  state.logs.push(`Project launched: ${template.name}.`);

  return { success: true };
}
