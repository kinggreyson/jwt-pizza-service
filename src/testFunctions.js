const {Role, DB} = require('./database/database.js')

function randomName()
{
    return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let admin = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  admin.name = randomName();
  admin.email = admin.name + '@admin.com';
  admin = await DB.addUser(admin);
  return { ...admin, password: 'toomanysecrets' };
}

module.exports = { randomName, createAdminUser };