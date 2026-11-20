import { jest } from '@jest/globals';
import { setupTestApp, teardownTestApp, request } from './helpers.js';
import { User } from '../src/models/User.js';
import { PasswordResetToken } from '../src/models/PasswordResetToken.js';
import { EmailService } from '../src/services/email.service.js';

const path = '/api/v1/auth';
const originalPassword = 'OriginalPass1!';
const nextPassword = 'UpdatedPass2!';
let app;
let user;
let sendReset;
let sendChanged;

async function issueToken(overrides = {}) {
  const { rawToken, tokenHash } = PasswordResetToken.generateToken();
  const token = await PasswordResetToken.create({
    user: user._id,
    tokenHash,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    ...overrides,
  });
  return { rawToken, token };
}
const reset = (token, password = nextPassword, confirmPassword = password) =>
  request(app).post(`${path}/reset-password`).send({ token, password, confirmPassword });

beforeAll(async () => {
  sendReset = jest.spyOn(EmailService, 'sendPasswordReset').mockResolvedValue(undefined);
  sendChanged = jest.spyOn(EmailService, 'sendPasswordChanged').mockResolvedValue(undefined);
  app = await setupTestApp();
});
afterAll(async () => {
  await teardownTestApp();
  jest.restoreAllMocks();
});
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), PasswordResetToken.deleteMany({})]);
  jest.clearAllMocks();
  user = await User.create({ name: 'Recovery Fan', email: 'recovery@example.test', password: originalPassword });
});

test('rejects malformed, expired and previously used reset links without changing the password', async () => {
  await request(app).get(`${path}/verify-reset-token`).query({ token: 'broken' }).expect(400);
  const expired = await issueToken({ expiresAt: new Date(Date.now() - 60000) });
  const used = await issueToken({ usedAt: new Date() });
  for (const { rawToken } of [expired, used]) {
    await request(app).get(`${path}/verify-reset-token`).query({ token: rawToken }).expect(400);
    await reset(rawToken).expect(400);
  }
  const unchanged = await User.findById(user._id).select('+password');
  expect(await unchanged.comparePassword(originalPassword)).toBe(true);
  expect(sendChanged).not.toHaveBeenCalled();
});

test('returns the real success envelope, consumes the link and cleans sibling tokens without a late server error', async () => {
  const { rawToken, token } = await issueToken();
  await issueToken();
  await User.updateOne({ _id: user._id }, { $set: { refreshTokenHash: 'old-refresh-hash' } });
  const verified = await request(app).get(`${path}/verify-reset-token`).query({ token: rawToken }).expect(200);
  expect(verified.body.data).toEqual({ valid: true, email: user.email });

  const response = await reset(rawToken).expect(200);
  expect(response.body).toEqual({ success: true, message: 'Password reset successful. Please sign in with your new password.' });
  expect((await PasswordResetToken.findById(token._id)).usedAt).toBeInstanceOf(Date);
  expect(await PasswordResetToken.countDocuments({ user: user._id })).toBe(1);
  expect((await User.findById(user._id).select('+refreshTokenHash')).refreshTokenHash).toBeUndefined();
  expect(sendChanged).toHaveBeenCalledTimes(1);

  await request(app).get(`${path}/verify-reset-token`).query({ token: rawToken }).expect(400);
  await reset(rawToken).expect(400);
  await request(app).post(`${path}/login`).send({ email: user.email, password: originalPassword }).expect(401);
  const logs = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const login = await request(app).post(`${path}/login`).send({ email: user.email, password: nextPassword }).expect(200);
    expect(login.body.data.accessToken).toEqual(expect.any(String));
    expect(logs).not.toHaveBeenCalled();
  } finally {
    logs.mockRestore();
  }
});

test('rejects weak and mismatched passwords before consuming a valid reset link', async () => {
  const { rawToken } = await issueToken();
  await reset(rawToken, 'weak').expect(400);
  await reset(rawToken, nextPassword, 'DoesNotMatch1!').expect(400);
  await request(app).get(`${path}/verify-reset-token`).query({ token: rawToken }).expect(200);
  expect(sendChanged).not.toHaveBeenCalled();
});

test('returns the same recovery message for known and unknown addresses without external SMTP', async () => {
  const known = await request(app).post(`${path}/forgot-password`).send({ email: user.email }).expect(200);
  const unknown = await request(app).post(`${path}/forgot-password`).send({ email: 'nobody@example.test' }).expect(200);
  expect(known.body.data).toEqual(unknown.body.data);
  expect(sendReset).toHaveBeenCalledTimes(1);
  expect(sendReset.mock.calls[0][0].to).toBe(user.email);
});
