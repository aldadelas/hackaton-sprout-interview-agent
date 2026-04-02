import { describe, expect, it } from 'vitest';
import { Agent } from './agent';

describe('Agent instructions', () => {
  it('mendefinisikan pewawancara multipurpose terintegrasi Jobseeker', () => {
    const agent = new Agent();

    expect(agent.instructions).toContain('Jobseeker');
    expect(agent.instructions).toContain('voice interviewer');
    expect(agent.instructions).toContain('many different roles');
  });

  it('mengarahkan bahasa dan pertanyaan mengikuti konteks lowongan', () => {
    const agent = new Agent();

    expect(agent.instructions).toContain('job metadata');
    expect(agent.instructions).toContain('language');
    expect(agent.instructions).toContain('one at a time');
  });
});
