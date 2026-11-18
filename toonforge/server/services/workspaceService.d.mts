export const SKILL_DIRS: string[];
export function probeSkill(home?: string): Promise<{
  id: 'skill';
  name: string;
  installed: boolean;
  version?: string;
  role: string;
  installCmd: string;
}>;
