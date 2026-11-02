import { describe, expect, it } from 'vitest';
import { nextStep, type QueueItem } from '../upload-queue';

const item = (over: Partial<QueueItem> = {}): QueueItem => ({
  scanId: '33333333-3333-4333-8333-333333333333',
  mode: 'bottle',
  blobs: [new Blob(['a']), new Blob(['b'])],
  uploaded: [false, false],
  registered: false,
  stage: 'uploading',
  ...over,
});

describe('nextStep', () => {
  it('fresh 2-photo item uploads photo 0', () => {
    expect(nextStep(item())).toEqual({ kind: 'upload', index: 0 });
  });
  it('photo 0 uploaded → upload photo 1', () => {
    expect(nextStep(item({ uploaded: [true, false] }))).toEqual({ kind: 'upload', index: 1 });
  });
  it('all uploaded → register', () => {
    expect(nextStep(item({ uploaded: [true, true] }))).toEqual({ kind: 'register' });
  });
  it('registered → extract', () => {
    expect(nextStep(item({ uploaded: [true, true], registered: true, stage: 'registering' }))).toEqual({ kind: 'extract' });
  });
  it('done → none', () => {
    expect(nextStep(item({ uploaded: [true, true], registered: true, stage: 'done' }))).toEqual({ kind: 'none' });
  });
  it('failed but registered → extract, not register', () => {
    expect(nextStep(item({ uploaded: [true, true], registered: true, stage: 'failed', error: 'x' }))).toEqual({ kind: 'extract' });
  });
  it('failed during upload resumes at the missing photo', () => {
    expect(nextStep(item({ uploaded: [true, false], stage: 'failed', error: 'x' }))).toEqual({ kind: 'upload', index: 1 });
  });
});
