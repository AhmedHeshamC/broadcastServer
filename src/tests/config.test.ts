import { config } from '../config';

describe('Configuration', () => {
  it('should load test environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.JWT_ACCESS_SECRET).toBe('test-jwt-access-secret-key');
    expect(process.env.JWT_REFRESH_SECRET).toBe('test-jwt-refresh-secret-key');
  });

  it('should have required configuration values', () => {
    const jwtSecret = config.get('jwtSecret');
    const jwtRefreshSecret = config.get('jwtRefreshSecret');

    expect(jwtSecret).toBe('test-jwt-access-secret-key');
    expect(jwtRefreshSecret).toBe('test-jwt-refresh-secret-key');
  });

  it('should have correct default values', () => {
    const port = config.get('port');
    const maxConnectionsPerUser = config.get('maxConnectionsPerUser');
    const maxMessageLength = config.get('maxMessageLength');

    expect(port).toBe(3000);
    expect(maxConnectionsPerUser).toBe(5);
    expect(maxMessageLength).toBe(1000);
  });
});