const envPath = __dirname + "/../.env";
require('dotenv').config({ path: envPath });

const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../server');
const User = require('../users');

chai.should();
chai.use(chaiHttp);

const testUser = {
  username: 'user1@test.com',
  role: 'member',
  password: 'test123',
  email: 'user1@gmail.com'
};

describe('User Signup and Login', () => {
  beforeEach(async () => {
    await User.deleteOne({ username: testUser.username });
  });

  after(async () => {
    await User.deleteOne({ username: testUser.username });
  });

  it('should register, login, and return a valid token', async () => {
    const signupRes = await chai.request(server)
      .post('/signup')
      .send(testUser);

    signupRes.should.have.status(201);
    signupRes.body.success.should.be.eql(true);

    const signinRes = await chai.request(server)
      .post('/signin')
      .send({
        username: testUser.username,
        password: testUser.password
      });

    signinRes.should.have.status(200);
    signinRes.body.should.have.property('token');
  });
});
