const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');
const { randomName } = require('../testFunctions');

let testUser;
let testAuth;

beforeAll(async () => {

    testUser = { name: randomName(), email: randomName() + '@test.com', password: 'a' };
    const register = await request(app).post('/api/auth').send(testUser);
    testAuth = register.body.token;
    testUser.id = register.body.user.id;
});

test("Get current user", async() => {
    const result = await request(app)
        .get('/api/user/me')
        .set('Authorization', `Bearer ${testAuth}`);
    expect(result.status).toBe(200)
    expect(result.body.email).toBe(testUser.email)
});

test("User updates their information", async() => {
    const newName = randomName();
    const result = await request(app)
        .put(`/api/user/${testUser.id}`)
        .set('Authorization', `Bearer ${testAuth}`)
        .send({ name : newName, email: testUser.email, password : 'a' });
    expect(result.status).toBe(200)
})

test('list users unauthorized', async () => {
  const listUsersRes = await request(app).get('/api/user');
  expect(listUsersRes.status).toBe(401);
});

test('list users', async () => {
  const userToken = await loginAdmin();
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + userToken);
  expect(listUsersRes.status).toBe(200);
});

test('list users returns users', async () => {
  const userToken = await loginAdmin();
  const res = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + userToken);

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.users)).toBe(true);
  expect(res.body.users.length).toBeGreaterThan(0);
  expect(typeof res.body.more).toBe('boolean');
  expect(res.body.users[0]).toHaveProperty('roles');
  expect(res.body.users[0]).not.toHaveProperty('password');
});

test('list users pagination', async () => {
  const userToken = await loginAdmin();
  await registerUser(request(app));
  await registerUser(request(app));

  const page1 = await request(app)
    .get('/api/user?page=1&limit=2')
    .set('Authorization', 'Bearer ' + userToken);
  expect(page1.status).toBe(200);
  expect(page1.body.users.length).toBe(2);
  expect(page1.body.more).toBe(true);

  const page2 = await request(app)
    .get('/api/user?page=2&limit=2')
    .set('Authorization', 'Bearer ' + userToken);
  expect(page2.body.users.length).toBeGreaterThan(0);
  expect(page2.body.users[0].id).not.toBe(page1.body.users[0].id);
});

test('list users name filter', async () => {
  const userToken = await loginAdmin();

  const newName = `filter${randomName()}`;
  const target = await request(app)
    .post('/api/auth')
    .send({ name: newName, email: `${randomName()}@test.com`, password: 'a' });
  expect(target.status).toBe(200);

  const res = await request(app)
    .get(`/api/user?page=1&limit=10&name=${newName}*`)
    .set('Authorization', 'Bearer ' + userToken);

  expect(res.status).toBe(200);
  expect(res.body.users.length).toBe(1);
  expect(res.body.users[0].name).toBe(newName);
  expect(res.body.more).toBe(false);
});

test('list users forbidden for non-admin', async () => {
  const [, userToken] = await registerUser(request(app));
  const res = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + userToken);
  expect(res.status).toBe(403);
});

test('delete user unauthorized', async () => {
  const res = await request(app).delete('/api/user/1');
  expect(res.status).toBe(401);
});

test('delete user forbidden for non-admin', async () => {
  const [user, userToken] = await registerUser(request(app));
  const res = await request(app)
    .delete(`/api/user/${user.id}`)
    .set('Authorization', 'Bearer ' + userToken);
  expect(res.status).toBe(403);console.log(res.status, res.body);console.log(res.status, res.body);
});

test('delete user as admin', async () => {
  const adminToken = await loginAdmin();
  const [victim] = await registerUser(request(app));

  const res = await request(app)
    .delete(`/api/user/${victim.id}`)
    .set('Authorization', 'Bearer ' + adminToken);
    console.log(res.status, res.body);
  expect(res.status).toBe(200);
  expect(res.body.message).toBe('user deleted');
});

test('deleted user is gone', async () => {
  const adminToken = await loginAdmin();

  const uniqueName = `gone${randomName()}`;
  const email = `${randomName()}@test.com`;
  const reg = await request(app).post('/api/auth').send({ name: uniqueName, email, password: 'a' });

  await request(app)
    .delete(`/api/user/${reg.body.user.id}`)
    .set('Authorization', 'Bearer ' + adminToken);

  const list = await request(app)
    .get(`/api/user?page=1&limit=10&name=${uniqueName}*`)
    .set('Authorization', 'Bearer ' + adminToken);
  expect(list.body.users.length).toBe(0);

  const login = await request(app).put('/api/auth').send({ email, password: 'a' });
  expect(login.status).not.toBe(200);
});

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';
  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

async function loginAdmin() {
  const admin = await createAdminUser();
  const loginRes = await request(app).put('/api/auth').send({ email: admin.email, password: admin.password });
  return loginRes.body.token;
}