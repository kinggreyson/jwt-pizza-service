const { randomName, createAdminUser } = require('../testFunctions');
  const request = require('supertest');
  const app = require('../service');

let adminAuth;
let adminUser;
let testAuth;

beforeAll(async () => {
    adminUser = await createAdminUser();
    const adminLoginResult = await request(app).put('/api/auth').send(adminUser);
    adminAuth = adminLoginResult.body.token;
    const user = { name: randomName(), email: randomName() + '@test.com', password: 'a' };
    const userLoginResult = await request(app).post('/api/auth').send(user);
    testAuth = userLoginResult.body.token;
});

test ('get Menu', async () => {
    const result = await request(app).get('/api/order/menu');
    expect (result.status).toBe(200);
    expect (Array.isArray(result.body)).toBe(true);
})

test ('Add a new item', async () => {
    const result = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${adminAuth}`)
        .send({ title: randomName(), description : 'Delicious', image: 'DessertPizza.png', price: 20.00 });
    expect(result.status).toBe(200);
})

test ('get orders', async () => {
    const result = await request(app)
        .get('/api/order')
        .set('Authorization', `Bearer ${testAuth}`);
    expect (result.status).toBe(200);
})