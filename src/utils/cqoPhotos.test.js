import { describe, expect, it } from 'vitest';
import {
  evidencePhotoLabel,
  extractRawPhotos,
  photoImageCandidates,
  uniquePhotos,
} from './cqoPhotos';

describe('cqoPhotos', () => {
  it('combina o anexo do Storage com as referencias duplicadas do JSON', () => {
    const localPhoto = {
      campo_id: 'cacho_podre_planta',
      capturedAt: '2026-07-11T13:52:41.429Z',
      uri: 'file:///cache/7cb1bbc4-2fc9-4263-bcf2-c4b6587aed5b.jpeg',
      gps: { latitude: -2.8579782, longitude: -48.2395018 },
    };
    const rawPhotos = extractRawPhotos({
      linhas: [{ fotos: [localPhoto] }],
      cqo_evidencias_foto: [localPhoto],
    });
    const attachment = {
      id: 'anexo_1',
      fieldId: 'cacho_podre_planta',
      fileName: '7cb1bbc4-2fc9-4263-bcf2-c4b6587aed5b.jpeg',
      url: 'https://example.supabase.co/storage/signed/01_7cb1bbc4-2fc9-4263-bcf2-c4b6587aed5b.jpeg',
      storagePath: '1955/resposta/01_7cb1bbc4-2fc9-4263-bcf2-c4b6587aed5b.jpeg',
    };

    const result = uniquePhotos([attachment, ...rawPhotos]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      fieldId: 'cacho_podre_planta',
      storagePath: attachment.storagePath,
      url: attachment.url,
      capturedAt: localPhoto.capturedAt,
      gps: localPhoto.gps,
      localOnly: false,
    });
  });

  it('prioriza a miniatura para poupar banda e mantem a imagem completa como fallback', () => {
    const photo = {
      url: 'https://example.com/foto-completa.jpeg',
      thumbnailUrl: 'https://example.com/miniatura.jpeg',
      mimeType: 'image/jpeg',
    };

    expect(photoImageCandidates(photo)).toEqual([
      'https://example.com/miniatura.jpeg',
      'https://example.com/foto-completa.jpeg',
    ]);
  });

  it('mostra o nome operacional do campo em vez do UUID do arquivo', () => {
    expect(evidencePhotoLabel({
      fieldId: 'cacho_podre_planta',
      fileName: '7cb1bbc4-2fc9-4263-bcf2-c4b6587aed5b.jpeg',
    })).toBe('Cacho podre na planta');
  });
});
