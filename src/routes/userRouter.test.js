const request = require('supertest');
const app = require('../service');
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

