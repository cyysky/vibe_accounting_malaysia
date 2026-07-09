import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * E2E smoke test. Requires the API container to be running with the
 * Prisma schema applied and the idempotent seed having created the
 * default admin user (admin@example.com / ChangeMe!123).
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health -> 200', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect((res) => {
      expect(res.body.status).toBe('ok');
    });
  });

  it('POST /api/auth/login with bad password -> 401', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'wrong' })
      .expect(401);
  });

  it('POST /api/auth/login with correct credentials -> 200 + tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'ChangeMe!123' })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe('admin@example.com');
  });

  it('GET /api/gl/accounts without token -> 401', () => {
    return request(app.getHttpServer()).get('/api/gl/accounts').expect(401);
  });

  it('GET /api/gl/accounts with token -> 200', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'ChangeMe!123' });
    const token = login.body.accessToken;
    const res = await request(app.getHttpServer())
      .get('/api/gl/accounts')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
