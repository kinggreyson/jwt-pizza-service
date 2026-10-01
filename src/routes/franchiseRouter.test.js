const { randomName, createAdminUser } = require('../testFunctions');
  const request = require('supertest');
  const app = require('../service');

let adminAuth;
let adminUser;
let testAuth;
let franchiseId;
let storeId;
let franchiseName = randomName();

beforeAll(async () => {
    adminUser = await createAdminUser();
    const adminLoginResult = await request(app).put('/api/auth').send(adminUser);
    adminAuth = adminLoginResult.body.token;
    const user = { name: randomName(), email: randomName() + '@test.com', password: 'a' };
    const userLoginResult = await request(app).post('/api/auth').send(user);
    testAuth = userLoginResult.body.token;
});

test ("Unauthorized to create a franchise", async () => {
    const result = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${testAuth}`)
        .send({name : randomName(), admins : [{email : adminUser.email }] });
    expect(result.status).toBe(403);
});

test ("Admin creates a franchise", async () => {
    const result = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminAuth}`)
        .send({name : franchiseName, admins : [{email : adminUser.email }] });
    expect(result.status).toBe(200);
    expect(result.body.name).toBe(franchiseName);
    franchiseId = result.body.id;
});

test ("List franchises", async () => {
    const result = await request(app).get('/api/franchise');
    expect(result.status).toBe(200);
    expect (Array.isArray(result.body.franchises)).toBe(true);
});

test("Admin creates a store", async () => {
    const result = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${adminAuth}`)
        .send({ franchiseId, name : randomName() });
    expect(result.status).toBe(200);
    storeId = result.body.id;
});

test("Admin deletes a store", async () => {
    const result = await request(app)
        .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
        .set('Authorization', `Bearer ${adminAuth}`);
    expect(result.status).toBe(200);
});

test("Admin deletes a franchise", async () => {
    const result = await request(app)
        .delete(`/api/franchise/${franchiseId}`)
        .set('Authorization', `Bearer ${adminAuth}`);
    expect(result.status).toBe(200);
});