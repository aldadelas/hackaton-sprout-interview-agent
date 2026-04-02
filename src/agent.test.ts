import { describe, expect, it } from 'vitest';
import { Agent, DEFAULT_AGENT_INSTRUCTIONS } from './agent';

describe('Agent instructions', () => {
  it('mendefinisikan role interviewer HR', () => {
    const agent = new Agent();

    expect(agent.instructions).toContain('ROLE');
    expect(agent.instructions).toContain('HR Interviewer profesional');
    expect(agent.instructions).toContain('ALUR WAWANCARA');
  });

  it('mengarahkan alur wawancara dan aturan percakapan', () => {
    const agent = new Agent();

    expect(agent.instructions).toContain('ATURAN PERCAKAPAN');
    expect(agent.instructions).toContain('Ajukan pertanyaan satu per satu');
    expect(agent.instructions).toContain('PENJELASAN POSISI');
  });

  it('mengizinkan override instruksi lewat opsi konstruktor', () => {
    const agent = new Agent({ instructions: 'Hanya tes.' });

    expect(agent.instructions).toBe('Hanya tes.');
    expect(DEFAULT_AGENT_INSTRUCTIONS).toContain('HR Interviewer profesional');
  });
});
