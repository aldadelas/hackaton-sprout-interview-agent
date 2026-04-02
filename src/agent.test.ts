import { describe, expect, it } from 'vitest';
import { Agent } from './agent';

describe('Agent instructions', () => {
  it('menggunakan instruksi bahasa Indonesia yang sopan, singkat, dan jelas', () => {
    const agent = new Agent();

    expect(agent.instructions).toContain('Bahasa Indonesia');
    expect(agent.instructions).toContain('sopan');
    expect(agent.instructions).toContain('singkat');
    expect(agent.instructions).toContain('jelas');
  });
});
