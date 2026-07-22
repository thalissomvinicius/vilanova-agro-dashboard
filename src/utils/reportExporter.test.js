import { describe, expect, it } from 'vitest';
import { buildDashboardRecordReportHtml } from './reportExporter';

describe('buildDashboardRecordReportHtml', () => {
  it('inclui os dois fiscais no relatorio da ficha', () => {
    const html = buildDashboardRecordReportHtml({
      id: 'res-fiscais',
      type: 'corte',
      farm: 'Fe em Deus',
      parcel: 'F-23',
      date: '21/07/2026',
      time: '14:25',
      cycle: '2',
      evaluator: 'Arielle Piedade Firmino',
      evaluatorMatricula: '2717',
      fiscalResponsavel: '1938 - Daniel Souza Costa',
      fiscalResponsavelEquipe: '384 - Raimundo Nonato dos Santos Furtado Junior',
      lines: [],
      observation: '',
    });

    expect(html).toContain('Fiscal responsável');
    expect(html).toContain('1938 - Daniel Souza Costa');
    expect(html).toContain('Fiscal responsável da equipe');
    expect(html).toContain('384 - Raimundo Nonato dos Santos Furtado Junior');
  });
});
