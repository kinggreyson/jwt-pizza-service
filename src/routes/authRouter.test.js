const request = require('supertest');
const app = require('../service');

const user = { name: 'pizza', email: 'pizza@gmail.com', password: '1'};
let testAuth;

//Setup test profile
beforeAll(async () => {
    user.email = Math.random().toString(36).substring(2, 12) + '@gmail.com'; //randomize email
    const register = await request(app).post('/api/auth').send(user);
    testAuth = register.body.token;
    expectation(testAuth);
})

test('login', async () => {
    const login = await request(app).put('/api/auth').send(user);
    expect(login.status).toBe(200);
    expectation(login.body.token);
    const expectUser = {... user, roles: [{ role: 'diner'}]};
    delete expectUser.password;
    expect(login.body.user).toMatchObject(expectUser);
});

test('register without email', async() => {
    const reg = await request(app).post('/api/auth').send({name: 'no email'})
    expect(reg.status).toBe(400)
});

function expectation(jwt)
{
    expect(jwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/); //SETUP correct characters
}

test('logout', async() =>{
    const log = await request(app)
        .delete('/api/auth')
        .set('Authorization', `Bearer ${testAuth}`);
    expect(log.status).toBe(200);
});

test('Logout without the token', async() =>{
    const log = await request(app)
        .delete('/api/auth');
    expect(log.status).toBe(401)
})