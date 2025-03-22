const envPath = __dirname + "/../.env";
require('dotenv').config({ path: envPath });

const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../server');
const User = require('../users');
const Task = require('../tasks');
const mongoose = require('mongoose');

chai.should();
chai.use(chaiHttp);

const lead = {
  username: "lead@test.com",
  email: "lead@test.com",
  password: "lead123",
  role: "lead"
};

const member = {
  username: "member@test.com",
  email: "member@test.com",
  password: "member123",
  role: "member"
};

let tokens = {}, userIds = {}, taskId = null;

describe('Task Assignment Flow', () => {
  before(async () => {
    await mongoose.connect(process.env.DB);
    await User.deleteMany({ username: { $in: [lead.username, member.username] } });
    await Task.deleteMany({});

    // Register users
    await chai.request(server).post('/signup').send(lead);
    await chai.request(server).post('/signup').send(member);

    // Login and get tokens
    const res1 = await chai.request(server).post('/signin').send(lead);
    tokens.lead = res1.body.token;
    const leadUser = await User.findOne({ username: lead.username });
    userIds.lead = leadUser._id;

    const res2 = await chai.request(server).post('/signin').send(member);
    tokens.member = res2.body.token;
    const memberUser = await User.findOne({ username: member.username });
    userIds.member = memberUser._id;
  });

  after(async () => {
    await User.deleteMany({ username: { $in: [lead.username, member.username] } });
    await Task.deleteMany({});
    await mongoose.disconnect();
  });

  it('should assign a task to member', async () => {
    const res = await chai.request(server)
      .post('/assign')
      .set('Authorization', tokens.lead)
      .send({
        title: "Write Documentation",
        description: "Document all endpoints",
        section: 1,
        assignmentNumber: 101,
        assignedTo: userIds.member
      });

    res.should.have.status(201);
    res.body.task.should.have.property('assignedTo');
    taskId = res.body.task._id;
  });

  it('should prevent assigning same section/assignment to another user', async () => {
    const res = await chai.request(server)
      .post('/assign')
      .set('Authorization', tokens.lead)
      .send({
        title: "Conflict Task",
        section: 1,
        assignmentNumber: 101,
        assignedTo: userIds.lead
      });

    res.should.have.status(400);
    res.body.msg.should.include("already assigned");
  });

  it('should reject marking task as completed before approval', async () => {
    const res = await chai.request(server)
      .put(`/${taskId}/status`)
      .set('Authorization', tokens.member)
      .send({ status: "Completed", userId: userIds.member });

    res.should.have.status(403);
  });

  it('should allow lead to approve the task', async () => {
    const res = await chai.request(server)
      .put(`/${taskId}/approve`)
      .send({ userId: userIds.lead });

    res.should.have.status(200);
    res.body.task.approvedByLead.should.be.true;
  });

  it('should allow member to now complete the task', async () => {
    const res = await chai.request(server)
      .put(`/${taskId}/status`)
      .send({ status: "Completed", userId: userIds.member });

    res.should.have.status(200);
    res.body.task.status.should.equal("Completed");
  });
});
