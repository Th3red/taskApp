let envPath = __dirname + "/../.env";
require('dotenv').config({ path: envPath });

let chai = require('chai');
let chaiHttp = require('chai-http');
let server = require('../server');
let User = require('../users');
let Task = require('../tasks');
let mongoose = require('mongoose');

chai.should();
chai.use(chaiHttp);

let lead = {
  name: "Team Lead",
  username: "lead@test.com",
  password: "123@abc",
  role: "lead"
};

let member = {
  name: "Team Member",
  username: "member@test.com",
  password: "123@abc",
  role: "member"
};

let tokens = {}, userIds = {};

describe('Task Assignment Flow', () => {
  before(async () => {
    await mongoose.connect(process.env.DB);
    await User.deleteMany({ username: { $in: [lead.username, member.username] } });
    await Task.deleteMany({});

    // Register lead
    await chai.request(server)
      .post('/signup')
      .send(lead);

    // Register member
    await chai.request(server)
      .post('/signup')
      .send(member);

    // Sign in lead
    const res1 = await chai.request(server)
      .post('/signin')
      .send(lead);

    tokens.lead = res1.body.token;
    const leadUser = await User.findOne({ username: lead.username });
    userIds.lead = leadUser._id;

    // Sign in member
    const res2 = await chai.request(server)
      .post('/signin')
      .send(member);

    tokens.member = res2.body.token;
    const memberUser = await User.findOne({ username: member.username });
    userIds.member = memberUser._id;
  });

  after(async () => {
    await User.deleteMany({ username: { $in: [lead.username, member.username] } });
    await Task.deleteMany({});
    await mongoose.disconnect();
  });

  describe('Assigning Task and Checking Constraints', () => {
    it('should allow lead to assign a task to member', async () => {
      const res = await chai.request(server)
        .post('/api/tasks/assign')
        .send({
          title: "Task 1",
          description: "Complete section 3",
          section: 3,
          assignmentNumber: 1,
          assignedTo: userIds.member
        });

      res.should.have.status(201);
      res.body.task.assignedTo.should.eql(userIds.member.toString());
    });

    it('should prevent assigning the same section/assignment to another user', async () => {
      const res = await chai.request(server)
        .post('/api/tasks/assign')
        .send({
          title: "Task 2",
          description: "Conflict test",
          section: 3,
          assignmentNumber: 1,
          assignedTo: userIds.lead
        });

      res.should.have.status(400);
      res.body.msg.should.include("already assigned");
    });
  });

  describe('Task Progress and Status', () => {
    let taskId;

    it('should show task in progress list', async () => {
      const res = await chai.request(server)
        .get('/api/tasks/progress');

      res.should.have.status(200);
      res.body.length.should.be.gte(1);
      taskId = res.body[0]._id;
    });

    it('should prevent member from marking task complete without lead approval', async () => {
      const res = await chai.request(server)
        .put(`/api/tasks/${taskId}/status`)
        .send({
          userId: userIds.member,
          status: "completed"
        });

      res.should.have.status(403);
    });

    it('should allow lead to approve task', async () => {
      const res = await chai.request(server)
        .put(`/api/tasks/${taskId}/approve`)
        .send({ userId: userIds.lead });

      res.should.have.status(200);
      res.body.task.approvedByLead.should.equal(true);
    });

    it('should now allow member to mark task as completed', async () => {
      const res = await chai.request(server)
        .put(`/api/tasks/${taskId}/status`)
        .send({
          userId: userIds.member,
          status: "completed"
        });

      res.should.have.status(200);
      res.body.task.status.should.equal("completed");
    });
  });
});
