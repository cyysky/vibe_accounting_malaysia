import { joinUrl } from './url';

describe('joinUrl', () => {
  it('adds exactly one slash between base and path', () => {
    expect(joinUrl('http://localhost:8080/api', 'gl/journals/1')).toBe('http://localhost:8080/api/gl/journals/1');
    expect(joinUrl('http://localhost:8080/api/', '/gl/journals/1')).toBe('http://localhost:8080/api/gl/journals/1');
  });
});
